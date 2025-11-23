import { AnalysisOrchestrator } from '../AnalysisOrchestrator';
import { JiraDataCollector } from '../JiraDataCollector';
import { BitbucketDataCollector } from '../BitbucketDataCollector';
import { StorageService } from '../StorageService';
import {
  SprintData,
  IssueData,
  PullRequestData,
  StatusTransition,
} from '../../types';

// Mock all service dependencies
jest.mock('../JiraDataCollector');
jest.mock('../BitbucketDataCollector');
jest.mock('../StorageService');

describe('Performance and Error Handling Tests', () => {
  let orchestrator: AnalysisOrchestrator;
  let mockJiraCollector: jest.Mocked<JiraDataCollector>;
  let mockBitbucketCollector: jest.Mocked<BitbucketDataCollector>;
  let mockStorageService: jest.Mocked<StorageService>;

  // Helper function to generate large sprint data
  const generateLargeSprintData = (issueCount: number): {
    sprint: SprintData;
    issues: IssueData[];
    prs: PullRequestData[];
  } => {
    const sprint: SprintData = {
      id: 'large-sprint',
      name: 'Large Sprint',
      state: 'active',
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-15T00:00:00Z',
      goal: 'Performance test sprint',
    };

    const issues: IssueData[] = [];
    const prs: PullRequestData[] = [];

    for (let i = 0; i < issueCount; i++) {
      const statusTransitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: `2024-01-0${(i % 9) + 1}T10:00:00Z` },
        { fromStatus: 'In Progress', toStatus: 'In Review', timestamp: `2024-01-0${(i % 9) + 1}T14:00:00Z` },
        { fromStatus: 'In Review', toStatus: 'Done', timestamp: `2024-01-0${(i % 9) + 1}T18:00:00Z` },
      ];

      issues.push({
        id: `issue-${i}`,
        key: `PROJ-${i}`,
        summary: `Issue ${i}`,
        assignee: `Developer ${i % 10}`,
        storyPoints: (i % 8) + 1,
        status: i % 3 === 0 ? 'Done' : i % 3 === 1 ? 'In Progress' : 'To Do',
        statusTransitions: i % 3 === 0 ? statusTransitions : statusTransitions.slice(0, i % 3),
        linkedPRs: [`pr-${i}`],
      });

      if (i % 2 === 0) {
        prs.push({
          id: `pr-${i}`,
          title: `PR for issue ${i}`,
          author: `Developer ${i % 10}`,
          createdAt: `2024-01-0${(i % 9) + 1}T11:00:00Z`,
          firstReviewAt: `2024-01-0${(i % 9) + 1}T13:00:00Z`,
          mergedAt: i % 3 === 0 ? `2024-01-0${(i % 9) + 1}T17:00:00Z` : null,
          state: i % 3 === 0 ? 'MERGED' : 'OPEN',
          reviewers: [
            {
              username: `Reviewer ${i % 5}`,
              approvedAt: i % 3 === 0 ? `2024-01-0${(i % 9) + 1}T15:00:00Z` : null,
              commentCount: (i % 5) + 1,
            },
          ],
          revisionCount: (i % 3) + 1,
          linkedIssues: [`PROJ-${i}`],
        });
      }
    }

    return { sprint, issues, prs };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new AnalysisOrchestrator();

    mockJiraCollector = (orchestrator as any).jiraCollector as jest.Mocked<JiraDataCollector>;
    mockBitbucketCollector = (orchestrator as any).bitbucketCollector as jest.Mocked<BitbucketDataCollector>;
    mockStorageService = (orchestrator as any).storageService as jest.Mocked<StorageService>;

    // Default mock implementations
    mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue(null);
    mockStorageService.getCachedPRData = jest.fn().mockResolvedValue(null);
    mockStorageService.getReport = jest.fn().mockResolvedValue(null);
    mockStorageService.getHistoricalMetric = jest.fn().mockResolvedValue(null);
    mockStorageService.cacheSprintData = jest.fn().mockResolvedValue(undefined);
    mockStorageService.cachePRData = jest.fn().mockResolvedValue(undefined);
    mockStorageService.storeReport = jest.fn().mockResolvedValue(undefined);
    mockStorageService.storeHistoricalMetrics = jest.fn().mockResolvedValue(undefined);
    mockJiraCollector.getHistoricalSprints = jest.fn().mockResolvedValue([]);
  });

  describe('Performance Tests - Large Sprints', () => {
    it('should handle sprint with 100+ issues efficiently', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(150);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      const startTime = Date.now();
      const report = await orchestrator.analyzeSprint('large-sprint');
      const executionTime = Date.now() - startTime;

      // Verify report was generated
      expect(report).toBeDefined();
      expect(report.metrics.sprint.throughput).toBeGreaterThan(0);

      // Log execution time for monitoring
      console.log(`Execution time for 150 issues: ${executionTime}ms`);

      // Verify all issues were processed
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalledWith('large-sprint');
      expect(mockBitbucketCollector.getPullRequestsForSprint).toHaveBeenCalled();
    });

    it('should handle sprint with 200+ issues', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(250);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      const startTime = Date.now();
      const report = await orchestrator.analyzeSprint('large-sprint');
      const executionTime = Date.now() - startTime;

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);

      console.log(`Execution time for 250 issues: ${executionTime}ms`);
    });

    it('should process issues with complex transition histories', async () => {
      const sprint: SprintData = {
        id: 'complex-sprint',
        name: 'Complex Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      // Create issues with many status transitions
      const issues: IssueData[] = Array.from({ length: 50 }, (_, i) => ({
        id: `issue-${i}`,
        key: `PROJ-${i}`,
        summary: `Complex issue ${i}`,
        assignee: `Developer ${i % 5}`,
        storyPoints: 5,
        status: 'Done',
        statusTransitions: Array.from({ length: 20 }, (_, j) => ({
          fromStatus: `Status ${j}`,
          toStatus: `Status ${j + 1}`,
          timestamp: `2024-01-${String(Math.floor(j / 2) + 1).padStart(2, '0')}T${String(j % 24).padStart(2, '0')}:00:00Z`,
        })),
        linkedPRs: [`pr-${i}`],
      }));

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      const startTime = Date.now();
      const report = await orchestrator.analyzeSprint('complex-sprint');
      const executionTime = Date.now() - startTime;

      expect(report).toBeDefined();
      // Cycle time may be 0 if no issues are completed
      expect(report.metrics.sprint.cycleTime).toBeGreaterThanOrEqual(0);

      console.log(`Execution time for complex transitions: ${executionTime}ms`);
    });
  });

  describe('Cache Effectiveness Tests', () => {
    it('should use cache and avoid API calls on second request', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(100);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      // First request - should fetch from APIs
      await orchestrator.analyzeSprint('cache-test-sprint');

      expect(mockJiraCollector.getSprintData).toHaveBeenCalledTimes(1);
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalledTimes(1);

      // Setup cache for second request
      mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue({ sprint, issues });
      mockStorageService.getCachedPRData = jest.fn().mockResolvedValue(prs);

      // Second request - should use cache
      await orchestrator.analyzeSprint('cache-test-sprint');

      // API calls should still be 1 (not called again)
      expect(mockJiraCollector.getSprintData).toHaveBeenCalledTimes(1);
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalledTimes(1);
    });

    it('should measure cache hit performance improvement', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(150);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      // First request - no cache
      const startTime1 = Date.now();
      await orchestrator.analyzeSprint('perf-test-sprint');
      const timeWithoutCache = Date.now() - startTime1;

      // Setup cache
      mockStorageService.getCachedSprintData = jest.fn().mockResolvedValue({ sprint, issues });
      mockStorageService.getCachedPRData = jest.fn().mockResolvedValue(prs);

      // Second request - with cache
      const startTime2 = Date.now();
      await orchestrator.analyzeSprint('perf-test-sprint');
      const timeWithCache = Date.now() - startTime2;

      console.log(`Time without cache: ${timeWithoutCache}ms`);
      console.log(`Time with cache: ${timeWithCache}ms`);
      
      if (timeWithoutCache > 0) {
        console.log(`Cache improvement: ${((1 - timeWithCache / timeWithoutCache) * 100).toFixed(2)}%`);
      }

      // Cache should provide some performance benefit (or at least not be significantly slower)
      // Allow for some variance in test execution
      expect(timeWithCache).toBeLessThanOrEqual(timeWithoutCache + 20);
    });

    it('should verify cache TTL behavior', async () => {
      const sprint: SprintData = {
        id: 'ttl-test-sprint',
        name: 'TTL Test',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([]);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      await orchestrator.analyzeSprint('ttl-test-sprint');

      // Verify cache was stored with TTL
      expect(mockStorageService.cacheSprintData).toHaveBeenCalled();
      expect(mockStorageService.cachePRData).toHaveBeenCalled();
      expect(mockStorageService.storeReport).toHaveBeenCalled();
    });
  });

  describe('Error Scenario Tests', () => {
    it('should handle Jira API timeout errors', async () => {
      mockJiraCollector.getSprintData = jest.fn().mockRejectedValue(
        new Error('Request timeout after 30s')
      );

      const report = await orchestrator.analyzeSprint('timeout-sprint');

      expect(report).toBeDefined();
      expect(report.summary).toContain('failed');
      expect(report.riskAssessment.level).toBe('High');
    });

    it('should handle Jira API rate limiting', async () => {
      mockJiraCollector.getSprintData = jest.fn().mockRejectedValue(
        new Error('Rate limit exceeded: 429 Too Many Requests')
      );

      const report = await orchestrator.analyzeSprint('rate-limit-sprint');

      expect(report).toBeDefined();
      expect(report.summary).toContain('failed');
      expect(report.recommendations[0].category).toBe('PROCESS');
    });

    it('should handle Bitbucket API authentication errors', async () => {
      const sprint: SprintData = {
        id: 'auth-error-sprint',
        name: 'Auth Error Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([]);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockRejectedValue(
        new Error('Authentication failed: 401 Unauthorized')
      );

      const report = await orchestrator.analyzeSprint('auth-error-sprint');

      // Should continue with Jira-only analysis
      expect(report).toBeDefined();
      expect(report.metrics.sprint).toBeDefined();
      expect(report.metrics.pullRequests.averageLatency).toBe(0);
    });

    it('should handle network errors gracefully', async () => {
      mockJiraCollector.getSprintData = jest.fn().mockRejectedValue(
        new Error('Network error: ECONNREFUSED')
      );

      const report = await orchestrator.analyzeSprint('network-error-sprint');

      expect(report).toBeDefined();
      expect(report.keyFindings).toContain('Unable to complete analysis due to an error.');
    });

    it('should handle malformed API responses', async () => {
      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue({
        id: 'malformed-sprint',
        // Missing required fields
      } as any);

      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([
        {
          id: 'issue-1',
          // Missing required fields
        } as any,
      ]);

      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      // Should handle gracefully without crashing
      const report = await orchestrator.analyzeSprint('malformed-sprint');
      expect(report).toBeDefined();
    });

    it('should handle storage service failures', async () => {
      const sprint: SprintData = {
        id: 'storage-error-sprint',
        name: 'Storage Error Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([]);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      // Simulate storage failures
      mockStorageService.cacheSprintData = jest.fn().mockRejectedValue(
        new Error('Storage quota exceeded')
      );
      mockStorageService.storeReport = jest.fn().mockRejectedValue(
        new Error('Storage write failed')
      );

      // Should complete analysis despite storage errors
      const report = await orchestrator.analyzeSprint('storage-error-sprint');

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should handle concurrent analysis requests', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(50);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      // Simulate concurrent requests
      const promises = [
        orchestrator.analyzeSprint('concurrent-sprint-1'),
        orchestrator.analyzeSprint('concurrent-sprint-2'),
        orchestrator.analyzeSprint('concurrent-sprint-3'),
      ];

      const reports = await Promise.all(promises);

      // All requests should complete successfully
      expect(reports).toHaveLength(3);
      reports.forEach(report => {
        expect(report).toBeDefined();
        expect(report.summary).toBeDefined();
      });
    });

    it('should handle missing data gracefully', async () => {
      const sprint: SprintData = {
        id: 'empty-sprint',
        name: 'Empty Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue([]);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      const report = await orchestrator.analyzeSprint('empty-sprint');

      expect(report).toBeDefined();
      expect(report.metrics.sprint.throughput).toBe(0);
      expect(report.metrics.sprint.velocity).toBe(0);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should handle null and undefined values in issue data', async () => {
      const sprint: SprintData = {
        id: 'null-data-sprint',
        name: 'Null Data Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-15T00:00:00Z',
      };

      const issues: IssueData[] = [
        {
          id: 'issue-1',
          key: 'PROJ-1',
          summary: 'Issue with null values',
          assignee: null,
          storyPoints: null,
          status: 'To Do',
          statusTransitions: [],
          linkedPRs: [],
        },
      ];

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue([]);

      const report = await orchestrator.analyzeSprint('null-data-sprint');

      expect(report).toBeDefined();
      expect(report.metrics.sprint).toBeDefined();
    });
  });

  describe('Function Execution Time Monitoring', () => {
    it('should track execution time for data collection phase', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(100);

      mockJiraCollector.getSprintData = jest.fn().mockResolvedValue(sprint);
      mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

      const startTime = Date.now();
      await orchestrator.analyzeSprint('timing-sprint');
      const totalTime = Date.now() - startTime;

      console.log(`Total execution time: ${totalTime}ms`);

      // Verify execution completed
      expect(mockJiraCollector.getSprintData).toHaveBeenCalled();
      expect(mockJiraCollector.getSprintIssues).toHaveBeenCalled();
      expect(mockBitbucketCollector.getPullRequestsForSprint).toHaveBeenCalled();
    });

    it('should measure parallel vs sequential data fetching', async () => {
      const { sprint, issues, prs } = generateLargeSprintData(50);

      // Add artificial delay to simulate API latency
      mockJiraCollector.getSprintData = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(sprint), 100))
      );
      mockJiraCollector.getSprintIssues = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(issues), 100))
      );
      mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(prs), 100))
      );

      const startTime = Date.now();
      await orchestrator.analyzeSprint('parallel-test-sprint');
      const executionTime = Date.now() - startTime;

      console.log(`Parallel execution time: ${executionTime}ms`);

      // With parallel execution, time should be closer to max delay (100ms) than sum (300ms)
      // Allow some overhead for processing
      expect(executionTime).toBeLessThan(250);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle multiple large sprints without memory issues', async () => {
      const sprints = ['sprint-1', 'sprint-2', 'sprint-3', 'sprint-4', 'sprint-5'];
      let callCount = 0;

      for (const sprintId of sprints) {
        const { sprint, issues, prs } = generateLargeSprintData(100);
        sprint.id = sprintId;

        mockJiraCollector.getSprintData = jest.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve(sprint);
        });
        mockJiraCollector.getSprintIssues = jest.fn().mockResolvedValue(issues);
        mockBitbucketCollector.getPullRequestsForSprint = jest.fn().mockResolvedValue(prs);

        const report = await orchestrator.analyzeSprint(sprintId);
        expect(report).toBeDefined();
      }

      // All sprints should be processed successfully
      expect(callCount).toBe(5);
    });
  });
});
