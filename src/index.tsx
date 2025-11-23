import Resolver from '@forge/resolver';
import api from '@forge/api';
import { SprintAnalysisPanel } from './components/SprintAnalysisPanel';
import { IssuePanel } from './components/IssuePanel';
import { AnalysisOrchestrator } from './services/AnalysisOrchestrator';
import { StorageService } from './services/StorageService';

const resolver = new Resolver();

// Declare console for logging
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * Analyze Sprint Handler
 * Triggers analysis for a sprint and returns the generated report
 * 
 * Request payload:
 * - sprintId: string (required) - The ID of the sprint to analyze
 * - boardId: string (optional) - The board ID for historical data
 * - forceRefresh: boolean (optional) - Force refresh cache (default: false)
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1
 */
resolver.define('analyzeSprintHandler', async (req) => {
  try {
    console.log('analyzeSprintHandler called', req.payload);

    const { sprintId, boardId, forceRefresh } = req.payload as {
      sprintId?: string;
      boardId?: string;
      forceRefresh?: boolean;
    };

    // Validate required parameters
    if (!sprintId) {
      return {
        success: false,
        error: 'sprintId is required',
      };
    }

    // Create orchestrator and analyze sprint
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
 * 
 * Request payload:
 * - sprintId: string (required) - The ID of the sprint
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1
 */
resolver.define('getReportHandler', async (req) => {
  try {
    console.log('getReportHandler called', req.payload);

    const { sprintId } = req.payload as {
      sprintId?: string;
    };

    // Validate required parameters
    if (!sprintId) {
      return {
        success: false,
        error: 'sprintId is required',
      };
    }

    // Get cached report from storage
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
 * 
 * Request payload:
 * - boardId: string (required) - The board ID
 * - sprintIds: string[] (required) - Array of sprint IDs to retrieve metrics for
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1
 */
resolver.define('getHistoricalDataHandler', async (req) => {
  try {
    console.log('getHistoricalDataHandler called', req.payload);

    const { boardId, sprintIds } = req.payload as {
      boardId?: string;
      sprintIds?: string[];
    };

    // Validate required parameters
    if (!boardId || !sprintIds || !Array.isArray(sprintIds)) {
      return {
        success: false,
        error: 'boardId and sprintIds (array) are required',
      };
    }

    // Get historical metrics from storage
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

export const handler = resolver.getDefinitions();

/**
 * Scheduled Analysis Function
 * Runs daily to analyze active sprints and cache results for quick access
 * 
 * This function:
 * 1. Fetches all active sprints from configured boards
 * 2. Analyzes each active sprint
 * 3. Stores results in cache for quick retrieval
 * 
 * Requirements: 3.4
 */
export const scheduledAnalysis = async () => {
  try {
    console.log('Scheduled analysis triggered at', new Date().toISOString());

    // Note: In a production implementation, you would:
    // 1. Fetch a list of boards to monitor (from app configuration or storage)
    // 2. For each board, get active sprints
    // 3. Analyze each active sprint
    // 4. Store results in cache
    
    // For now, this is a placeholder implementation that demonstrates the pattern
    // The actual board IDs would come from app configuration
    
    const orchestrator = new AnalysisOrchestrator();
    const storageService = new StorageService();

    // Example: Get list of boards to monitor from storage
    // In a real implementation, this would be configured by the user
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

        // Get active sprints for this board
        const activeSprints = await getActiveSprintsForBoard(boardConfig.boardId);

        for (const sprint of activeSprints) {
          try {
            console.log(`Analyzing sprint: ${sprint.id} - ${sprint.name}`);

            // Check if we already have a recent analysis (within last hour)
            const existingReport = await storageService.getReport(sprint.id);
            if (existingReport) {
              const reportAge = Date.now() - new Date(existingReport.generatedAt).getTime();
              const oneHour = 60 * 60 * 1000;

              if (reportAge < oneHour) {
                console.log(`Skipping sprint ${sprint.id} - recent analysis exists`);
                continue;
              }
            }

            // Analyze the sprint
            await orchestrator.analyzeSprint(
              sprint.id,
              boardConfig.boardId,
              false // Don't force refresh, use cache where available
            );

            console.log(`Successfully analyzed sprint ${sprint.id}`);
            analyzedCount++;

            // Report is automatically cached by the orchestrator
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

/**
 * Get list of boards configured for monitoring
 * In a production implementation, this would read from app configuration
 * @returns Array of board configurations
 */
async function getMonitoredBoards(): Promise<Array<{ boardId: string; name: string }>> {
  // Placeholder implementation
  // In production, this would read from Forge storage or app configuration
  // For now, return empty array to prevent errors
  
  // Example of what this might return:
  // return [
  //   { boardId: '1', name: 'Engineering Board' },
  //   { boardId: '2', name: 'Product Board' },
  // ];
  
  return [];
}

/**
 * Get active sprints for a specific board
 * @param boardId - The board ID
 * @returns Array of active sprint data
 */
async function getActiveSprintsForBoard(
  boardId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await api.asUser().requestJira(
      `/rest/agile/1.0/board/${boardId}/sprint?state=active` as any,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

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

// Export UI components for Forge modules
export { SprintAnalysisPanel, IssuePanel };
export { SprintReportMacro } from './components/SprintReportMacro';
