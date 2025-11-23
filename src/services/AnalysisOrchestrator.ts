import {
  SprintData,
  IssueData,
  PullRequestData,
  SprintMetrics,
  PRMetrics,
  HistoricalMetrics,
  NextSprintSuggestions,
  SprintReport,
} from '../types';
import { JiraDataCollector } from './JiraDataCollector';
import { BitbucketDataCollector } from './BitbucketDataCollector';
import { MetricsCalculator } from './MetricsCalculator';
import { RiskAssessor } from './RiskAssessor';
import { PredictionEngine } from './PredictionEngine';
import { RecommendationGenerator } from './RecommendationGenerator';
import { ReportGenerator } from './ReportGenerator';
import { StorageService } from './StorageService';

// Declare console for logging
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

/**
 * AnalysisOrchestrator - Main orchestration class for sprint analysis
 * 
 * This class coordinates the entire analysis workflow:
 * 1. Data collection from Jira and Bitbucket (with caching)
 * 2. Metrics calculation
 * 3. Risk assessment
 * 4. Spillover prediction
 * 5. Recommendation generation
 * 6. Report generation
 * 
 * Implements error handling, fallback behavior, and caching optimization.
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1, 9.5
 */
export class AnalysisOrchestrator {
  private jiraCollector: JiraDataCollector;
  private bitbucketCollector: BitbucketDataCollector;
  private metricsCalculator: MetricsCalculator;
  private riskAssessor: RiskAssessor;
  private predictionEngine: PredictionEngine;
  private recommendationGenerator: RecommendationGenerator;
  private reportGenerator: ReportGenerator;
  private storageService: StorageService;

  constructor() {
    this.jiraCollector = new JiraDataCollector();
    this.bitbucketCollector = new BitbucketDataCollector();
    this.metricsCalculator = new MetricsCalculator();
    this.riskAssessor = new RiskAssessor();
    this.predictionEngine = new PredictionEngine();
    this.recommendationGenerator = new RecommendationGenerator();
    this.reportGenerator = new ReportGenerator();
    this.storageService = new StorageService();
  }

  /**
   * Analyze a sprint and generate a comprehensive report
   * @param sprintId - The ID of the sprint to analyze
   * @param boardId - Optional board ID for historical data
   * @param forceRefresh - Force refresh cache (default: false)
   * @returns Complete sprint report
   */
  async analyzeSprint(
    sprintId: string,
    boardId?: string,
    forceRefresh: boolean = false
  ): Promise<SprintReport> {
    try {
      console.log(`Starting analysis for sprint ${sprintId}`);

      // Step 1: Check cache for existing report (unless force refresh)
      if (!forceRefresh) {
        const cachedReport = await this.getCachedReport(sprintId);
        if (cachedReport) {
          console.log('Returning cached report');
          return cachedReport;
        }
      }

      // Step 2: Collect data from Jira and Bitbucket (with caching and parallel fetching)
      const { sprint, issues, prs, historicalMetrics } = await this.collectData(
        sprintId,
        boardId,
        forceRefresh
      );

      // Step 3: Calculate metrics
      console.log('Calculating metrics');
      const sprintMetrics = this.metricsCalculator.calculateSprintMetrics(issues, sprint);
      const prMetrics = this.metricsCalculator.calculatePRMetrics(prs);
      const bottlenecks = this.metricsCalculator.identifyBottlenecks(issues);

      // Step 4: Assess risk
      console.log('Assessing risk');
      const riskAssessment = this.riskAssessor.assessSprintRisk(
        sprintMetrics,
        prMetrics,
        historicalMetrics || undefined,
        issues,
        prs
      );

      // Step 5: Predict spillover (only for active sprints)
      if (sprint.state === 'active') {
        console.log('Predicting spillover');
        const spilloverPredictions = this.predictionEngine.predictSpillover(
          issues,
          sprint,
          new Date(),
          sprintMetrics
        );

        // Log spillover predictions for visibility
        if (spilloverPredictions.length > 0) {
          console.log(`Identified ${spilloverPredictions.length} issues at risk of spillover`);
        }
      }

      // Step 6: Generate recommendations
      console.log('Generating recommendations');
      const recommendations = this.recommendationGenerator.generateRecommendations(
        riskAssessment,
        sprintMetrics,
        prMetrics,
        issues,
        prs,
        bottlenecks
      );

      // Step 7: Generate next sprint suggestions (if historical data available)
      let nextSprintSuggestions: NextSprintSuggestions | undefined;
      if (historicalMetrics) {
        console.log('Generating next sprint suggestions');
        nextSprintSuggestions = this.recommendationGenerator.generateNextSprintSuggestions(
          sprintMetrics,
          historicalMetrics,
          riskAssessment,
          issues,
          prs
        );
      }

      // Step 8: Generate final report
      console.log('Generating report');
      const report = this.reportGenerator.generateReport(
        sprint,
        sprintMetrics,
        prMetrics,
        riskAssessment,
        recommendations,
        issues,
        prs,
        bottlenecks,
        nextSprintSuggestions
      );

      // Step 9: Cache the report
      await this.cacheReport(sprintId, report);

      // Step 10: Store historical metrics for closed sprints
      if (sprint.state === 'closed') {
        await this.storeHistoricalMetrics(sprint, sprintMetrics, prMetrics);
      }

      console.log('Analysis complete');
      return report;

    } catch (error) {
      console.error('Error during sprint analysis:', error);
      return this.handleAnalysisError(error, sprintId);
    }
  }

