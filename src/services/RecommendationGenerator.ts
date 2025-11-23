import {
  Recommendation,
  NextSprintSuggestions,
  ReviewerAssignment,
  RiskAssessment,
  SprintMetrics,
  PRMetrics,
  IssueData,
  PullRequestData,
  HistoricalMetrics,
  BottleneckInfo,
} from '../types';

/**
 * RecommendationGenerator - Engine for generating actionable recommendations
 * 
 * This class provides methods to:
 * - Generate 3-7 prioritized recommendations based on risk assessment
 * - Suggest scope adjustments (reduce story points, postpone tasks)
 * - Recommend reviewer assignments to balance workload
 * - Suggest WIP limits and task rebalancing
 * - Generate next sprint suggestions (target story points, task selection)
 * 
 * Recommendations are categorized and prioritized by impact and urgency.
 */
export class RecommendationGenerator {
  // Thresholds for recommendation triggers
  private readonly HIGH_WIP_THRESHOLD = 5; // issues per developer
  private readonly REVIEWER_OVERLOAD_THRESHOLD = 8; // PRs per reviewer
  private readonly LOW_COMPLETION_RATE_THRESHOLD = 70; // percentage
  private readonly HIGH_RISK_SCORE_THRESHOLD = 66; // risk score
  private readonly MEDIUM_RISK_SCORE_THRESHOLD = 33; // risk score

