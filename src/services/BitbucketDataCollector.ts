import api, { route } from '@forge/api';
import { PullRequestData, ReviewerData } from '../types';

// Declare global functions for Node.js environment
declare const setTimeout: (callback: () => void, ms: number) => any;
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * BitbucketDataCollector - Service for collecting pull request data from Bitbucket
 * 
 * This class handles all interactions with the Bitbucket REST API v2, including:
 * - Fetching pull requests linked to Jira issues
 * - Retrieving PR metadata (creation time, review time, merge time)
 * - Collecting reviewer information and workload
 * - Tracking PR revisions and review cycles
 * 
 * All API calls use Forge's asUser context for authentication.
 * Implements graceful degradation when Bitbucket data is unavailable.
 */
export class BitbucketDataCollector {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_MS = 1000;
  private bitbucketAvailable: boolean = true;

  /**
   * Fetch pull requests linked to a specific Jira issue
   * @param issueKey - The Jira issue key (e.g., "PROJ-123")
   * @returns Array of pull request data
   */
  async getPullRequestsForIssue(issueKey: string): Promise<PullRequestData[]> {
    if (!this.bitbucketAvailable) {
      return [];
    }

    try {
      // First, get the development information from Jira for this issue
      const url = route`/rest/dev-status/1.0/issue/detail?issueId=${issueKey}&applicationType=bitbucket&dataType=pullrequest`;
      const devInfoResponse = await this.makeJiraRequest(url);

      if (!devInfoResponse) {
        return [];
      }

      const devInfo = await devInfoResponse.json();
      const pullRequests: PullRequestData[] = [];

      // Extract PR details from development information
      if (devInfo.detail && devInfo.detail.length > 0) {
        for (const detail of devInfo.detail) {
          if (detail.pullRequests) {
            for (const pr of detail.pullRequests) {
              const prData = await this.fetchPullRequestDetails(pr);
              if (prData) {
                pullRequests.push(prData);
              }
            }
          }
        }
      }

      return pullRequests;
    } catch (error) {
      console.error(`Error fetching PRs for issue ${issueKey}:`, error);
      this.bitbucketAvailable = false;
      return [];
    }
  }

  /**
   * Batch fetch pull requests for all issues in a sprint
   * @param issueKeys - Array of Jira issue keys
   * @returns Array of pull request data
   */
  async getPullRequestsForSprint(issueKeys: string[]): Promise<PullRequestData[]> {
    if (!this.bitbucketAvailable) {
      return [];
    }

    const allPRs: PullRequestData[] = [];
    const seenPRIds = new Set<string>();

    // Fetch PRs for each issue (with some parallelization)
    const batchSize = 5;
    for (let i = 0; i < issueKeys.length; i += batchSize) {
      const batch = issueKeys.slice(i, i + batchSize);
      const batchPromises = batch.map(issueKey => 
        this.getPullRequestsForIssue(issueKey)
      );

      const batchResults = await Promise.all(batchPromises);

      for (const prs of batchResults) {
        for (const pr of prs) {
          // Deduplicate PRs (same PR can be linked to multiple issues)
          if (!seenPRIds.has(pr.id)) {
            seenPRIds.add(pr.id);
            allPRs.push(pr);
          }
        }
      }
    }

    return allPRs;
  }

  /**
   * Get the number of active PRs assigned to a reviewer
   * @param reviewerUsername - The reviewer's username
   * @returns Count of active PRs
   */
  async getReviewerWorkload(reviewerUsername: string): Promise<number> {
    if (!this.bitbucketAvailable) {
      return 0;
    }

    try {
      // Query Bitbucket for PRs where this user is a reviewer
      // Note: This requires workspace and repository information
      // In a real implementation, we'd need to track which repos are relevant
      // For now, we'll return 0 as a placeholder
      // This would typically query: /2.0/pullrequests/{username}
      
      return 0;
    } catch (error) {
      console.error(`Error fetching reviewer workload for ${reviewerUsername}:`, error);
      return 0;
    }
  }

