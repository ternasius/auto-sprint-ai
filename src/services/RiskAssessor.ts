import {
  SprintMetrics,
  PRMetrics,
  HistoricalMetrics,
  RiskAssessment,
  RiskFactor,
  RiskLevel,
  IssueData,
  PullRequestData,
} from '../types';

/**
 * RiskAssessor - Engine for assessing sprint risk levels
 * 
 * This class provides methods to:
 * - Identify risk factors (PR delays, high WIP, complexity, carry-over, bottlenecks)
 * - Calculate overall risk scores
 * - Classify risk levels (Low, Medium, High)
 * - Generate justification text for risk assessments
 * 
 * Risk scoring is based on multiple factors with severity scores (0-10).
 * Overall risk score is aggregated and classified into three levels.
 */
export class RiskAssessor {
  // Risk level thresholds
  private readonly LOW_RISK_THRESHOLD = 33;
  private readonly MEDIUM_RISK_THRESHOLD = 66;

  // Risk factor detection thresholds
  private readonly HIGH_WIP_THRESHOLD = 5; // issues per developer
  private readonly LOW_COMPLETION_RATE_THRESHOLD = 70; // percentage
  private readonly REVIEWER_OVERLOAD_THRESHOLD = 8; // PRs per reviewer
  private readonly PR_DELAY_MULTIPLIER = 1.3; // 30% above baseline

  /**
   * Assess sprint risk based on metrics and historical data
   * @param sprintMetrics - Current sprint metrics
   * @param prMetrics - Pull request metrics
   * @param historicalData - Optional historical metrics for comparison
   * @param issues - Optional issue data for detailed analysis
   * @param prs - Optional PR data for reviewer analysis
   * @returns Complete risk assessment
   */
  assessSprintRisk(
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics,
    historicalData?: HistoricalMetrics,
    issues?: IssueData[],
    prs?: PullRequestData[]
  ): RiskAssessment {
    // Identify all risk factors
    const factors = this.identifyRiskFactors(
      sprintMetrics,
      prMetrics,
      historicalData,
      issues,
      prs
    );

    // Calculate overall risk score
    const score = this.calculateRiskScore(factors);

    // Classify risk level
    const level = this.classifyRiskLevel(score);

    // Generate justification text
    const justification = this.generateJustification(level, factors, sprintMetrics);

    return {
      level,
      score,
      factors,
      justification,
    };
  }

  /**
   * Identify risk factors from sprint and PR metrics
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   * @param historicalData - Optional historical data
   * @param issues - Optional issue data
   * @param prs - Optional PR data
   * @returns Array of identified risk factors
   */
  identifyRiskFactors(
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics,
    historicalData?: HistoricalMetrics,
    issues?: IssueData[],
    prs?: PullRequestData[]
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Check for PR delays
    const prDelayFactor = this.detectPRDelays(prMetrics, historicalData);
    if (prDelayFactor) {
      factors.push(prDelayFactor);
    }

    // Check for high WIP
    const wipFactor = this.detectHighWIP(sprintMetrics, issues);
    if (wipFactor) {
      factors.push(wipFactor);
    }

    // Check for carry-over risk
    const carryOverFactor = this.detectCarryOverRisk(sprintMetrics);
    if (carryOverFactor) {
      factors.push(carryOverFactor);
    }

    // Check for reviewer bottlenecks
    const reviewerFactor = this.detectReviewerBottlenecks(prs);
    if (reviewerFactor) {
      factors.push(reviewerFactor);
    }

    // Check for low completion rate
    const completionFactor = this.detectLowCompletionRate(sprintMetrics);
    if (completionFactor) {
      factors.push(completionFactor);
    }

    return factors;
  }