  /**
   * Collect data from Jira and Bitbucket with caching and parallel fetching
   * @param sprintId - Sprint ID
   * @param boardId - Optional board ID
   * @param forceRefresh - Force refresh cache
   * @returns Collected data
   */
  private async collectData(
    sprintId: string,
    boardId?: string,
    forceRefresh: boolean = false
  ): Promise<{
    sprint: SprintData;
    issues: IssueData[];
    prs: PullRequestData[];
    historicalMetrics: HistoricalMetrics | null;
  }> {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedSprintData = await this.storageService.getCachedSprintData(sprintId);
      const cachedPRData = await this.storageService.getCachedPRData(sprintId);

      if (cachedSprintData && cachedPRData) {
        console.log('Using cached data');
        const historicalMetrics = boardId 
          ? await this.getHistoricalMetrics(boardId, sprintId)
          : null;

        return {
          sprint: cachedSprintData.sprint,
          issues: cachedSprintData.issues,
          prs: cachedPRData,
          historicalMetrics,
        };
      }
    }

    // Fetch data in parallel for optimization
    console.log('Fetching data from Jira and Bitbucket');
    
    const [sprintData, historicalMetrics] = await Promise.all([
      this.fetchJiraData(sprintId),
      boardId ? this.getHistoricalMetrics(boardId, sprintId) : Promise.resolve(null),
    ]);

    const { sprint, issues } = sprintData;

    // Fetch PR data (with fallback if Bitbucket unavailable)
    const prs = await this.fetchBitbucketData(issues);

    // Cache the collected data
    await Promise.all([
      this.storageService.cacheSprintData(sprintId, { sprint, issues }),
      this.storageService.cachePRData(sprintId, prs),
    ]);

