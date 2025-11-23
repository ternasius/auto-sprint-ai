import { AnalysisOrchestrator } from '../AnalysisOrchestrator';
import { JiraDataCollector } from '../JiraDataCollector';
import { BitbucketDataCollector } from '../BitbucketDataCollector';
import { StorageService } from '../StorageService';
import {
  SprintData,
  IssueData,
  PullRequestData,
  SprintReport,
  HistoricalMetrics,
} from '../../types';

// Mock all service dependencies
jest.mock('../JiraDataCollector');
jest.mock('../BitbucketDataCollector');
jest.mock('../StorageService');

describe('AnalysisOrchestrator - Integration Tests', () => {
  let orchestrator: AnalysisOrchestrator;
  let mockJiraCollector: jest.Mocked<JiraDataCollector>;
  let mockBitbucketCollector: jest.Mocked<BitbucketDataCollector>;
  let mockStorageService: jest.Mocked<StorageService>;

  // Mock data
  const mockSprint: SprintData = {
    id: 'sprint-1',
    name: 'Sprint 1',
    state: 'active',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-01-15T00:00:00Z',
    goal: 'Complete user authentication',
  };

  const mockIssues: IssueData[] = [
    {
      id: '1',
      key: 'PROJ-1',
      summary: 'Implement login',
      assignee: 'John Doe',
      storyPoints: 5,
      status: 'Done',
      statusTransitions: [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
        { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-02T18:00:00Z' },
      ],
      linkedPRs: ['pr-1'],
    },
    {
      id: '2',
      key: 'PROJ-2',
      summary: 'Add password reset',
      assignee: 'Jane Smith',
      storyPoints: 3,
      status: 'In Progress',
      statusTransitions: [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-03T10:00:00Z' },
      ],
      linkedPRs: [],
    },
    {
      id: '3',
      key: 'PROJ-3',
      summary: 'Setup OAuth',
      assignee: 'Bob Johnson',
      storyPoints: 8,
      status: 'To Do',
      statusTransitions: [],
      linkedPRs: [],
    },
  ];

  const mockPRs: PullRequestData[] = [
    {
      id: 'pr-1',
      title: 'Implement login feature',
      author: 'John Doe',
      createdAt: '2024-01-02T11:00:00Z',
      firstReviewAt: '2024-01-02T13:00:00Z',
      mergedAt: '2024-01-02T17:00:00Z',
      state: 'MERGED',
      reviewers: [
        { username: 'Jane Smith', approvedAt: '2024-01-02T15:00:00Z', commentCount: 2 },
      ],
      revisionCount: 1,
      linkedIssues: ['PROJ-1'],
    },
  ];

  const mockHistoricalMetrics: HistoricalMetrics = {
    sprintId: 'sprint-0',
    sprintName: 'Sprint 0',
    completedAt: '2023-12-31T00:00:00Z',
    metrics: {
      cycleTime: 10,
      leadTime: 20,
      throughput: 5,
      velocity: 20,
      wipCount: 2,
      carryOverCount: 1,
      completionRate: 80,
    },
    prMetrics: {
      averageLatency: 6,
      averageTimeToFirstReview: 2,
      averageReviewCycles: 1.5,
      averageRevisions: 1.2,
    },
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create orchestrator instance
    orchestrator = new AnalysisOrchestrator();

    // Get mocked instances
    mockJiraCollector = (orchestrator as any).jiraCollector as jest.Mocked<JiraDataCollector>;
    mockBitbucketCollector = (orchestrator as any).bitbucketCollector as jest.Mocked<BitbucketDataCollector>;
    mockStorageService = (orchestrator as any).storageService as jest.Mocked<StorageService>;

    // Setup default mock implementations
    mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(mockSprint);
    mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(mockIssues);
    mockJiraCollector.getHistoricalSprints = jest.fn().mockResolvedValue([]);

    mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(mockPRs);

    mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue(null);
    mockStorageService.getCachedPRData = jest.fn().mockResolvedValue(null);
    mockStorageService.getReport = jest.fn().mockResolvedValue(null);
    mockStorageService.getHistoricalMetric = jest.fn().mockResolvedValue(null);
    mockStorageService.cacheSprintData = jest.fn().mockResolvedValue(undefined);
    mockStorageService.cachePRData = jest.fn().mockResolvedValue(undefined);
    mockStorageService.storeReport = jest.fn().mockResolvedValue(undefined);
    mockStorageService.storeHistoricalMetrics = jest.fn().mockResolvedValue(undefined);
  });

  describe('End-to-End Analysis Flow', () => {
    it('should complete full analysis from data collection to report generation', async () => {
      const report = await orchestrator.analyzeSprint('sprint-1');

      // Verify data collection
      expect(mockJiraCollector.getSprintData).toHaveBeenCalledWith('sprint-1');
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalledWith('sprint-1');
      expect(mockBitbucketCollector.getPullRequestsForSprint).toHaveBeenCalled();

      // Verify caching
      expect(mockStorageService.cacheSprintData).toHaveBeenCalled();
      expect(mockStorageService.cachePRData).toHaveBeenCalled();
      expect(mockStorageService.storeReport).toHaveBeenCalled();

      // Verify report structure
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.keyFindings).toBeInstanceOf(Array);
      expect(report.riskAssessment).toBeDefined();
      expect(report.riskAssessment.level).toMatch(/Low|Medium|High/);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.metrics).toBeDefined();
      expect(report.metrics.sprint).toBeDefined();
      expect(report.metrics.pullRequests).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it('should calculate metrics correctly', async () => {
      const report = await orchestrator.analyzeSprint('sprint-1');

      // Verify sprint metrics
      expect(report.metrics.sprint.throughput).toBe(1); // 1 completed issue
      expect(report.metrics.sprint.velocity).toBe(5); // 5 story points
      expect(report.metrics.sprint.wipCount).toBe(1); // 1 in progress
      expect(report.metrics.sprint.completionRate).toBeCloseTo(33.33, 1);

      // Verify PR metrics
      expect(report.metrics.pullRequests.averageLatency).toBe(6); // 6 hours
      expect(report.metrics.pullRequests.averageTimeToFirstReview).toBe(2); // 2 hours
    });

    it('should generate recommendations based on analysis', async () => {
      const report = await orchestrator.analyzeSprint('sprint-1');

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeLessThanOrEqual(7);

      // Verify recommendation structure
      const firstRec = report.recommendations[0];
      expect(firstRec.priority).toBeDefined();
      expect(firstRec.category).toMatch(/SCOPE|REVIEWER|WIP|PROCESS|PLANNING/);
      expect(firstRec.title).toBeDefined();
      expect(firstRec.description).toBeDefined();
      expect(firstRec.impact).toMatch(/High|Medium|Low/);
    });

    it('should include next sprint suggestions when historical data available', async () => {
      // Mock historical data
      mockJiraCollector.getHistoricalSprints = jest.fn().mockResolvedValue([
        { id: 'sprint-0', name: 'Sprint 0', state: 'closed', startDate: '2023-12-15T00:00:00Z', endDate: '2023-12-31T00:00:00Z' },
      ]);
      mockStorageService.getHistoricalMetric = jest.fn().mockResolvedValue(mockHistoricalMetrics);

      const report = await orchestrator.analyzeSprint('sprint-1', 'board-1');

      expect(report.nextSprintSuggestions).toBeDefined();
      expect(report.nextSprintSuggestions?.targetStoryPoints).toBeGreaterThan(0);
      expect(report.nextSprintSuggestions?.tasksToInclude).toBeInstanceOf(Array);
      expect(report.nextSprintSuggestions?.tasksToPostpone).toBeInstanceOf(Array);
      expect(report.nextSprintSuggestions?.reviewerAssignments).toBeInstanceOf(Array);
    });
  });

  describe('Caching and Optimization', () => {
    it('should use cached data when available', async () => {
      // Setup cached data
      mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue({
        sprint: mockSprint,
        issues: mockIssues,
      });
      mockStorageService.getCachedPRData = jest.fn().mockResolvedValue(mockPRs);

      await orchestrator.analyzeSprint('sprint-1');

      // Verify cache was checked
      expect(mockStorageService.getCachedSprintData).toHaveBeenCalledWith('sprint-1');
      expect(mockStorageService.getCachedPRData).toHaveBeenCalledWith('sprint-1');

      // Verify API calls were NOT made
      expect(mockJiraCollector.getSprintData).not.toHaveBeenCalled();
      expect(mockJiraCollector.getSprintIssues).not.toHaveBeenCalled();
      expect(mockBitbucketCollector.getPullRequestsForSprint).not.toHaveBeenCalled();
    });

    it('should return cached report when available', async () => {
      const cachedReport: SprintReport = {
        summary: 'Cached report',
        keyFindings: ['Finding 1'],
        riskAssessment: { level: 'Low', justification: 'All good' },
        recommendations: [],
        metrics: {
          sprint: {
            cycleTime: 8,
            leadTime: 16,
            throughput: 2,
            velocity: 10,
            wipCount: 1,
            carryOverCount: 0,
            completionRate: 100,
          },
          pullRequests: {
            averageLatency: 4,
            averageTimeToFirstReview: 1,
            averageReviewCycles: 1,
            averageRevisions: 1,
          },
        },
        generatedAt: '2024-01-10T00:00:00Z',
      };

      mockStorageService.getReport = jest.fn().mockResolvedValue(cachedReport);

      const report = await orchestrator.analyzeSprint('sprint-1');

      expect(report).toEqual(cachedReport);
      expect(mockJiraCollector.getSprintData).not.toHaveBeenCalled();
    });

    it('should force refresh when requested', async () => {
      // Setup cached report
      mockStorageService.getReport = jest.fn().mockResolvedValue({} as SprintReport);

      await orchestrator.analyzeSprint('sprint-1', undefined, true);

      // Verify cache was bypassed
      expect(mockJiraCollector.getSprintData).toHaveBeenCalled();
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalled();
    });

    it('should fetch Jira and Bitbucket data in parallel', async () => {
      await orchestrator.analyzeSprint('sprint-1');

      // Verify both were called (parallel execution)
      expect(mockJiraCollector.getSprintData).toHaveBeenCalled();
      expect(mockBitbucketCollector.getPullRequestsForSprint).toHaveBeenCalled();

      // Note: In real parallel execution, this would be faster than sequential
      // but in mocked tests, we just verify both were called
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should handle Jira API errors gracefully', async () => {
      mockJiraCollector.getSprintData = jest.fn().mockRejectedValue(
        new Error('Jira API unavailable')
      );

      const report = await orchestrator.analyzeSprint('sprint-1');

      // Should return error report
      expect(report.summary).toContain('failed');
      expect(report.riskAssessment.level).toBe('High');
      expect(report.recommendations[0].category).toBe('PROCESS');
    });

    it('should continue with Jira-only analysis when Bitbucket fails', async () => {
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockRejectedValue(
        new Error('Bitbucket unavailable')
      );

      const report = await orchestrator.analyzeSprint('sprint-1');

      // Should complete analysis without PR data
      expect(report).toBeDefined();
      expect(report.metrics.sprint).toBeDefined();
      expect(report.metrics.pullRequests.averageLatency).toBe(0);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorageService.cacheSprintData = jest.fn().mockRejectedValue(
        new Error('Storage error')
      );

      // Should not throw, just log error
      const report = await orchestrator.analyzeSprint('sprint-1');

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should handle missing historical data', async () => {
      mockJiraCollector.getHistoricalSprints = jest.fn().mockResolvedValue([]);

      const report = await orchestrator.analyzeSprint('sprint-1', 'board-1');

      // Should complete without next sprint suggestions
      expect(report).toBeDefined();
      expect(report.nextSprintSuggestions).toBeUndefined();
    });

    it('should handle empty issue list', async () => {
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([]);

      const report = await orchestrator.analyzeSprint('sprint-1');

      expect(report).toBeDefined();
      expect(report.metrics.sprint.throughput).toBe(0);
      expect(report.metrics.sprint.velocity).toBe(0);
    });

    it('should handle empty PR list', async () => {
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      const report = await orchestrator.analyzeSprint('sprint-1');

      expect(report).toBeDefined();
      expect(report.metrics.pullRequests.averageLatency).toBe(0);
    });
  });

  describe('Historical Metrics Storage', () => {
    it('should store historical metrics for closed sprints', async () => {
      const closedSprint: SprintData = {
        ...mockSprint,
        state: 'closed',
      };

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(closedSprint);

      await orchestrator.analyzeSprint('sprint-1');

      expect(mockStorageService.storeHistoricalMetrics).toHaveBeenCalled();
    });

    it('should not store historical metrics for active sprints', async () => {
      await orchestrator.analyzeSprint('sprint-1');

      expect(mockStorageService.storeHistoricalMetrics).not.toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache for a sprint', async () => {
      mockStorageService.invalidateSprintCache = jest.fn().mockResolvedValue(undefined);

      await orchestrator.invalidateCache('sprint-1');

      expect(mockStorageService.invalidateSprintCache).toHaveBeenCalledWith('sprint-1');
    });

    it('should handle cache invalidation errors', async () => {
      mockStorageService.invalidateSprintCache = jest.fn().mockRejectedValue(
        new Error('Cache error')
      );

      // Should not throw
      await expect(orchestrator.invalidateCache('sprint-1')).resolves.not.toThrow();
    });
  });

  describe('Analysis Status', () => {
    it('should return analysis status with cached data', async () => {
      mockStorageService.getReport = jest.fn().mockResolvedValue({
        generatedAt: '2024-01-10T00:00:00Z',
      } as SprintReport);
      mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue({
        sprint: mockSprint,
        issues: mockIssues,
      });

      const status = await orchestrator.getAnalysisStatus('sprint-1');

      expect(status.hasCachedReport).toBe(true);
      expect(status.hasCachedData).toBe(true);
      expect(status.lastAnalyzed).toBe('2024-01-10T00:00:00Z');
    });

    it('should return analysis status without cached data', async () => {
      const status = await orchestrator.getAnalysisStatus('sprint-1');

      expect(status.hasCachedReport).toBe(false);
      expect(status.hasCachedData).toBe(false);
      expect(status.lastAnalyzed).toBeNull();
    });

    it('should handle errors when checking status', async () => {
      mockStorageService.getReport = jest.fn().mockRejectedValue(new Error('Storage error'));

      const status = await orchestrator.getAnalysisStatus('sprint-1');

      expect(status.hasCachedReport).toBe(false);
      expect(status.hasCachedData).toBe(false);
      expect(status.lastAnalyzed).toBeNull();
    });
  });
});