  /**
   * Calculate overall risk score from risk factors
   * @param factors - Array of risk factors
   * @returns Risk score (0-100)
   */
  calculateRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) {
      return 0;
    }

    // Sum all severity scores
    const totalSeverity = factors.reduce((sum, factor) => sum + factor.severity, 0);

    // Calculate average severity and scale to 0-100
    const averageSeverity = totalSeverity / factors.length;
    const score = (averageSeverity / 10) * 100;

    // Cap at 100
    return Math.min(100, Math.round(score));
  }

  /**
   * Classify risk level based on score
   * @param score - Risk score (0-100)
   * @returns Risk level classification
   */
  private classifyRiskLevel(score: number): RiskLevel {
    if (score <= this.LOW_RISK_THRESHOLD) {
      return 'Low';
    } else if (score <= this.MEDIUM_RISK_THRESHOLD) {
      return 'Medium';
    } else {
      return 'High';
    }
  }

  /**
   * Generate justification text for risk assessment
   * @param level - Risk level
   * @param factors - Risk factors
   * @param sprintMetrics - Sprint metrics
   * @returns Justification text
   */
  private generateJustification(
    level: RiskLevel,
    factors: RiskFactor[],
    sprintMetrics: SprintMetrics
  ): string {
    if (factors.length === 0) {
      return `Sprint is at ${level} risk. All metrics are within normal ranges with a ${sprintMetrics.completionRate.toFixed(0)}% completion rate.`;
    }

    const factorDescriptions = factors
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3) // Top 3 factors
      .map(f => f.description);

    const factorText = factorDescriptions.join(' ');

    return `Sprint is at ${level} risk. ${factorText}`;
  }

  /**
   * Detect PR delays compared to historical baseline
   * @param prMetrics - Current PR metrics
   * @param historicalData - Historical metrics for comparison
   * @returns Risk factor if delays detected, null otherwise
   */
  private detectPRDelays(
    prMetrics: PRMetrics,
    historicalData?: HistoricalMetrics
  ): RiskFactor | null {
    // If no historical data, use absolute thresholds
    if (!historicalData) {
      // Consider delays if average latency > 48 hours or time to first review > 24 hours
      if (prMetrics.averageLatency > 48 || prMetrics.averageTimeToFirstReview > 24) {
        const severity = Math.min(10, Math.floor(prMetrics.averageLatency / 10));
        return {
          category: 'PR_DELAYS',
          severity,
          description: `PR latency is ${prMetrics.averageLatency.toFixed(1)} hours with ${prMetrics.averageTimeToFirstReview.toFixed(1)} hours to first review.`,
        };
      }
      return null;
    }

    // Compare with historical baseline
    const historicalLatency = historicalData.prMetrics.averageLatency;
    const threshold = historicalLatency * this.PR_DELAY_MULTIPLIER;

    if (prMetrics.averageLatency > threshold) {
      const percentageIncrease = ((prMetrics.averageLatency / historicalLatency - 1) * 100);
      const severity = Math.min(10, Math.floor(percentageIncrease / 10));

      return {
        category: 'PR_DELAYS',
        severity,
        description: `PR latency is ${percentageIncrease.toFixed(0)}% above historical baseline (${prMetrics.averageLatency.toFixed(1)} vs ${historicalLatency.toFixed(1)} hours).`,
      };
    }

    return null;
  }

  /**
   * Detect high WIP levels
   * @param sprintMetrics - Sprint metrics
   * @param issues - Optional issue data for per-developer analysis
   * @returns Risk factor if high WIP detected, null otherwise
   */
  private detectHighWIP(
    sprintMetrics: SprintMetrics,
    issues?: IssueData[]
  ): RiskFactor | null {
    // Calculate WIP per developer if issue data available
    if (issues) {
      const activeIssues = issues.filter(issue => 
        issue.status.toLowerCase().includes('progress') ||
        issue.status.toLowerCase().includes('review')
      );

      // Group by assignee
      const wipByDeveloper = new Map<string, number>();
      for (const issue of activeIssues) {
        if (issue.assignee) {
          wipByDeveloper.set(
            issue.assignee,
            (wipByDeveloper.get(issue.assignee) || 0) + 1
          );
        }
      }

      // Find developers with high WIP
      const overloadedDevs = Array.from(wipByDeveloper.entries())
        .filter(([_, count]) => count >= this.HIGH_WIP_THRESHOLD);

      if (overloadedDevs.length > 0) {
        const maxWIP = Math.max(...overloadedDevs.map(([_, count]) => count));
        const severity = Math.min(10, Math.floor((maxWIP - this.HIGH_WIP_THRESHOLD) * 2) + 5);

        return {
          category: 'HIGH_WIP',
          severity,
          description: `${overloadedDevs.length} developer(s) have ${this.HIGH_WIP_THRESHOLD}+ active issues (max: ${maxWIP}).`,
        };
      }
    } else {
      // Fallback: use total WIP count
      if (sprintMetrics.wipCount >= this.HIGH_WIP_THRESHOLD * 2) {
        const severity = Math.min(10, Math.floor(sprintMetrics.wipCount / 3));
        return {
          category: 'HIGH_WIP',
          severity,
          description: `High WIP with ${sprintMetrics.wipCount} active issues.`,
        };
      }
    }

    return null;
  }

  /**
   * Detect carry-over risk based on completion rate
   * @param sprintMetrics - Sprint metrics
   * @returns Risk factor if carry-over risk detected, null otherwise
   */
  private detectCarryOverRisk(sprintMetrics: SprintMetrics): RiskFactor | null {
    if (sprintMetrics.completionRate < this.LOW_COMPLETION_RATE_THRESHOLD) {
      const deficit = this.LOW_COMPLETION_RATE_THRESHOLD - sprintMetrics.completionRate;
      const severity = Math.min(10, Math.floor(deficit / 5) + 3);

      return {
        category: 'CARRYOVER',
        severity,
        description: `Completion rate is ${sprintMetrics.completionRate.toFixed(0)}%, indicating ${sprintMetrics.carryOverCount} likely carry-over tasks.`,
      };
    }

    return null;
  }

  /**
   * Detect reviewer bottlenecks
   * @param prs - Pull request data
   * @returns Risk factor if reviewer bottlenecks detected, null otherwise
   */
  private detectReviewerBottlenecks(prs?: PullRequestData[]): RiskFactor | null {
    if (!prs || prs.length === 0) {
      return null;
    }

    // Count PRs per reviewer
    const prsByReviewer = new Map<string, number>();
    
    for (const pr of prs) {
      if (pr.state === 'OPEN') {
        for (const reviewer of pr.reviewers) {
          prsByReviewer.set(
            reviewer.username,
            (prsByReviewer.get(reviewer.username) || 0) + 1
          );
        }
      }
    }

    // Find overloaded reviewers
    const overloadedReviewers = Array.from(prsByReviewer.entries())
      .filter(([_, count]) => count >= this.REVIEWER_OVERLOAD_THRESHOLD);

    if (overloadedReviewers.length > 0) {
      const maxPRs = Math.max(...overloadedReviewers.map(([_, count]) => count));
      const severity = Math.min(10, Math.floor((maxPRs - this.REVIEWER_OVERLOAD_THRESHOLD) / 2) + 6);

      return {
        category: 'BOTTLENECK',
        severity,
        description: `${overloadedReviewers.length} reviewer(s) have ${this.REVIEWER_OVERLOAD_THRESHOLD}+ pending PRs (max: ${maxPRs}).`,
      };
    }

    return null;
  }

  /**
   * Detect low completion rate as a complexity indicator
   * @param sprintMetrics - Sprint metrics
   * @returns Risk factor if low completion detected, null otherwise
   */
  private detectLowCompletionRate(sprintMetrics: SprintMetrics): RiskFactor | null {
    // This is handled by carry-over detection, but we can add complexity-specific checks
    if (sprintMetrics.completionRate < 50 && sprintMetrics.velocity > 0) {
      const severity = Math.min(10, Math.floor((50 - sprintMetrics.completionRate) / 5) + 5);

      return {
        category: 'COMPLEXITY',
        severity,
        description: `Very low completion rate (${sprintMetrics.completionRate.toFixed(0)}%) suggests task complexity issues.`,
      };
    }

    return null;
  }
}
