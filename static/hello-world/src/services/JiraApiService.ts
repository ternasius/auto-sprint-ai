import { requestJira } from '@forge/bridge';

/**
 * JiraApiService - Frontend service for calling Jira APIs directly
 * Uses @forge/bridge to make authenticated API calls from Custom UI
 */
export class JiraApiService {
  /**
   * Fetch sprint details
   */
  async getSprintData(sprintId: string): Promise<any> {
    const response = await requestJira(`/rest/agile/1.0/sprint/${sprintId}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch sprint: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Fetch all issues in a sprint
   */
  async getSprintIssues(sprintId: string): Promise<any[]> {
    const issues: any[] = [];
    let startAt = 0;
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await requestJira(
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,assignee,customfield_10016,status,created`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch issues: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      issues.push(...data.issues);

      startAt += data.issues.length;
      hasMore = startAt < data.total;
    }

    return issues;
  }

  /**
   * Fetch issue status transitions
   */
  async getIssueTransitions(issueKey: string): Promise<any[]> {
    const response = await requestJira(`/rest/api/3/issue/${issueKey}?expand=changelog`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch transitions: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const transitions: any[] = [];

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
   * Fetch sprints for a board
   */
  async getSprints(boardId: string): Promise<any[]> {
    const response = await requestJira(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed&maxResults=50`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch sprints: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.values || [];
  }

  /**
   * Fetch boards for a project
   */
  async getBoards(projectId: string): Promise<any[]> {
    const response = await requestJira(
      `/rest/agile/1.0/board?projectKeyOrId=${projectId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch boards: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.values || [];
  }
}
