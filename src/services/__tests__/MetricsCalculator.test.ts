import { MetricsCalculator } from '../MetricsCalculator';
import {
  SprintData,
  IssueData,
  StatusTransition,
  PullRequestData,
} from '../../types';

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator;

  beforeEach(() => {
    calculator = new MetricsCalculator();
  });

  describe('calculateCycleTime', () => {
    it('should calculate cycle time from In Progress to Done', () => {
      const transitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
        { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-01T18:00:00Z' },
      ];

      const cycleTime = calculator.calculateCycleTime(transitions);
      expect(cycleTime).toBe(8); // 8 hours
    });

    it('should handle multiple transitions correctly', () => {
      const transitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
        { fromStatus: 'In Progress', toStatus: 'Code Review', timestamp: '2024-01-01T14:00:00Z' },
        { fromStatus: 'Code Review', toStatus: 'In Progress', timestamp: '2024-01-01T15:00:00Z' },
        { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-01T20:00:00Z' },
      ];

      const cycleTime = calculator.calculateCycleTime(transitions);
      expect(cycleTime).toBe(10); // From first "In Progress" to "Done"
    });

    it('should return 0 when no active status transition exists', () => {
      const transitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'Backlog', timestamp: '2024-01-01T10:00:00Z' },
      ];

      const cycleTime = calculator.calculateCycleTime(transitions);
      expect(cycleTime).toBe(0);
    });

    it('should return 0 when no completed status transition exists', () => {
      const transitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
      ];

      const cycleTime = calculator.calculateCycleTime(transitions);
      expect(cycleTime).toBe(0);
    });
  });

  describe('calculateLeadTime', () => {
    it('should calculate lead time from creation to completion', () => {
      const issue: IssueData = {
        id: '1',
        key: 'PROJ-1',
        summary: 'Test issue',
        assignee: 'John Doe',
        storyPoints: 5,
        status: 'Done',
        statusTransitions: [
          { fromStatus: 'Created', toStatus: 'To Do', timestamp: '2024-01-01T10:00:00Z' },
          { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
          { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-03T10:00:00Z' },
        ],
        linkedPRs: [],
      };

      const leadTime = calculator.calculateLeadTime(issue);
      expect(leadTime).toBe(48); // 48 hours (2 days)
    });

    it('should return 0 when issue is not completed', () => {
      const issue: IssueData = {
        id: '1',
        key: 'PROJ-1',
        summary: 'Test issue',
        assignee: 'John Doe',
        storyPoints: 5,
        status: 'In Progress',
        statusTransitions: [
          { fromStatus: 'Created', toStatus: 'To Do', timestamp: '2024-01-01T10:00:00Z' },
          { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
        ],
        linkedPRs: [],
      };

      const leadTime = calculator.calculateLeadTime(issue);
      expect(leadTime).toBe(0);
    });
  });

  describe('calculateSprintMetrics', () => {
    const sprint: SprintData = {
      id: '1',
      name: 'Sprint 1',
      state: 'active',
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-15T00:00:00Z',
    };

    it('should calculate comprehensive sprint metrics', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Completed issue',
          assignee: 'John',
          storyPoints: 5,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-02T18:00:00Z' },
          ],
          linkedPRs: [],
        },
        {
          id: '2',
          key: 'PROJ-2',
          summary: 'Another completed issue',
          assignee: 'Jane',
          storyPoints: 3,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-03T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-03T16:00:00Z' },
          ],
          linkedPRs: [],
        },
        {
          id: '3',
          key: 'PROJ-3',
          summary: 'In progress issue',
          assignee: 'Bob',
          storyPoints: 8,
          status: 'In Progress',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-04T10:00:00Z' },
          ],
          linkedPRs: [],
        },
      ];

      const metrics = calculator.calculateSprintMetrics(issues, sprint);

      expect(metrics.throughput).toBe(2); // 2 completed issues
      expect(metrics.velocity).toBe(8); // 5 + 3 story points
      expect(metrics.wipCount).toBe(1); // 1 in progress
      expect(metrics.completionRate).toBeCloseTo(66.67, 1); // 2/3 * 100
      expect(metrics.cycleTime).toBe(7); // Average of 8 and 6 hours
    });

    it('should handle empty issue list', () => {
      const metrics = calculator.calculateSprintMetrics([], sprint);

      expect(metrics.throughput).toBe(0);
      expect(metrics.velocity).toBe(0);
      expect(metrics.wipCount).toBe(0);
      expect(metrics.completionRate).toBe(0);
      expect(metrics.cycleTime).toBe(0);
    });

    it('should identify carry-over issues', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Old issue',
          assignee: 'John',
          storyPoints: 5,
          status: 'In Progress',
          statusTransitions: [
            { fromStatus: 'Created', toStatus: 'To Do', timestamp: '2023-12-15T10:00:00Z' },
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2023-12-20T10:00:00Z' },
          ],
          linkedPRs: [],
        },
        {
          id: '2',
          key: 'PROJ-2',
          summary: 'New issue',
          assignee: 'Jane',
          storyPoints: 3,
          status: 'In Progress',
          statusTransitions: [
            { fromStatus: 'Created', toStatus: 'To Do', timestamp: '2024-01-05T10:00:00Z' },
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-06T10:00:00Z' },
          ],
          linkedPRs: [],
        },
      ];

      const metrics = calculator.calculateSprintMetrics(issues, sprint);
      expect(metrics.carryOverCount).toBe(1); // PROJ-1 created before sprint start
    });
  });

  describe('calculatePRMetrics', () => {
    it('should calculate PR metrics correctly', () => {
      const prs: PullRequestData[] = [
        {
          id: '1',
          title: 'PR 1',
          author: 'John',
          createdAt: '2024-01-01T10:00:00Z',
          firstReviewAt: '2024-01-01T12:00:00Z',
          mergedAt: '2024-01-01T18:00:00Z',
          state: 'MERGED',
          reviewers: [
            { username: 'Jane', approvedAt: '2024-01-01T14:00:00Z', commentCount: 2 },
            { username: 'Bob', approvedAt: '2024-01-01T16:00:00Z', commentCount: 1 },
          ],
          revisionCount: 3,
          linkedIssues: ['PROJ-1'],
        },
        {
          id: '2',
          title: 'PR 2',
          author: 'Jane',
          createdAt: '2024-01-02T10:00:00Z',
          firstReviewAt: '2024-01-02T11:00:00Z',
          mergedAt: '2024-01-02T14:00:00Z',
          state: 'MERGED',
          reviewers: [
            { username: 'John', approvedAt: '2024-01-02T13:00:00Z', commentCount: 1 },
          ],
          revisionCount: 1,
          linkedIssues: ['PROJ-2'],
        },
      ];

      const metrics = calculator.calculatePRMetrics(prs);

      expect(metrics.averageLatency).toBe(6); // (8 + 4) / 2
      expect(metrics.averageTimeToFirstReview).toBe(1.5); // (2 + 1) / 2
      expect(metrics.averageReviewCycles).toBe(1.5); // (2 + 1) / 2
      expect(metrics.averageRevisions).toBe(2); // (3 + 1) / 2
    });

    it('should handle empty PR list', () => {
      const metrics = calculator.calculatePRMetrics([]);

      expect(metrics.averageLatency).toBe(0);
      expect(metrics.averageTimeToFirstReview).toBe(0);
      expect(metrics.averageReviewCycles).toBe(0);
      expect(metrics.averageRevisions).toBe(0);
    });

    it('should handle PRs without reviews', () => {
      const prs: PullRequestData[] = [
        {
          id: '1',
          title: 'PR 1',
          author: 'John',
          createdAt: '2024-01-01T10:00:00Z',
          firstReviewAt: null,
          mergedAt: '2024-01-01T18:00:00Z',
          state: 'MERGED',
          reviewers: [],
          revisionCount: 0,
          linkedIssues: ['PROJ-1'],
        },
      ];

      const metrics = calculator.calculatePRMetrics(prs);

      expect(metrics.averageLatency).toBe(8);
      expect(metrics.averageTimeToFirstReview).toBe(0);
      expect(metrics.averageReviewCycles).toBe(0);
      expect(metrics.averageRevisions).toBe(0);
    });

    it('should only calculate latency for merged PRs', () => {
      const prs: PullRequestData[] = [
        {
          id: '1',
          title: 'Open PR',
          author: 'John',
          createdAt: '2024-01-01T10:00:00Z',
          firstReviewAt: '2024-01-01T12:00:00Z',
          mergedAt: null,
          state: 'OPEN',
          reviewers: [],
          revisionCount: 2,
          linkedIssues: ['PROJ-1'],
        },
        {
          id: '2',
          title: 'Merged PR',
          author: 'Jane',
          createdAt: '2024-01-02T10:00:00Z',
          firstReviewAt: '2024-01-02T11:00:00Z',
          mergedAt: '2024-01-02T14:00:00Z',
          state: 'MERGED',
          reviewers: [],
          revisionCount: 1,
          linkedIssues: ['PROJ-2'],
        },
      ];

      const metrics = calculator.calculatePRMetrics(prs);

      expect(metrics.averageLatency).toBe(4); // Only merged PR counted
      expect(metrics.averageRevisions).toBe(1.5); // Both PRs counted
    });
  });

  describe('identifyBottlenecks', () => {
    it('should identify status bottlenecks', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Issue 1',
          assignee: 'John',
          storyPoints: 5,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Code Review', timestamp: '2024-01-01T12:00:00Z' },
            { fromStatus: 'Code Review', toStatus: 'Done', timestamp: '2024-01-01T22:00:00Z' }, // 10 hours in review
          ],
          linkedPRs: [],
        },
        {
          id: '2',
          key: 'PROJ-2',
          summary: 'Issue 2',
          assignee: 'Jane',
          storyPoints: 3,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Code Review', timestamp: '2024-01-02T12:00:00Z' },
            { fromStatus: 'Code Review', toStatus: 'Done', timestamp: '2024-01-02T20:00:00Z' }, // 8 hours in review
          ],
          linkedPRs: [],
        },
        {
          id: '3',
          key: 'PROJ-3',
          summary: 'Issue 3',
          assignee: 'Bob',
          storyPoints: 2,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-03T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-03T12:00:00Z' }, // 2 hours
          ],
          linkedPRs: [],
        },
      ];

      const bottlenecks = calculator.identifyBottlenecks(issues);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].type).toBe('STATUS');
      expect(bottlenecks[0].location).toBe('Code Review');
      expect(bottlenecks[0].affectedIssues).toContain('PROJ-1');
      expect(bottlenecks[0].affectedIssues).toContain('PROJ-2');
    });

    it('should return empty array when no bottlenecks exist', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Issue 1',
          assignee: 'John',
          storyPoints: 5,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Done', timestamp: '2024-01-01T12:00:00Z' },
          ],
          linkedPRs: [],
        },
      ];

      const bottlenecks = calculator.identifyBottlenecks(issues);
      expect(bottlenecks.length).toBe(0);
    });

    it('should sort bottlenecks by severity', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Issue 1',
          assignee: 'John',
          storyPoints: 5,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-01T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Testing', timestamp: '2024-01-01T12:00:00Z' },
            { fromStatus: 'Testing', toStatus: 'Done', timestamp: '2024-01-02T12:00:00Z' }, // 24 hours
          ],
          linkedPRs: [],
        },
        {
          id: '2',
          key: 'PROJ-2',
          summary: 'Issue 2',
          assignee: 'Jane',
          storyPoints: 3,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-02T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Code Review', timestamp: '2024-01-02T12:00:00Z' },
            { fromStatus: 'Code Review', toStatus: 'Done', timestamp: '2024-01-02T20:00:00Z' }, // 8 hours
          ],
          linkedPRs: [],
        },
        {
          id: '3',
          key: 'PROJ-3',
          summary: 'Issue 3',
          assignee: 'Bob',
          storyPoints: 2,
          status: 'Done',
          statusTransitions: [
            { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: '2024-01-03T10:00:00Z' },
            { fromStatus: 'In Progress', toStatus: 'Testing', timestamp: '2024-01-03T12:00:00Z' },
            { fromStatus: 'Testing', toStatus: 'Done', timestamp: '2024-01-04T12:00:00Z' }, // 24 hours
          ],
          linkedPRs: [],
        },
      ];

      const bottlenecks = calculator.identifyBottlenecks(issues);

      // Testing should be first (higher severity due to longer dwell time and more issues)
      if (bottlenecks.length > 1) {
        expect(bottlenecks[0].severity).toBeGreaterThanOrEqual(bottlenecks[1].severity);
      }
    });
  });
});
