import api, { route } from '@forge/api';
import { SprintData, IssueData, StatusTransition } from '../types';

// Declare global setTimeout for Node.js environment
declare const setTimeout: (callback: () => void, ms: number) => any;

/**
 * JiraDataCollector - Service for collecting sprint and issue data from Jira
 * 
 * This class handles all interactions with the Jira REST API v3, including:
 * - Fetching sprint details and metadata
 * - Retrieving issues within sprints
 * - Collecting issue status transition history
 * - Fetching historical sprint data for trend analysis
 * 
 * All API calls use Forge's asUser context for authentication.
 */
export class JiraDataCollector {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_MS = 1000;

  /**
   * Fetch sprint details including start/end dates, state, and goal
   * @param sprintId - The ID of the sprint to fetch
   * @returns Sprint data including metadata
   */
  async getSprintData(sprintId: string): Promise<SprintData> {
    // Query for any issue in this sprint to get sprint metadata
    const jql = `sprint = ${sprintId}`;
    const response = await this.makeRequest(
      route`/rest/api/3/search/jql?jql=${jql}&maxResults=1&fields=customfield_10020`
    );

    const data = await response.json();
    
    // Try to extract sprint info from the first issue
    if (data.issues && data.issues.length > 0) {
      const sprintField = data.issues[0].fields.customfield_10020;
      if (Array.isArray(sprintField)) {
        const sprint = sprintField.find((s: any) => s.id.toString() === sprintId);
        if (sprint) {
          return {
            id: sprint.id.toString(),
            name: sprint.name || `Sprint ${sprintId}`,
            state: this.mapSprintState(sprint.state || 'active'),
            startDate: sprint.startDate || new Date().toISOString(),
            endDate: sprint.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            goal: sprint.goal || undefined,
          };
        }
      }
    }
    
    // Fallback: return minimal data
    return {
      id: sprintId,
      name: `Sprint ${sprintId}`,
      state: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      goal: undefined,
    };
  }

  /**
   * Fetch all issues in a sprint with assignee, story points, and status
   * @param sprintId - The ID of the sprint
   * @returns Array of issue data
   */
  async getSprintIssues(sprintId: string): Promise<IssueData[]> {
    const issues: IssueData[] = [];
    let startAt = 0;
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      // Use JQL through standard API instead of Agile API
      const jql = `sprint = ${sprintId}`;
      const url = route`/rest/api/3/search/jql?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,assignee,customfield_10016,status,created`;
      const response = await this.makeRequest(url);

      const data = await response.json();

      for (const issue of data.issues) {
        const transitions = await this.getIssueTransitions(issue.key);
        
        issues.push({
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary,
          assignee: issue.fields.assignee?.displayName || null,
          storyPoints: issue.fields.customfield_10016 || null,
          status: issue.fields.status.name,
          statusTransitions: transitions,
          linkedPRs: this.extractPRLinks(issue),
        });
      }

      startAt += data.issues.length;
      hasMore = startAt < data.total;
    }

    return issues;
  }

  /**
   * Fetch status change history for an issue
   * @param issueKey - The issue key (e.g., "PROJ-123")
   * @returns Array of status transitions
   */
  async getIssueTransitions(issueKey: string): Promise<StatusTransition[]> {
    const response = await this.makeRequest(
      route`/rest/api/3/issue/${issueKey}?expand=changelog`
    );

    const data = await response.json();
    const transitions: StatusTransition[] = [];

    if (data.changelog && data.changelog.histories) {
      for (const history of data.changelog.histories) {
        for (const item of history.items) {
          if (item.field === 'status') {
            transitions.push({
              fromStatus: item.fromString,
              toStatus: item.toString,
              timestamp: history.created,
            });
          }
        }
      }
    }

    return transitions;
  }

  /**
   * Fetch past sprint data for trend analysis
   * @param boardId - The board ID to fetch sprints from
   * @param count - Number of historical sprints to fetch
   * @returns Array of historical sprint data
   */
  async getHistoricalSprints(boardId: string, count: number): Promise<SprintData[]> {
    const response = await this.makeRequest(
      route`/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=${count}`
    );

    const data = await response.json();
    const sprints: SprintData[] = [];

    for (const sprint of data.values) {
      sprints.push({
        id: sprint.id.toString(),
        name: sprint.name,
        state: 'closed',
        startDate: sprint.startDate || '',
        endDate: sprint.endDate || '',
        goal: sprint.goal || undefined,
      });
    }

    return sprints;
  }

  /**
   * Make an API request with retry logic and exponential backoff
   * @param url - The API route to call (should be a route template literal)
   * @returns Response object
   */
  private async makeRequest(url: any): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Use asUser() with Forge API v3
        const response = await api.asUser().requestJira(url, {
          headers: {
            'Accept': 'application/json',
          },
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : this.calculateBackoff(attempt);
          
          await this.sleep(waitTime);
          continue;
        }

        // Handle other errors
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Jira API error: ${response.status} ${response.statusText} - ${errorBody}`
          );
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx except 429)
        if (error instanceof Error && error.message.includes('4')) {
          const statusMatch = error.message.match(/(\d{3})/);
          if (statusMatch && statusMatch[1] !== '429') {
            throw error;
          }
        }

        // Wait before retrying
        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.calculateBackoff(attempt));
        }
      }
    }

    throw new Error(
      `Failed to fetch from Jira after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }

  /**
   * Calculate exponential backoff delay
   * @param attempt - Current attempt number
   * @returns Delay in milliseconds
   */
  private calculateBackoff(attempt: number): number {
    return this.INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), ms);
    });
  }

  /**
   * Map Jira sprint state to our internal state type
   * @param state - Jira sprint state string
   * @returns Normalized state
   */
  private mapSprintState(state: string): 'active' | 'closed' | 'future' {
    const normalized = state.toLowerCase();
    if (normalized === 'active') return 'active';
    if (normalized === 'closed') return 'closed';
    return 'future';
  }

  /**
   * Extract PR links from issue data
   * @param _issue - Raw Jira issue object
   * @returns Array of PR URLs or identifiers
   */
  private extractPRLinks(_issue: any): string[] {
    // Check for development information (requires additional API call in real implementation)
    // For now, return empty array as placeholder
    // This will be populated when Bitbucket integration is implemented
    
    return [];
  }
}
