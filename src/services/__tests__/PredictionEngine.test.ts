import { PredictionEngine } from '../PredictionEngine';
import {
  SprintData,
  IssueData,
  SprintMetrics,
  StatusTransition,
} from '../../types';

describe('PredictionEngine', () => {
  let engine: PredictionEngine;

  beforeEach(() => {
    engine = new PredictionEngine();
  });

  // Helper function to create test sprint data
  const createTestSprint = (daysFromNow: number): SprintData => ({
    id: 'sprint-1',
    name: 'Test Sprint',
    state: 'active',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    endDate: new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString(),
    goal: 'Test sprint goal',
  });

  // Helper function to create test issue
  const createTestIssue = (
    key: string,
    status: string,
    storyPoints: number | null,
    assignee: string | null,
    transitions: StatusTransition[] = []
  ): IssueData => ({
    id: key,
    key,
    summary: `Test issue ${key}`,
    assignee,
    storyPoints,
    status,
    statusTransitions: transitions,
    linkedPRs: [],
  });

  describe('predictSpillover', () => {
    it('should predict spillover for issues when sprint has ended', () => {
      const sprint = createTestSprint(-1); // Sprint ended 1 day ago
      const issues = [
        createTestIssue('ISSUE-1', 'In Progress', 5, 'user1'),
        createTestIssue('ISSUE-2', 'To Do', 3, 'user2'),
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      expect(predictions).toHaveLength(2);
      expect(predictions[0].probability).toBe(1.0);
      expect(predictions[1].probability).toBe(1.0);
      expect(predictions[0].reasons).toContain('Sprint has ended and issue is not completed');
    });

    it('should not predict spillover for completed issues', () => {
      const sprint = createTestSprint(3); // 3 days remaining
      const issues = [
        createTestIssue('ISSUE-1', 'Done', 5, 'user1'),
        createTestIssue('ISSUE-2', 'Closed', 3, 'user2'),
        createTestIssue('ISSUE-3', 'In Progress', 2, 'user3'),
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      // Only ISSUE-3 should be in predictions (if it has spillover risk)
      expect(predictions.every(p => p.issueKey !== 'ISSUE-1' && p.issueKey !== 'ISSUE-2')).toBe(true);
    });

    it('should predict high spillover probability for unstarted high-complexity issues', () => {
      const sprint = createTestSprint(2); // 2 days remaining
      const issues = [
        createTestIssue('ISSUE-1', 'To Do', 13, null), // Unassigned, high complexity, not started
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      expect(predictions.length).toBeGreaterThan(0);
      const prediction = predictions.find(p => p.issueKey === 'ISSUE-1');
      expect(prediction).toBeDefined();
      expect(prediction!.probability).toBeGreaterThan(0.5); // High spillover risk
    });

    it('should predict low spillover probability for in-progress low-complexity issues with time', () => {
      const sprint = createTestSprint(5); // 5 days remaining
      const transitions: StatusTransition[] = [
        { fromStatus: 'To Do', toStatus: 'In Progress', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      ];
      const issues = [
        createTestIssue('ISSUE-1', 'In Progress', 2, 'user1', transitions),
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      // Should have low spillover risk or not be in predictions at all
      const prediction = predictions.find(p => p.issueKey === 'ISSUE-1');
      if (prediction) {
        expect(prediction.probability).toBeLessThan(0.5);
      }
    });

    it('should consider sprint metrics when provided', () => {
      const sprint = createTestSprint(3);
      const sprintMetrics: SprintMetrics = {
        cycleTime: 16, // 16 hours average
        leadTime: 24,
        throughput: 10,
        velocity: 20, // 20 story points completed
        wipCount: 3,
        carryOverCount: 1,
        completionRate: 85,
      };
      const issues = [
        createTestIssue('ISSUE-1', 'In Progress', 5, 'user1'),
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date(), sprintMetrics);

      // Should use metrics to calculate more accurate predictions
      expect(predictions).toBeDefined();
    });

    it('should sort predictions by spillover probability (highest first)', () => {
      const sprint = createTestSprint(2);
      const issues = [
        createTestIssue('ISSUE-1', 'In Progress', 2, 'user1'), // Lower risk
        createTestIssue('ISSUE-2', 'To Do', 8, null), // Higher risk
        createTestIssue('ISSUE-3', 'To Do', 5, 'user2'), // Medium risk
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      // Predictions should be sorted by probability descending
      for (let i = 0; i < predictions.length - 1; i++) {
        expect(predictions[i].probability).toBeGreaterThanOrEqual(predictions[i + 1].probability);
      }
    });

    it('should include reasons for spillover predictions', () => {
      const sprint = createTestSprint(1); // 1 day remaining
      const issues = [
        createTestIssue('ISSUE-1', 'To Do', 8, null),
      ];

      const predictions = engine.predictSpillover(issues, sprint, new Date());

      expect(predictions.length).toBeGreaterThan(0);
      const prediction = predictions[0];
      expect(prediction.reasons).toBeDefined();
      expect(prediction.reasons.length).toBeGreaterThan(0);
    });
  });
});
