import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { AnalysisOrchestrator } from '../services/AnalysisOrchestrator';
import { StorageService } from '../services/StorageService';

const resolver = new Resolver();

// Declare console for logging
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * Test Handler - Simple test to see if we can access Jira at all
 */
resolver.define('testJiraAccess', async (req) => {
  try {
    console.log('testJiraAccess called');
    
    // Try the simplest possible Jira API call
    const response = await api.asUser().requestJira(route`/rest/api/3/myself`);
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Jira API access works!',
        user: data.displayName,
      };
    } else {
      return {
        success: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
  } catch (error) {
    console.error('Error in testJiraAccess:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Analyze Sprint Handler
 * Backend fetches all data and performs analysis
 */
resolver.define('analyzeSprintHandler', async (req) => {
  try {
    console.log('analyzeSprintHandler called', req.payload);

    const { sprintId, boardId, forceRefresh } = req.payload as {
      sprintId?: string;
      boardId?: string;
      forceRefresh?: boolean;
    };

    if (!sprintId) {
      return {
        success: false,
        error: 'sprintId is required',
      };
    }

    const orchestrator = new AnalysisOrchestrator();
    const report = await orchestrator.analyzeSprint(
      sprintId,
      boardId,
      forceRefresh || false
    );

    return {
      success: true,
      report,
    };
  } catch (error) {
    console.error('Error in analyzeSprintHandler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

/**
 * Get Report Handler
 * Retrieves a cached sprint report if available
 */
resolver.define('getReportHandler', async (req) => {
  try {
    console.log('getReportHandler called', req.payload);

    const { sprintId } = req.payload as {
      sprintId?: string;
    };

    if (!sprintId) {
      return {
        success: false,
        error: 'sprintId is required',
      };
    }

    const storageService = new StorageService();
    const report = await storageService.getReport(sprintId);

    if (!report) {
      return {
        success: false,
        error: 'No cached report found for this sprint',
        notFound: true,
      };
    }

    return {
      success: true,
      report,
    };
  } catch (error) {
    console.error('Error in getReportHandler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

/**
 * Get Historical Data Handler
 * Fetches historical metrics for trend analysis
 */
resolver.define('getHistoricalDataHandler', async (req) => {
  try {
    console.log('getHistoricalDataHandler called', req.payload);

    const { boardId, sprintIds } = req.payload as {
      boardId?: string;
      sprintIds?: string[];
    };

    if (!boardId || !sprintIds || !Array.isArray(sprintIds)) {
      return {
        success: false,
        error: 'boardId and sprintIds (array) are required',
      };
    }

    const storageService = new StorageService();
    const historicalMetrics = await storageService.getHistoricalMetrics(boardId, sprintIds);

    return {
      success: true,
      historicalMetrics,
    };
  } catch (error) {
    console.error('Error in getHistoricalDataHandler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      historicalMetrics: [],
    };
  }
});

/**
 * Get Sprints Handler
 * Fetches available sprints for a board
 */
resolver.define('getSprintsHandler', async (req) => {
  try {
    console.log('getSprintsHandler called', req.payload);

    const { boardId } = req.payload as {
      boardId?: string;
    };

    // Get context
    const context = req.context;
    const projectKey = context?.extension?.project?.key;

    if (!projectKey) {
      return {
        success: false,
        error: 'Project context is required',
      };
    }

    // Query for issues with sprints to discover available sprints
    const jql = `project = "${projectKey}" AND sprint is not EMPTY ORDER BY created DESC`;
    const url = route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=customfield_10020`;
    const response = await api.asUser().requestJira(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch sprints: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Extract unique sprints from the customfield_10020 (sprint field)
    const sprintMap = new Map();
    for (const issue of data.issues || []) {
      const sprintField = issue.fields.customfield_10020;
      if (Array.isArray(sprintField)) {
        for (const sprint of sprintField) {
          if (sprint && sprint.id && !sprintMap.has(sprint.id)) {
            sprintMap.set(sprint.id, {
              id: sprint.id.toString(),
              name: sprint.name || `Sprint ${sprint.id}`,
              state: sprint.state || 'active',
              startDate: sprint.startDate || '',
              endDate: sprint.endDate || '',
            });
          }
        }
      }
    }
    
    const sprints = Array.from(sprintMap.values()).sort((a, b) => {
      // Sort by ID descending (newest first)
      return parseInt(b.id) - parseInt(a.id);
    });

    return {
      success: true,
      sprints,
    };
  } catch (error) {
    console.error('Error in getSprintsHandler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      sprints: [],
    };
  }
});

/**
 * Get Sprint from Issue Handler
 * Gets the sprint ID for a specific issue
 */
resolver.define('getSprintFromIssueHandler', async (req) => {
  try {
    console.log('getSprintFromIssueHandler called', req.payload);

    const context = req.context;
    const issueKey = context?.extension?.issue?.key;

    if (!issueKey) {
      return {
        success: false,
        error: 'Issue context is required',
      };
    }

    // Get issue details including sprint field
    const url = route`/rest/api/3/issue/${issueKey}?fields=sprint`;
    const issueResponse = await api.asUser().requestJira(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!issueResponse.ok) {
      throw new Error(`Failed to fetch issue: ${issueResponse.status}`);
    }

    const issueData = await issueResponse.json();
    const sprint = issueData.fields?.sprint;

    if (!sprint) {
      return {
        success: false,
        error: 'Issue is not assigned to a sprint',
        notFound: true,
      };
    }

    return {
      success: true,
      sprintId: sprint.id.toString(),
      sprintName: sprint.name,
    };
  } catch (error) {
    console.error('Error in getSprintFromIssueHandler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

export const handler = resolver.getDefinitions();

/**
 * Scheduled Analysis Function
 */
export const scheduledAnalysis = async () => {
  try {
    console.log('Scheduled analysis triggered at', new Date().toISOString());

    const orchestrator = new AnalysisOrchestrator();
    const storageService = new StorageService();

    const boardsToMonitor = await getMonitoredBoards();

    if (boardsToMonitor.length === 0) {
      console.log('No boards configured for monitoring');
      return;
    }

    let analyzedCount = 0;
    let errorCount = 0;

    for (const boardConfig of boardsToMonitor) {
      try {
        console.log(`Processing board: ${boardConfig.boardId}`);

        const activeSprints = await getActiveSprintsForBoard(boardConfig.boardId);

        for (const sprint of activeSprints) {
          try {
            console.log(`Analyzing sprint: ${sprint.id} - ${sprint.name}`);

            const existingReport = await storageService.getReport(sprint.id);
            if (existingReport) {
              const reportAge = Date.now() - new Date(existingReport.generatedAt).getTime();
              const oneHour = 60 * 60 * 1000;

              if (reportAge < oneHour) {
                console.log(`Skipping sprint ${sprint.id} - recent analysis exists`);
                continue;
              }
            }

            await orchestrator.analyzeSprint(
              sprint.id,
              boardConfig.boardId,
              false
            );

            console.log(`Successfully analyzed sprint ${sprint.id}`);
            analyzedCount++;
          } catch (sprintError) {
            console.error(`Error analyzing sprint ${sprint.id}:`, sprintError);
            errorCount++;
          }
        }
      } catch (boardError) {
        console.error(`Error processing board ${boardConfig.boardId}:`, boardError);
        errorCount++;
      }
    }

    console.log(
      `Scheduled analysis complete. Analyzed: ${analyzedCount}, Errors: ${errorCount}`
    );
  } catch (error) {
    console.error('Fatal error in scheduled analysis:', error);
  }
};

async function getMonitoredBoards(): Promise<Array<{ boardId: string; name: string }>> {
  return [];
}

async function getActiveSprintsForBoard(
  boardId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const url = route`/rest/agile/1.0/board/${boardId}/sprint?state=active`;
    const response = await api.asUser().requestJira(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch active sprints: ${response.status}`);
    }

    const data = await response.json();
    
    return data.values.map((sprint: any) => ({
      id: sprint.id.toString(),
      name: sprint.name,
    }));
  } catch (error) {
    console.error(`Error fetching active sprints for board ${boardId}:`, error);
    return [];
  }
}
