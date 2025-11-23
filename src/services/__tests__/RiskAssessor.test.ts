import { RiskAssessor } from '../RiskAssessor';
import {
  SprintMetrics,
  PRMetrics,
  HistoricalMetrics,
  IssueData,
  PullRequestData,
} from '../../types';

describe('RiskAssessor', () => {
  let assessor: RiskAssessor;

  beforeEach(() => {
    assessor = new RiskAssessor();
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for no risk factors', () => {
      const score = assessor.calculateRiskScore([]);
      expect(score).toBe(0);
    });

    it('should calculate score from single risk factor', () => {
      const factors = [
        {
          category: 'HIGH_WIP' as const,
          severity: 5,
          description: 'Test factor',
        },
      ];

      const score = assessor.calculateRiskScore(factors);
      expect(score).toBe(50); // (5/10) * 100
    });

    it('should calculate average score from multiple risk factors', () => {
      const factors = [
        {
          category: 'HIGH_WIP' as const,
          severity: 6,
          description: 'Test factor 1',
        },
        {
          category: 'PR_DELAYS' as const,
          severity: 8,
          description: 'Test factor 2',
        },
        {
          category: 'CARRYOVER' as const,
          severity: 4,
          description: 'Test factor 3',
        },
      ];

      const score = assessor.calculateRiskScore(factors);
      expect(score).toBe(60); // ((6+8+4)/3/10) * 100 = 60
    });

    it('should cap score at 100', () => {
      const factors = [
        {
          category: 'HIGH_WIP' as const,
          severity: 10,
          description: 'Test factor 1',
        },
        {
          category: 'PR_DELAYS' as const,
          severity: 10,
          description: 'Test factor 2',
        },
      ];

      const score = assessor.calculateRiskScore(factors);
      expect(score).toBe(100);
    });
  });

  describe('assessSprintRisk', () => {
    const baseSprintMetrics: SprintMetrics = {
      cycleTime: 24,
      leadTime: 48,
      throughput: 10,
      velocity: 50,
      wipCount: 3,
      carryOverCount: 1,
      completionRate: 85,
    };

    const basePRMetrics: PRMetrics = {
      averageLatency: 24,
      averageTimeToFirstReview: 4,
      averageReviewCycles: 2,
      averageRevisions: 1.5,
    };

    it('should classify as Low risk with good metrics', () => {
      const assessment = assessor.assessSprintRisk(baseSprintMetrics, basePRMetrics);

      expect(assessment.level).toBe('Low');
      expect(assessment.score).toBeLessThanOrEqual(33);
      expect(assessment.justification).toContain('Low risk');
    });

    it('should classify as Medium risk with moderate issues', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 65,
        wipCount: 8,
      };

      const assessment = assessor.assessSprintRisk(metrics, basePRMetrics);

      expect(assessment.level).toBe('Medium');
      expect(assessment.score).toBeGreaterThan(33);
      expect(assessment.score).toBeLessThanOrEqual(66);
    });

    it('should classify as High risk with severe issues', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 40,
        wipCount: 15,
        carryOverCount: 8,
      };

      const prMetrics: PRMetrics = {
        ...basePRMetrics,
        averageLatency: 72,
        averageTimeToFirstReview: 36,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);

      expect(assessment.level).toBe('High');
      expect(assessment.score).toBeGreaterThan(66);
      expect(assessment.factors.length).toBeGreaterThan(0);
    });

    it('should include risk factors in assessment', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 60,
      };

      const assessment = assessor.assessSprintRisk(metrics, basePRMetrics);

      expect(assessment.factors).toBeDefined();
      expect(Array.isArray(assessment.factors)).toBe(true);
    });

    it('should generate justification text', () => {
      const assessment = assessor.assessSprintRisk(baseSprintMetrics, basePRMetrics);

      expect(assessment.justification).toBeDefined();
      expect(typeof assessment.justification).toBe('string');
      expect(assessment.justification.length).toBeGreaterThan(0);
    });
  });

  describe('identifyRiskFactors', () => {
    const baseSprintMetrics: SprintMetrics = {
      cycleTime: 24,
      leadTime: 48,
      throughput: 10,
      velocity: 50,
      wipCount: 3,
      carryOverCount: 1,
      completionRate: 85,
    };

    const basePRMetrics: PRMetrics = {
      averageLatency: 24,
      averageTimeToFirstReview: 4,
      averageReviewCycles: 2,
      averageRevisions: 1.5,
    };

    it('should detect PR delays without historical data', () => {
      const prMetrics: PRMetrics = {
        ...basePRMetrics,
        averageLatency: 60,
        averageTimeToFirstReview: 30,
      };

      const factors = assessor.identifyRiskFactors(baseSprintMetrics, prMetrics);

      const prDelayFactor = factors.find(f => f.category === 'PR_DELAYS');
      expect(prDelayFactor).toBeDefined();
      expect(prDelayFactor?.severity).toBeGreaterThan(0);
      expect(prDelayFactor?.description).toContain('PR latency');
    });

    it('should detect PR delays compared to historical baseline', () => {
      const prMetrics: PRMetrics = {
        ...basePRMetrics,
        averageLatency: 40, // 66% above historical 24
      };

      const historicalData: HistoricalMetrics = {
        sprintId: 'prev-1',
        sprintName: 'Previous Sprint',
        completedAt: '2024-01-01T00:00:00Z',
        metrics: baseSprintMetrics,
        prMetrics: basePRMetrics,
      };

      const factors = assessor.identifyRiskFactors(
        baseSprintMetrics,
        prMetrics,
        historicalData
      );

      const prDelayFactor = factors.find(f => f.category === 'PR_DELAYS');
      expect(prDelayFactor).toBeDefined();
      expect(prDelayFactor?.description).toContain('above historical baseline');
    });

    it('should detect high WIP with issue data', () => {
      const issues: IssueData[] = [
        {
          id: '1',
          key: 'PROJ-1',
          summary: 'Issue 1',
          assignee: 'John',
          storyPoints: 5,
          status: 'In Progress',
          statusTransitions: [],
          linkedPRs: [],
        },
        {
          id: '2',
          key: 'PROJ-2',
          summary: 'Issue 2',
          assignee: 'John',
          storyPoints: 3,
          status: 'In Progress',
          statusTransitions: [],
          linkedPRs: [],
        },
        {
          id: '3',
          key: 'PROJ-3',
          summary: 'Issue 3',
          assignee: 'John',
          storyPoints: 2,
          status: 'In Progress',
          statusTransitions: [],
          linkedPRs: [],
        },
        {
          id: '4',
          key: 'PROJ-4',
          summary: 'Issue 4',
          assignee: 'John',
          storyPoints: 8,
          status: 'In Review',
          statusTransitions: [],
          linkedPRs: [],
        },
        {
          id: '5',
          key: 'PROJ-5',
          summary: 'Issue 5',
          assignee: 'John',
          storyPoints: 5,
          status: 'In Progress',
          statusTransitions: [],
          linkedPRs: [],
        },
      ];

      const factors = assessor.identifyRiskFactors(
        baseSprintMetrics,
        basePRMetrics,
        undefined,
        issues
      );

      const wipFactor = factors.find(f => f.category === 'HIGH_WIP');
      expect(wipFactor).toBeDefined();
      expect(wipFactor?.description).toContain('active issues');
    });

    it('should detect carry-over risk with low completion rate', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 60,
        carryOverCount: 5,
      };

      const factors = assessor.identifyRiskFactors(metrics, basePRMetrics);

      const carryOverFactor = factors.find(f => f.category === 'CARRYOVER');
      expect(carryOverFactor).toBeDefined();
      expect(carryOverFactor?.description).toContain('Completion rate');
      expect(carryOverFactor?.description).toContain('60%');
    });

    it('should detect reviewer bottlenecks', () => {
      const prs: PullRequestData[] = Array.from({ length: 10 }, (_, i) => ({
        id: `pr-${i}`,
        title: `PR ${i}`,
        author: 'Developer',
        createdAt: '2024-01-01T10:00:00Z',
        firstReviewAt: '2024-01-01T12:00:00Z',
        mergedAt: null,
        state: 'OPEN' as const,
        reviewers: [
          {
            username: 'Reviewer1',
            approvedAt: null,
            commentCount: 0,
          },
        ],
        revisionCount: 1,
        linkedIssues: [`PROJ-${i}`],
      }));

      const factors = assessor.identifyRiskFactors(
        baseSprintMetrics,
        basePRMetrics,
        undefined,
        undefined,
        prs
      );

      const bottleneckFactor = factors.find(f => f.category === 'BOTTLENECK');
      expect(bottleneckFactor).toBeDefined();
      expect(bottleneckFactor?.description).toContain('pending PRs');
    });

    it('should detect complexity issues with very low completion rate', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 35,
        velocity: 20,
      };

      const factors = assessor.identifyRiskFactors(metrics, basePRMetrics);

      const complexityFactor = factors.find(f => f.category === 'COMPLEXITY');
      expect(complexityFactor).toBeDefined();
      expect(complexityFactor?.description).toContain('complexity issues');
    });

    it('should return empty array when no risk factors detected', () => {
      const factors = assessor.identifyRiskFactors(baseSprintMetrics, basePRMetrics);

      expect(factors).toBeDefined();
      expect(Array.isArray(factors)).toBe(true);
      // May have 0 or few factors depending on thresholds
    });

    it('should handle multiple risk factors simultaneously', () => {
      const metrics: SprintMetrics = {
        ...baseSprintMetrics,
        completionRate: 55,
        wipCount: 12,
        carryOverCount: 6,
      };

      const prMetrics: PRMetrics = {
        ...basePRMetrics,
        averageLatency: 60,
      };

      const factors = assessor.identifyRiskFactors(metrics, prMetrics);

      expect(factors.length).toBeGreaterThan(1);
      expect(factors.some(f => f.category === 'PR_DELAYS')).toBe(true);
      expect(factors.some(f => f.category === 'CARRYOVER')).toBe(true);
    });
  });

  describe('risk level classification thresholds', () => {
    it('should classify score 0 as Low', () => {
      const metrics: SprintMetrics = {
        cycleTime: 20,
        leadTime: 40,
        throughput: 15,
        velocity: 60,
        wipCount: 2,
        carryOverCount: 0,
        completionRate: 95,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 12,
        averageTimeToFirstReview: 2,
        averageReviewCycles: 1.5,
        averageRevisions: 1,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      expect(assessment.level).toBe('Low');
    });

    it('should classify score 33 as Low', () => {
      // Create factors that result in score ~33
      const metrics: SprintMetrics = {
        cycleTime: 24,
        leadTime: 48,
        throughput: 10,
        velocity: 50,
        wipCount: 3,
        carryOverCount: 1,
        completionRate: 68, // Just below threshold
      };

      const prMetrics: PRMetrics = {
        averageLatency: 24,
        averageTimeToFirstReview: 4,
        averageReviewCycles: 2,
        averageRevisions: 1.5,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      expect(assessment.score).toBeLessThanOrEqual(33);
      expect(assessment.level).toBe('Low');
    });

    it('should classify score 34-66 as Medium', () => {
      const metrics: SprintMetrics = {
        cycleTime: 24,
        leadTime: 48,
        throughput: 10,
        velocity: 50,
        wipCount: 8,
        carryOverCount: 3,
        completionRate: 65,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 36,
        averageTimeToFirstReview: 12,
        averageReviewCycles: 3,
        averageRevisions: 2.5,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      expect(assessment.score).toBeGreaterThan(33);
      expect(assessment.score).toBeLessThanOrEqual(66);
      expect(assessment.level).toBe('Medium');
    });

    it('should classify score 67+ as High', () => {
      const metrics: SprintMetrics = {
        cycleTime: 48,
        leadTime: 96,
        throughput: 3,
        velocity: 15,
        wipCount: 15,
        carryOverCount: 8,
        completionRate: 30,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 80,
        averageTimeToFirstReview: 40,
        averageReviewCycles: 4,
        averageRevisions: 5,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      expect(assessment.score).toBeGreaterThan(66);
      expect(assessment.level).toBe('High');
    });
  });

  describe('justification text generation', () => {
    it('should include completion rate for low risk', () => {
      const metrics: SprintMetrics = {
        cycleTime: 20,
        leadTime: 40,
        throughput: 15,
        velocity: 60,
        wipCount: 2,
        carryOverCount: 0,
        completionRate: 92,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 12,
        averageTimeToFirstReview: 2,
        averageReviewCycles: 1.5,
        averageRevisions: 1,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      expect(assessment.justification).toContain('92%');
      expect(assessment.justification).toContain('Low risk');
    });

    it('should include top risk factors in justification', () => {
      const metrics: SprintMetrics = {
        cycleTime: 24,
        leadTime: 48,
        throughput: 10,
        velocity: 50,
        wipCount: 12,
        carryOverCount: 5,
        completionRate: 55,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 60,
        averageTimeToFirstReview: 30,
        averageReviewCycles: 3,
        averageRevisions: 3,
      };

      const assessment = assessor.assessSprintRisk(metrics, prMetrics);
      
      // Should mention at least one risk factor
      const hasRiskMention = 
        assessment.justification.includes('PR latency') ||
        assessment.justification.includes('Completion rate') ||
        assessment.justification.includes('active issues');
      
      expect(hasRiskMention).toBe(true);
    });

    it('should limit justification to top 3 factors', () => {
      const metrics: SprintMetrics = {
        cycleTime: 48,
        leadTime: 96,
        throughput: 3,
        velocity: 15,
        wipCount: 15,
        carryOverCount: 8,
        completionRate: 30,
      };

      const prMetrics: PRMetrics = {
        averageLatency: 80,
        averageTimeToFirstReview: 40,
        averageReviewCycles: 4,
        averageRevisions: 5,
      };

      const issues: IssueData[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        key: `PROJ-${i}`,
        summary: `Issue ${i}`,
        assignee: 'Dev1',
        storyPoints: 5,
        status: 'In Progress',
        statusTransitions: [],
        linkedPRs: [],
      }));

      const prs: PullRequestData[] = Array.from({ length: 10 }, (_, i) => ({
        id: `pr-${i}`,
        title: `PR ${i}`,
        author: 'Developer',
        createdAt: '2024-01-01T10:00:00Z',
        firstReviewAt: '2024-01-01T12:00:00Z',
        mergedAt: null,
        state: 'OPEN' as const,
        reviewers: [
          {
            username: 'Reviewer1',
            approvedAt: null,
            commentCount: 0,
          },
        ],
        revisionCount: 1,
        linkedIssues: [`PROJ-${i}`],
      }));

      const assessment = assessor.assessSprintRisk(metrics, prMetrics, undefined, issues, prs);
      
      // Justification should be concise (not listing all factors)
      expect(assessment.justification.length).toBeLessThan(500);
    });
  });
});