  /**
   * Generate prioritized recommendations based on analysis results
   * @param riskAssessment - Risk assessment results
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   * @param issues - Issue data
   * @param prs - Pull request data
   * @param bottlenecks - Optional bottleneck information
   * @returns Array of 3-7 prioritized recommendations
   */
  generateRecommendations(
    riskAssessment: RiskAssessment,
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics,
    issues: IssueData[],
    prs: PullRequestData[],
    bottlenecks?: BottleneckInfo[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Generate scope adjustment recommendations
    const scopeRecs = this.generateScopeRecommendations(
      riskAssessment,
      sprintMetrics,
      issues
    );
    recommendations.push(...scopeRecs);

    // Generate reviewer assignment recommendations
    const reviewerRecs = this.generateReviewerRecommendations(prs, prMetrics);
    recommendations.push(...reviewerRecs);

    // Generate WIP and bottleneck recommendations
    const wipRecs = this.generateWIPRecommendations(
      sprintMetrics,
      issues,
      bottlenecks
    );
    recommendations.push(...wipRecs);

    // Generate process improvement recommendations
    const processRecs = this.generateProcessRecommendations(
      riskAssessment,
      sprintMetrics,
      prMetrics
    );
    recommendations.push(...processRecs);

    // Prioritize and limit to top 7
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Generate next sprint suggestions
   * @param sprintMetrics - Current sprint metrics
   * @param historicalData - Historical metrics for trend analysis
   * @param riskAssessment - Current risk assessment
   * @param issues - Issue data
   * @param prs - Pull request data
   * @returns Next sprint suggestions
   */
  generateNextSprintSuggestions(
    sprintMetrics: SprintMetrics,
    historicalData: HistoricalMetrics,
    riskAssessment: RiskAssessment,
    issues: IssueData[],
    prs: PullRequestData[]
  ): NextSprintSuggestions {
    // Calculate target story points based on historical velocity and risk
    const targetStoryPoints = this.calculateTargetStoryPoints(
      sprintMetrics,
      historicalData,
      riskAssessment
    );

    // Identify tasks to include or postpone
    const { tasksToInclude, tasksToPostpone } = this.identifyTaskAdjustments(
      issues,
      sprintMetrics,
      riskAssessment
    );

    // Generate reviewer assignments for next sprint
    const reviewerAssignments = this.generateReviewerAssignments(prs);

    return {
      targetStoryPoints,
      tasksToInclude,
      tasksToPostpone,
      reviewerAssignments,
    };
  }

  /**
   * Generate scope adjustment recommendations
   * @param riskAssessment - Risk assessment
   * @param sprintMetrics - Sprint metrics
   * @param issues - Issue data
   * @returns Array of scope recommendations
   */
  private generateScopeRecommendations(
    riskAssessment: RiskAssessment,
    sprintMetrics: SprintMetrics,
    issues: IssueData[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommend scope reduction if risk is high
    if (riskAssessment.score >= this.HIGH_RISK_SCORE_THRESHOLD) {
      const incompleteIssues = issues.filter(
        issue => !this.isCompletedStatus(issue.status)
      );

      // Calculate suggested reduction
      const currentPoints = incompleteIssues.reduce(
        (sum, issue) => sum + (issue.storyPoints || 0),
        0
      );
      const suggestedReduction = Math.ceil(currentPoints * 0.2); // 20% reduction

      recommendations.push({
        priority: 1,
        category: 'SCOPE',
        title: 'Reduce sprint scope to manage high risk',
        description: `Consider reducing scope by ${suggestedReduction} story points (20% of remaining work). Focus on completing high-priority tasks and postpone lower-priority items to reduce risk and improve completion rate.`,
        impact: 'High',
      });

      // Identify specific risky tasks to postpone
      const riskyTasks = this.identifyRiskyTasks(issues);
      if (riskyTasks.length > 0) {
        const taskList = riskyTasks.slice(0, 3).map(t => t.key).join(', ');
        recommendations.push({
          priority: 2,
          category: 'SCOPE',
          title: 'Postpone blocked or risky tasks',
          description: `Consider postponing tasks that are blocked or have high complexity: ${taskList}. These tasks are at high risk of spillover and may impact team velocity.`,
          impact: 'High',
        });
      }
    } else if (
      sprintMetrics.completionRate < this.LOW_COMPLETION_RATE_THRESHOLD &&
      riskAssessment.score >= this.MEDIUM_RISK_SCORE_THRESHOLD
    ) {
      recommendations.push({
        priority: 3,
        category: 'SCOPE',
        title: 'Adjust scope to improve completion rate',
        description: `Current completion rate is ${sprintMetrics.completionRate.toFixed(0)}%. Consider moving 1-2 lower-priority tasks to the backlog to ensure the team can complete committed work.`,
        impact: 'Medium',
      });
    }

    return recommendations;
  }

  /**
   * Generate reviewer assignment recommendations
   * @param prs - Pull request data
   * @param prMetrics - PR metrics
   * @returns Array of reviewer recommendations
   */
  private generateReviewerRecommendations(
    prs: PullRequestData[],
    prMetrics: PRMetrics
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Count PRs per reviewer
    const reviewerWorkload = this.calculateReviewerWorkload(prs);

    // Identify overloaded reviewers
    const overloadedReviewers = Array.from(reviewerWorkload.entries())
      .filter(([_, count]) => count >= this.REVIEWER_OVERLOAD_THRESHOLD)
      .sort((a, b) => b[1] - a[1]);

    if (overloadedReviewers.length > 0) {
      const [topReviewer, prCount] = overloadedReviewers[0];
      
      // Find underutilized reviewers
      const underutilizedReviewers = Array.from(reviewerWorkload.entries())
        .filter(([_, count]) => count < 3)
        .map(([reviewer, _]) => reviewer);

      if (underutilizedReviewers.length > 0) {
        recommendations.push({
          priority: 1,
          category: 'REVIEWER',
          title: 'Redistribute PR reviews to balance workload',
          description: `${topReviewer} has ${prCount} pending PRs. Redistribute reviews to ${underutilizedReviewers.slice(0, 2).join(', ')} to reduce bottlenecks and improve review turnaround time.`,
          impact: 'High',
        });
      } else {
        recommendations.push({
          priority: 2,
          category: 'REVIEWER',
          title: 'Address reviewer overload',
          description: `${overloadedReviewers.length} reviewer(s) have ${this.REVIEWER_OVERLOAD_THRESHOLD}+ pending PRs. Consider adding more reviewers or prioritizing critical PRs to reduce review delays.`,
          impact: 'High',
        });
      }
    }

    // Recommend improving review response time if delays detected
    if (prMetrics.averageTimeToFirstReview > 24) {
      recommendations.push({
        priority: 3,
        category: 'REVIEWER',
        title: 'Improve review response time',
        description: `Average time to first review is ${prMetrics.averageTimeToFirstReview.toFixed(1)} hours. Set a team goal of responding to PRs within 8-12 hours to maintain development momentum.`,
        impact: 'Medium',
      });
    }

    return recommendations;
  }

  /**
   * Generate WIP and bottleneck recommendations
   * @param _sprintMetrics - Sprint metrics (reserved for future use)
   * @param issues - Issue data
   * @param bottlenecks - Bottleneck information
   * @returns Array of WIP recommendations
   */
  private generateWIPRecommendations(
    _sprintMetrics: SprintMetrics,
    issues: IssueData[],
    bottlenecks?: BottleneckInfo[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Calculate WIP per developer
    const wipByDeveloper = this.calculateWIPByDeveloper(issues);
    const overloadedDevs = Array.from(wipByDeveloper.entries())
      .filter(([_, count]) => count >= this.HIGH_WIP_THRESHOLD);

    if (overloadedDevs.length > 0) {
      const [topDev, wipCount] = overloadedDevs[0];
      
      recommendations.push({
        priority: 2,
        category: 'WIP',
        title: 'Implement WIP limits to improve flow',
        description: `${overloadedDevs.length} developer(s) have ${this.HIGH_WIP_THRESHOLD}+ active issues (${topDev}: ${wipCount}). Implement a WIP limit of 3-4 issues per developer to improve focus and completion rate.`,
        impact: 'High',
      });

      // Suggest task rebalancing
      const underutilizedDevs = Array.from(wipByDeveloper.entries())
        .filter(([_, count]) => count < 2);

      if (underutilizedDevs.length > 0) {
        recommendations.push({
          priority: 3,
          category: 'WIP',
          title: 'Rebalance task assignments',
          description: `Redistribute tasks from overloaded developers to team members with lower WIP. This will help prevent bottlenecks and improve overall team throughput.`,
          impact: 'Medium',
        });
      }
    }

    // Address specific bottlenecks
    if (bottlenecks && bottlenecks.length > 0) {
      const topBottleneck = bottlenecks[0];
      
      if (topBottleneck.type === 'STATUS') {
        recommendations.push({
          priority: 2,
          category: 'PROCESS',
          title: `Address bottleneck in "${topBottleneck.location}" status`,
          description: `${topBottleneck.affectedIssues.length} issues are delayed in "${topBottleneck.location}". ${topBottleneck.description} Investigate and remove blockers to improve flow.`,
          impact: 'High',
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate process improvement recommendations
   * @param riskAssessment - Risk assessment
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   * @returns Array of process recommendations
   */
  private generateProcessRecommendations(
    riskAssessment: RiskAssessment,
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recommend improving PR process if high revision count
    if (prMetrics.averageRevisions > 3) {
      recommendations.push({
        priority: 4,
        category: 'PROCESS',
        title: 'Reduce PR revision cycles',
        description: `Average of ${prMetrics.averageRevisions.toFixed(1)} revisions per PR. Consider implementing PR checklists, clearer acceptance criteria, or pair programming to reduce rework.`,
        impact: 'Medium',
      });
    }

    // Recommend retrospective focus areas based on risk factors
    if (riskAssessment.factors.length > 0) {
      const topFactors = riskAssessment.factors
        .slice(0, 2)
        .map(f => f.category.toLowerCase().replace('_', ' '))
        .join(' and ');

      recommendations.push({
        priority: 5,
        category: 'PLANNING',
        title: 'Focus retrospective on key risk areas',
        description: `In the next retrospective, prioritize discussion on ${topFactors}. Use data from this analysis to identify root causes and actionable improvements.`,
        impact: 'Medium',
      });
    }

    // Recommend improving estimation if velocity is inconsistent
    if (sprintMetrics.completionRate < 60) {
      recommendations.push({
        priority: 4,
        category: 'PLANNING',
        title: 'Improve sprint planning and estimation',
        description: `Completion rate of ${sprintMetrics.completionRate.toFixed(0)}% suggests estimation or planning issues. Review task breakdown and consider using historical data for more accurate estimates.`,
        impact: 'Medium',
      });
    }

    return recommendations;
  }

  /**
   * Calculate target story points for next sprint
   * @param sprintMetrics - Current sprint metrics
   * @param historicalData - Historical metrics
   * @param riskAssessment - Risk assessment
   * @returns Target story points
   */
  private calculateTargetStoryPoints(
    sprintMetrics: SprintMetrics,
    historicalData: HistoricalMetrics,
    riskAssessment: RiskAssessment
  ): number {
    // Use historical velocity as baseline
    const baselineVelocity = historicalData.metrics.velocity;

    // Adjust based on current performance
    const currentVelocity = sprintMetrics.velocity;
    const averageVelocity = (baselineVelocity + currentVelocity) / 2;

    // Apply risk-based adjustment
    let adjustmentFactor = 1.0;
    
    if (riskAssessment.level === 'High') {
      adjustmentFactor = 0.8; // Reduce by 20%
    } else if (riskAssessment.level === 'Medium') {
      adjustmentFactor = 0.9; // Reduce by 10%
    } else if (sprintMetrics.completionRate > 90) {
      adjustmentFactor = 1.1; // Increase by 10% if performing well
    }

    const targetPoints = Math.round(averageVelocity * adjustmentFactor);

    // Ensure minimum of 1 point
    return Math.max(1, targetPoints);
  }

  /**
   * Identify tasks to include or postpone for next sprint
   * @param issues - Issue data
   * @param sprintMetrics - Sprint metrics
   * @param riskAssessment - Risk assessment
   * @returns Tasks to include and postpone
   */
  private identifyTaskAdjustments(
    issues: IssueData[],
    sprintMetrics: SprintMetrics,
    riskAssessment: RiskAssessment
  ): { tasksToInclude: string[]; tasksToPostpone: string[] } {
    const incompleteIssues = issues.filter(
      issue => !this.isCompletedStatus(issue.status)
    );

    // Identify high-priority tasks (in progress or near completion)
    const tasksToInclude = incompleteIssues
      .filter(issue => 
        issue.status.toLowerCase().includes('progress') ||
        issue.status.toLowerCase().includes('review')
      )
      .slice(0, 5)
      .map(issue => issue.key);

    // Identify tasks to postpone (blocked, risky, or low priority)
    const tasksToPostpone: string[] = [];
    
    if (riskAssessment.level === 'High' || sprintMetrics.completionRate < 70) {
      const riskyTasks = this.identifyRiskyTasks(issues);
      tasksToPostpone.push(...riskyTasks.slice(0, 3).map(t => t.key));
    }

    return { tasksToInclude, tasksToPostpone };
  }

  /**
   * Generate reviewer assignments for next sprint
   * @param prs - Pull request data
   * @returns Reviewer assignments
   */
  private generateReviewerAssignments(prs: PullRequestData[]): ReviewerAssignment[] {
    const reviewerWorkload = this.calculateReviewerWorkload(prs);
    const assignments: ReviewerAssignment[] = [];

    // Calculate average workload
    const totalPRs = Array.from(reviewerWorkload.values()).reduce((sum, count) => sum + count, 0);
    const avgPRs = reviewerWorkload.size > 0 ? totalPRs / reviewerWorkload.size : 0;

    // Generate assignments based on current workload
    for (const [reviewer, currentPRs] of reviewerWorkload.entries()) {
      let recommendedPRCount: number;
      let rationale: string;

      if (currentPRs >= this.REVIEWER_OVERLOAD_THRESHOLD) {
        recommendedPRCount = Math.floor(avgPRs);
        rationale = `Currently overloaded with ${currentPRs} PRs. Reduce to average workload.`;
      } else if (currentPRs < avgPRs * 0.5) {
        recommendedPRCount = Math.ceil(avgPRs);
        rationale = `Currently underutilized with ${currentPRs} PRs. Can take on more reviews.`;
      } else {
        recommendedPRCount = Math.round(avgPRs);
        rationale = `Maintain current balanced workload of ~${currentPRs} PRs.`;
      }

      assignments.push({
        reviewer,
        recommendedPRCount,
        rationale,
      });
    }

    return assignments.slice(0, 5); // Limit to top 5 reviewers
  }

  /**
   * Prioritize recommendations by impact and urgency
   * @param recommendations - Array of recommendations
   * @returns Prioritized and limited array (max 7)
   */
  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    // Sort by priority (lower number = higher priority)
    const sorted = recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // If same priority, sort by impact
      const impactOrder = { High: 0, Medium: 1, Low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });

    // Reassign priorities sequentially and limit to 7
    return sorted.slice(0, 7).map((rec, index) => ({
      ...rec,
      priority: index + 1,
    }));
  }

  /**
   * Calculate reviewer workload from PRs
   * @param prs - Pull request data
   * @returns Map of reviewer to PR count
   */
  private calculateReviewerWorkload(prs: PullRequestData[]): Map<string, number> {
    const workload = new Map<string, number>();

    for (const pr of prs) {
      if (pr.state === 'OPEN') {
        for (const reviewer of pr.reviewers) {
          workload.set(
            reviewer.username,
            (workload.get(reviewer.username) || 0) + 1
          );
        }
      }
    }

    return workload;
  }

  /**
   * Calculate WIP by developer
   * @param issues - Issue data
   * @returns Map of developer to WIP count
   */
  private calculateWIPByDeveloper(issues: IssueData[]): Map<string, number> {
    const wipMap = new Map<string, number>();

    const activeIssues = issues.filter(issue =>
      issue.status.toLowerCase().includes('progress') ||
      issue.status.toLowerCase().includes('review')
    );

    for (const issue of activeIssues) {
      if (issue.assignee) {
        wipMap.set(
          issue.assignee,
          (wipMap.get(issue.assignee) || 0) + 1
        );
      }
    }

    return wipMap;
  }

  /**
   * Identify risky tasks (blocked, high complexity, or stalled)
   * @param issues - Issue data
   * @returns Array of risky issues
   */
  private identifyRiskyTasks(issues: IssueData[]): IssueData[] {
    const incompleteIssues = issues.filter(
      issue => !this.isCompletedStatus(issue.status)
    );

    // Identify tasks that are:
    // 1. Blocked (status contains "blocked")
    // 2. High story points (complexity)
    // 3. Stalled (no recent transitions)
    return incompleteIssues.filter(issue => {
      const isBlocked = issue.status.toLowerCase().includes('blocked');
      const isHighComplexity = (issue.storyPoints || 0) >= 8;
      const isStalled = this.isTaskStalled(issue);

      return isBlocked || isHighComplexity || isStalled;
    });
  }

  /**
   * Check if a task is stalled (no recent status changes)
   * @param issue - Issue data
   * @returns True if stalled
   */
  private isTaskStalled(issue: IssueData): boolean {
    if (issue.statusTransitions.length === 0) {
      return false;
    }

    const lastTransition = issue.statusTransitions[issue.statusTransitions.length - 1];
    const lastTransitionTime = new Date(lastTransition.timestamp).getTime();
    const now = Date.now();
    const hoursSinceLastTransition = (now - lastTransitionTime) / (1000 * 60 * 60);

    // Consider stalled if no transition in 72 hours (3 days)
    return hoursSinceLastTransition > 72;
  }

  /**
   * Check if a status is completed
   * @param status - Status name
   * @returns True if completed
   */
  private isCompletedStatus(status: string): boolean {
    const completedStatuses = ['done', 'closed', 'resolved', 'completed'];
    const normalized = status.toLowerCase();
    return completedStatuses.some(completedStatus =>
      normalized.includes(completedStatus)
    );
  }
}