    return { sprint, issues, prs, historicalMetrics };
  }

  /**
   * Fetch sprint and issue data from Jira
   * @param sprintId - Sprint ID
   * @returns Sprint and issues data
   */
  private async fetchJiraData(sprintId: string): Promise<{
    sprint: SprintData;
    issues: IssueData[];
  }> {
    try {
      // Fetch sprint data and issues in parallel
      const [sprint, issues] = await Promise.all([
        this.jiraCollector.getSprintData(sprintId),
        this.jiraCollector.getSprintIssues(sprintId),
      ]);

      return { sprint, issues };
    } catch (error) {
      console.error('Error fetching Jira data:', error);
      throw new Error(`Failed to fetch sprint data from Jira: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch PR data from Bitbucket with fallback
   * @param issues - Issue data
   * @returns PR data (empty array if Bitbucket unavailable)
   */
  private async fetchBitbucketData(issues: IssueData[]): Promise<PullRequestData[]> {
    try {
      // Extract issue keys for batch fetching
      const issueKeys = issues.map(issue => issue.key);

      // Batch fetch PRs for all issues
      const prs = await this.bitbucketCollector.getPullRequestsForSprint(issueKeys);

      return prs;
    } catch (error) {
      console.warn('Bitbucket data unavailable, continuing with Jira-only analysis:', error);
      // Graceful degradation: continue without PR data
      return [];
    }
  }

  /**
   * Get historical metrics for trend analysis
   * @param boardId - Board ID
   * @param currentSprintId - Current sprint ID (to exclude from historical data)
   * @returns Historical metrics or null
   */
  private async getHistoricalMetrics(
    boardId: string,
    currentSprintId: string
  ): Promise<HistoricalMetrics | null> {
    try {
      // Fetch recent closed sprints
      const historicalSprints = await this.jiraCollector.getHistoricalSprints(boardId, 5);

      // Filter out current sprint and get metrics for the most recent closed sprint
      const pastSprints = historicalSprints.filter(s => s.id !== currentSprintId);

      if (pastSprints.length === 0) {
        return null;
      }

      // Try to get cached historical metrics for the most recent sprint
      const mostRecentSprint = pastSprints[0];
      const historicalMetric = await this.storageService.getHistoricalMetric(mostRecentSprint.id);

      return historicalMetric;
    } catch (error) {
      console.warn('Could not fetch historical metrics:', error);
      return null;
    }
  }

  /**
   * Get cached report if available and valid
   * @param sprintId - Sprint ID
   * @returns Cached report or null
   */
  private async getCachedReport(sprintId: string): Promise<SprintReport | null> {
    try {
      return await this.storageService.getReport(sprintId);
    } catch (error) {
      console.warn('Error retrieving cached report:', error);
      return null;
    }
  }

  /**
   * Cache the generated report
   * @param sprintId - Sprint ID
   * @param report - Sprint report
   */
  private async cacheReport(sprintId: string, report: SprintReport): Promise<void> {
    try {
      await this.storageService.storeReport(sprintId, report);
    } catch (error) {
      console.error('Error caching report:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Store historical metrics for closed sprints
   * @param sprint - Sprint data
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   */
  private async storeHistoricalMetrics(
    sprint: SprintData,
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics
  ): Promise<void> {
    try {
      await this.storageService.storeHistoricalMetrics(
        sprint.id,
        sprint.name,
        sprint.endDate,
        sprintMetrics,
        prMetrics
      );
    } catch (error) {
      console.error('Error storing historical metrics:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Handle analysis errors with fallback behavior
   * @param error - Error object
   * @param sprintId - Sprint ID
   * @returns Fallback report
   */
  private handleAnalysisError(error: unknown, sprintId: string): SprintReport {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    console.error(`Analysis failed for sprint ${sprintId}:`, errorMessage);

    // Return a minimal error report
    return {
      summary: `Analysis failed for sprint ${sprintId}. ${errorMessage}`,
      keyFindings: [
        'Unable to complete analysis due to an error.',
        'Please check system logs for details.',
        'Try refreshing the analysis or contact support if the issue persists.',
      ],
      riskAssessment: {
        level: 'High',
        justification: 'Analysis could not be completed due to system error.',
      },
      recommendations: [
        {
          priority: 1,
          category: 'PROCESS',
          title: 'Retry analysis',
          description: 'Click the refresh button to retry the analysis. If the issue persists, contact your system administrator.',
          impact: 'High',
        },
      ],
      metrics: {
        sprint: {
          cycleTime: 0,
          leadTime: 0,
          throughput: 0,
          velocity: 0,
          wipCount: 0,
          carryOverCount: 0,
          completionRate: 0,
        },
        pullRequests: {
          averageLatency: 0,
          averageTimeToFirstReview: 0,
          averageReviewCycles: 0,
          averageRevisions: 0,
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Invalidate cache for a sprint (useful when data is updated)
   * @param sprintId - Sprint ID
   */
  async invalidateCache(sprintId: string): Promise<void> {
    try {
      await this.storageService.invalidateSprintCache(sprintId);
      console.log(`Cache invalidated for sprint ${sprintId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Get analysis status (useful for UI loading states)
   * @param sprintId - Sprint ID
   * @returns Status information
   */
  async getAnalysisStatus(sprintId: string): Promise<{
    hasCachedReport: boolean;
    hasCachedData: boolean;
    lastAnalyzed: string | null;
  }> {
    try {
      const cachedReport = await this.storageService.getReport(sprintId);
      const cachedSprintData = await this.storageService.getCachedSprintData(sprintId);

      return {
        hasCachedReport: cachedReport !== null,
        hasCachedData: cachedSprintData !== null,
        lastAnalyzed: cachedReport?.generatedAt || null,
      };
    } catch (error) {
      console.error('Error checking analysis status:', error);
      return {
        hasCachedReport: false,
        hasCachedData: false,
        lastAnalyzed: null,
      };
    }
  }
}