  /**
   * Fetch detailed PR information from Bitbucket API
   * @param prSummary - Summary PR object from Jira dev info
   * @returns Detailed pull request data
   */
  private async fetchPullRequestDetails(prSummary: any): Promise<PullRequestData | null> {
    try {
      // Extract repository and PR ID from the PR URL
      const prUrl = prSummary.url;
      const prId = prSummary.id;
      
      // Parse Bitbucket URL to get workspace, repo, and PR number
      // URL format: https://bitbucket.org/{workspace}/{repo}/pull-requests/{pr_number}
      const urlMatch = prUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/);
      
      if (!urlMatch) {
        console.warn(`Could not parse Bitbucket URL: ${prUrl}`);
        return this.createPRDataFromSummary(prSummary);
      }

      const [, workspace, repo, prNumber] = urlMatch;

      // Fetch detailed PR information from Bitbucket API
      const url = route`/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}`;
      const prResponse = await this.makeBitbucketRequest(url);

      if (!prResponse) {
        return this.createPRDataFromSummary(prSummary);
      }

      const prDetail = await prResponse.json();

      // Fetch PR activity to get review information
      const activityUrl = route`/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}/activity`;
      const activityResponse = await this.makeBitbucketRequest(activityUrl);

      const activity = activityResponse ? await activityResponse.json() : null;

      // Extract reviewer information
      const reviewers = await this.extractReviewerData(prDetail, activity);

      // Calculate first review time
      const firstReviewAt = this.calculateFirstReviewTime(activity);

      // Count revisions (commits after PR creation)
      const revisionCount = await this.countRevisions(workspace, repo, prNumber, prDetail.created_on);

      return {
        id: prId,
        title: prDetail.title,
        author: prDetail.author?.display_name || prDetail.author?.username || 'Unknown',
        createdAt: prDetail.created_on,
        firstReviewAt,
        mergedAt: prDetail.merge_commit ? prDetail.updated_on : null,
        state: this.mapPRState(prDetail.state),
        reviewers,
        revisionCount,
        linkedIssues: this.extractLinkedIssues(prDetail),
      };
    } catch (error) {
      console.error('Error fetching PR details:', error);
      return this.createPRDataFromSummary(prSummary);
    }
  }

  /**
   * Create PR data from Jira dev info summary (fallback)
   * @param prSummary - Summary PR object from Jira
   * @returns Basic pull request data
   */
  private createPRDataFromSummary(prSummary: any): PullRequestData {
    return {
      id: prSummary.id,
      title: prSummary.name || 'Unknown',
      author: prSummary.author?.name || 'Unknown',
      createdAt: prSummary.lastUpdate || new Date().toISOString(),
      firstReviewAt: null,
      mergedAt: prSummary.status === 'MERGED' ? prSummary.lastUpdate : null,
      state: this.mapPRState(prSummary.status),
      reviewers: [],
      revisionCount: 0,
      linkedIssues: [],
    };
  }

  /**
   * Extract reviewer data from PR details and activity
   * @param prDetail - Detailed PR object
   * @param activity - PR activity data
   * @returns Array of reviewer data
   */
  private async extractReviewerData(prDetail: any, activity: any): Promise<ReviewerData[]> {
    const reviewerMap = new Map<string, ReviewerData>();

    // Get reviewers from PR participants
    if (prDetail.participants) {
      for (const participant of prDetail.participants) {
        if (participant.role === 'REVIEWER') {
          const username = participant.user?.username || participant.user?.display_name || 'Unknown';
          reviewerMap.set(username, {
            username,
            approvedAt: participant.approved ? prDetail.updated_on : null,
            commentCount: 0,
          });
        }
      }
    }

    // Count comments from activity
    if (activity && activity.values) {
      for (const item of activity.values) {
        if (item.comment) {
          const username = item.comment.user?.username || item.comment.user?.display_name;
          if (username && reviewerMap.has(username)) {
            const reviewer = reviewerMap.get(username)!;
            reviewer.commentCount++;
          }
        }
      }
    }

    return Array.from(reviewerMap.values());
  }

  /**
   * Calculate the time of first review activity
   * @param activity - PR activity data
   * @returns ISO timestamp of first review or null
   */
  private calculateFirstReviewTime(activity: any): string | null {
    if (!activity || !activity.values) {
      return null;
    }

    let firstReviewTime: string | null = null;

    for (const item of activity.values) {
      // Look for first comment or approval
      if (item.comment || item.approval) {
        const timestamp = item.comment?.created_on || item.approval?.date;
        if (timestamp && (!firstReviewTime || timestamp < firstReviewTime)) {
          firstReviewTime = timestamp;
        }
      }
    }

    return firstReviewTime;
  }

  /**
   * Count the number of revisions (commits) after PR creation
   * @param workspace - Bitbucket workspace
   * @param repo - Repository name
   * @param prNumber - PR number
   * @param createdAt - PR creation timestamp
   * @returns Number of revisions
   */
  private async countRevisions(
    workspace: string,
    repo: string,
    prNumber: string,
    createdAt: string
  ): Promise<number> {
    try {
      const url = route`/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}/commits`;
      const commitsResponse = await this.makeBitbucketRequest(url);

      if (!commitsResponse) {
        return 0;
      }

      const commits = await commitsResponse.json();
      
      // Count commits after PR creation
      if (commits.values) {
        return commits.values.filter((commit: any) => 
          commit.date > createdAt
        ).length;
      }

      return 0;
    } catch (error) {
      console.error('Error counting revisions:', error);
      return 0;
    }
  }

  /**
   * Extract linked Jira issues from PR description
   * @param prDetail - Detailed PR object
   * @returns Array of issue keys
   */
  private extractLinkedIssues(prDetail: any): string[] {
    const issues: string[] = [];
    const description = prDetail.description || '';
    
    // Match Jira issue keys (e.g., PROJ-123)
    const issuePattern = /([A-Z]+-\d+)/g;
    const matches = description.match(issuePattern);
    
    if (matches) {
      issues.push(...matches);
    }

    return issues;
  }

  /**
   * Map Bitbucket PR state to our internal state type
   * @param state - Bitbucket PR state string
   * @returns Normalized state
   */
  private mapPRState(state: string): 'OPEN' | 'MERGED' | 'DECLINED' {
    const normalized = state.toUpperCase();
    if (normalized === 'MERGED') return 'MERGED';
    if (normalized === 'DECLINED' || normalized === 'SUPERSEDED') return 'DECLINED';
    return 'OPEN';
  }

  /**
   * Make a request to Jira API (for dev info)
   * @param url - The API route to call
   * @returns Response object or null on error
   */
  private async makeJiraRequest(url: any): Promise<any | null> {
    try {
      const response = await api.asUser().requestJira(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Dev info not available for this issue
          return null;
        }
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error('Error making Jira request:', error);
      return null;
    }
  }

  /**
   * Make a request to Bitbucket API with retry logic and exponential backoff
   * @param path - The API path to call (without base URL)
   * @returns Response object or null on error
   */
  private async makeBitbucketRequest(path: any): Promise<any | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await api.asUser().requestBitbucket(path, {
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

        // Handle not found (repo might not exist or no access)
        if (response.status === 404) {
          return null;
        }

        // Handle other errors
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Bitbucket API error: ${response.status} ${response.statusText} - ${errorBody}`
          );
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx except 429)
        if (error instanceof Error && error.message.includes('4')) {
          const statusMatch = error.message.match(/(\d{3})/);
          if (statusMatch && statusMatch[1] !== '429') {
            console.warn(`Bitbucket API client error: ${error.message}`);
            return null;
          }
        }

        // Wait before retrying
        if (attempt < this.MAX_RETRIES - 1) {
          await this.sleep(this.calculateBackoff(attempt));
        }
      }
    }

    console.error(
      `Failed to fetch from Bitbucket after ${this.MAX_RETRIES} attempts: ${lastError?.message}`
    );
    this.bitbucketAvailable = false;
    return null;
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
   * Check if Bitbucket integration is currently available
   * @returns True if Bitbucket API is accessible
   */
  public isBitbucketAvailable(): boolean {
    return this.bitbucketAvailable;
  }

  /**
   * Reset Bitbucket availability flag (useful for retry scenarios)
   */
  public resetAvailability(): void {
    this.bitbucketAvailable = true;
  }
}
