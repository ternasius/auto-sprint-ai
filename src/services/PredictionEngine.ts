import {
  SprintData,
  IssueData,
  SpilloverPrediction,
  SprintMetrics,
} from '../types';

/**
 * PredictionEngine - Engine for predicting task spillover
 * 
 * This class analyzes issues in an active sprint to predict which tasks
 * are likely to spill over into the next sprint based on:
 * - Remaining time in sprint
 * - Issue complexity (story points)
 * - Current status and typical status dwell times
 * - Historical cycle time for similar issues
 * 
 * Requirements: 3.3
 */
export class PredictionEngine {
  // Status categories for prediction logic
  private readonly NOT_STARTED_STATUSES = [
    'to do',
    'backlog',
    'open',
    'new',
  ];

  private readonly IN_PROGRESS_STATUSES = [
    'in progress',
    'in development',
    'in review',
    'code review',
    'testing',
    'qa',
    'ready for review',
  ];

  private readonly COMPLETED_STATUSES = [
    'done',
    'closed',
    'resolved',
    'completed',
  ];

  // Default hours per story point (used when no historical data available)
  private readonly DEFAULT_HOURS_PER_STORY_POINT = 8;

  /**
   * Predict which issues are likely to spill over into the next sprint
   * @param issues - Array of issues in the sprint
   * @param sprint - Sprint data
   * @param currentDate - Current date for calculating remaining time
   * @param sprintMetrics - Optional sprint metrics for historical context
   * @returns Array of spillover predictions
   */
  predictSpillover(
    issues: IssueData[],
    sprint: SprintData,
    currentDate: Date,
    sprintMetrics?: SprintMetrics
  ): SpilloverPrediction[] {
    const predictions: SpilloverPrediction[] = [];

    // Only predict for non-completed issues
    const activeIssues = issues.filter(issue => !this.isCompletedStatus(issue.status));

    // Calculate days remaining in sprint
    const daysRemaining = this.calculateDaysRemaining(sprint, currentDate);

    // If sprint is already over, all active issues are spillovers
    if (daysRemaining <= 0) {
      return activeIssues.map(issue => ({
        issueKey: issue.key,
        probability: 1.0,
        reasons: ['Sprint has ended and issue is not completed'],
      }));
    }

    // Calculate hours per story point from historical data
    const hoursPerStoryPoint = this.calculateHoursPerStoryPoint(sprintMetrics);

    for (const issue of activeIssues) {
      const prediction = this.calculateCompletionProbability(
        issue,
        daysRemaining,
        hoursPerStoryPoint,
        sprintMetrics
      );

      // Only include predictions with spillover risk (probability < 0.5 means likely to spill over)
      if (prediction.probability < 0.7) {
        predictions.push({
          issueKey: issue.key,
          probability: 1 - prediction.probability, // Convert to spillover probability
          reasons: prediction.reasons,
        });
      }
    }

    // Sort by spillover probability (highest first)
    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate days remaining in sprint
   * @param sprint - Sprint data
   * @param currentDate - Current date
   * @returns Days remaining (can be negative if sprint ended)
   */
  private calculateDaysRemaining(sprint: SprintData, currentDate: Date): number {
    const endDate = new Date(sprint.endDate);
    const current = new Date(currentDate);

    const diffTime = endDate.getTime() - current.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays;
  }

  /**
   * Calculate hours per story point from sprint metrics
   * @param sprintMetrics - Sprint metrics with velocity and cycle time
   * @returns Estimated hours per story point
   */
  private calculateHoursPerStoryPoint(sprintMetrics?: SprintMetrics): number {
    if (!sprintMetrics || sprintMetrics.velocity === 0) {
      return this.DEFAULT_HOURS_PER_STORY_POINT;
    }

    // Use cycle time as proxy for hours per story point
    // If we completed X story points with average cycle time Y, 
    // then roughly Y hours per story point
    if (sprintMetrics.throughput > 0 && sprintMetrics.velocity > 0) {
      return sprintMetrics.cycleTime / (sprintMetrics.velocity / sprintMetrics.throughput);
    }

    return this.DEFAULT_HOURS_PER_STORY_POINT;
  }

  /**
   * Calculate completion probability for an issue
   * @param issue - Issue data
   * @param daysRemaining - Days remaining in sprint
   * @param hoursPerStoryPoint - Estimated hours per story point
   * @param sprintMetrics - Optional sprint metrics
   * @returns Completion probability (0-1) and reasoning
   */
  private calculateCompletionProbability(
    issue: IssueData,
    daysRemaining: number,
    hoursPerStoryPoint: number,
    sprintMetrics?: SprintMetrics
  ): { probability: number; reasons: string[] } {
    const reasons: string[] = [];
    let probability = 0.5; // Start with neutral probability

    // Factor 1: Story points and time estimation
    const storyPoints = issue.storyPoints || 3; // Default to 3 if not set
    const estimatedHoursNeeded = storyPoints * hoursPerStoryPoint;
    const hoursRemaining = daysRemaining * 8; // Assume 8 working hours per day

    if (estimatedHoursNeeded <= hoursRemaining * 0.5) {
      // Plenty of time
      probability += 0.3;
      reasons.push(`Estimated ${estimatedHoursNeeded.toFixed(0)}h needed vs ${hoursRemaining.toFixed(0)}h remaining`);
    } else if (estimatedHoursNeeded <= hoursRemaining) {
      // Tight but feasible
      probability += 0.1;
      reasons.push(`Tight timeline: ${estimatedHoursNeeded.toFixed(0)}h needed vs ${hoursRemaining.toFixed(0)}h remaining`);
    } else {
      // Not enough time
      probability -= 0.3;
      reasons.push(`Insufficient time: ${estimatedHoursNeeded.toFixed(0)}h needed vs ${hoursRemaining.toFixed(0)}h remaining`);
    }

    // Factor 2: Current status
    if (this.isNotStartedStatus(issue.status)) {
      probability -= 0.2;
      reasons.push(`Issue not yet started (status: ${issue.status})`);
    } else if (this.isInProgressStatus(issue.status)) {
      // Check how long it's been in progress
      const timeInProgress = this.calculateTimeInCurrentStatus(issue);
      const avgCycleTime = sprintMetrics?.cycleTime || hoursPerStoryPoint * storyPoints;

      if (timeInProgress > avgCycleTime * 0.7) {
        // Been in progress for a while, likely to complete
        probability += 0.2;
        reasons.push(`Issue in progress for ${timeInProgress.toFixed(0)}h (${((timeInProgress / avgCycleTime) * 100).toFixed(0)}% of avg cycle time)`);
      } else {
        probability += 0.1;
        reasons.push(`Issue recently started (${timeInProgress.toFixed(0)}h in progress)`);
      }
    }

    // Factor 3: Status dwell time analysis
    const statusDwellTime = this.calculateAverageStatusDwellTime(issue);
    if (statusDwellTime > hoursPerStoryPoint * 2) {
      // Issue has been stuck in statuses for too long
      probability -= 0.15;
      reasons.push(`High status dwell time (${statusDwellTime.toFixed(0)}h average per status)`);
    }

    // Factor 4: Complexity (high story points)
    if (storyPoints >= 8) {
      probability -= 0.1;
      reasons.push(`High complexity (${storyPoints} story points)`);
    } else if (storyPoints >= 5) {
      probability -= 0.05;
      reasons.push(`Medium-high complexity (${storyPoints} story points)`);
    }

    // Factor 5: Assignee (unassigned issues are riskier)
    if (!issue.assignee) {
      probability -= 0.15;
      reasons.push('Issue is unassigned');
    }

    // Factor 6: Linked PRs (having PRs is a good sign)
    if (issue.linkedPRs && issue.linkedPRs.length > 0) {
      probability += 0.1;
      reasons.push(`Has ${issue.linkedPRs.length} linked PR(s)`);
    }

    // Clamp probability between 0 and 1
    probability = Math.max(0, Math.min(1, probability));

    return { probability, reasons };
  }

  /**
   * Calculate time spent in current status
   * @param issue - Issue data
   * @returns Hours in current status
   */
  private calculateTimeInCurrentStatus(issue: IssueData): number {
    if (issue.statusTransitions.length === 0) {
      return 0;
    }

    // Find the most recent transition to current status
    const currentStatus = issue.status;
    const lastTransition = issue.statusTransitions
      .reverse()
      .find(t => t.toStatus === currentStatus);

    if (!lastTransition) {
      return 0;
    }

    const transitionTime = new Date(lastTransition.timestamp).getTime();
    const now = Date.now();

    return (now - transitionTime) / (1000 * 60 * 60);
  }

  /**
   * Calculate average dwell time across all statuses for an issue
   * @param issue - Issue data
   * @returns Average hours per status
   */
  private calculateAverageStatusDwellTime(issue: IssueData): number {
    if (issue.statusTransitions.length < 2) {
      return 0;
    }

    let totalDwellTime = 0;
    const transitions = issue.statusTransitions;

    for (let i = 0; i < transitions.length - 1; i++) {
      const currentTime = new Date(transitions[i].timestamp).getTime();
      const nextTime = new Date(transitions[i + 1].timestamp).getTime();
      totalDwellTime += (nextTime - currentTime) / (1000 * 60 * 60);
    }

    return totalDwellTime / (transitions.length - 1);
  }

  /**
   * Check if a status is a "not started" status
   * @param status - Status name
   * @returns True if not started
   */
  private isNotStartedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return this.NOT_STARTED_STATUSES.some(s => normalized.includes(s));
  }

  /**
   * Check if a status is an "in progress" status
   * @param status - Status name
   * @returns True if in progress
   */
  private isInProgressStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return this.IN_PROGRESS_STATUSES.some(s => normalized.includes(s));
  }

  /**
   * Check if a status is a "completed" status
   * @param status - Status name
   * @returns True if completed
   */
  private isCompletedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return this.COMPLETED_STATUSES.some(s => normalized.includes(s));
  }
}
