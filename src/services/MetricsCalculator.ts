import {
  SprintData,
  IssueData,
  StatusTransition,
  PullRequestData,
  SprintMetrics,
  PRMetrics,
  BottleneckInfo,
} from '../types';

/**
 * MetricsCalculator - Engine for calculating sprint and PR performance metrics
 * 
 * This class provides methods to:
 * - Calculate cycle time, lead time, throughput, and velocity
 * - Track WIP (Work-in-Progress) and carry-over tasks
 * - Identify bottlenecks in the workflow
 * - Calculate PR-related metrics (latency, review time, revisions)
 * 
 * All time calculations are in hours for consistency.
 */
export class MetricsCalculator {
  // Active status keywords that indicate work in progress
  private readonly ACTIVE_STATUSES = [
    'in progress',
    'in development',
    'in review',
    'code review',
    'testing',
    'qa',
    'ready for review',
  ];

  // Completed status keywords
  private readonly COMPLETED_STATUSES = [
    'done',
    'closed',
    'resolved',
    'completed',
  ];

  /**
   * Calculate comprehensive sprint metrics
   * @param issues - Array of issues in the sprint
   * @param sprint - Sprint data
   * @returns Complete sprint metrics
   */
  calculateSprintMetrics(issues: IssueData[], sprint: SprintData): SprintMetrics {
    const completedIssues = this.getCompletedIssues(issues);
    const activeIssues = this.getActiveIssues(issues);
    const carryOverIssues = this.getCarryOverIssues(issues, sprint);

    // Calculate cycle time (average for completed issues)
    const cycleTime = this.calculateAverageCycleTime(completedIssues);

    // Calculate lead time (average for completed issues)
    const leadTime = this.calculateAverageLeadTime(completedIssues);

    // Throughput: count of completed issues
    const throughput = completedIssues.length;

    // Velocity: sum of completed story points
    const velocity = this.calculateVelocity(completedIssues);

    // WIP count: issues in active statuses
    const wipCount = activeIssues.length;

    // Carry-over count
    const carryOverCount = carryOverIssues.length;

    // Completion rate: percentage of issues completed
    const completionRate = issues.length > 0 
      ? (completedIssues.length / issues.length) * 100 
      : 0;

    return {
      cycleTime,
      leadTime,
      throughput,
      velocity,
      wipCount,
      carryOverCount,
      completionRate,
    };
  }

  /**
   * Calculate PR-related metrics
   * @param prs - Array of pull requests
   * @returns PR metrics
   */
  calculatePRMetrics(prs: PullRequestData[]): PRMetrics {
    if (prs.length === 0) {
      return {
        averageLatency: 0,
        averageTimeToFirstReview: 0,
        averageReviewCycles: 0,
        averageRevisions: 0,
      };
    }

    // Filter merged PRs for latency calculation
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED' && pr.mergedAt);

    // Calculate average PR latency (creation to merge)
    const averageLatency = mergedPRs.length > 0
      ? mergedPRs.reduce((sum, pr) => {
          const latency = this.calculatePRLatency(pr);
          return sum + latency;
        }, 0) / mergedPRs.length
      : 0;

    // Calculate average time to first review
    const prsWithReview = prs.filter(pr => pr.firstReviewAt);
    const averageTimeToFirstReview = prsWithReview.length > 0
      ? prsWithReview.reduce((sum, pr) => {
          const timeToReview = this.calculateTimeToFirstReview(pr);
          return sum + timeToReview;
        }, 0) / prsWithReview.length
      : 0;

    // Calculate average review cycles (based on reviewer count)
    const averageReviewCycles = prs.reduce((sum, pr) => {
      return sum + pr.reviewers.length;
    }, 0) / prs.length;

    // Calculate average revisions
    const averageRevisions = prs.reduce((sum, pr) => {
      return sum + pr.revisionCount;
    }, 0) / prs.length;

    return {
      averageLatency,
      averageTimeToFirstReview,
      averageReviewCycles,
      averageRevisions,
    };
  }

  /**
   * Calculate cycle time for an issue (from "In Progress" to "Done")
   * @param transitions - Status transitions for the issue
   * @returns Cycle time in hours
   */
  calculateCycleTime(transitions: StatusTransition[]): number {
    // Find first transition to an active status
    const startTransition = transitions.find(t => 
      this.isActiveStatus(t.toStatus)
    );

    // Find last transition to a completed status
    const endTransition = transitions.reverse().find(t => 
      this.isCompletedStatus(t.toStatus)
    );

    if (!startTransition || !endTransition) {
      return 0;
    }

    const startTime = new Date(startTransition.timestamp).getTime();
    const endTime = new Date(endTransition.timestamp).getTime();

    // Return difference in hours
    return (endTime - startTime) / (1000 * 60 * 60);
  }

  /**
   * Calculate lead time for an issue (from creation to completion)
   * @param issue - Issue data
   * @returns Lead time in hours
   */
  calculateLeadTime(issue: IssueData): number {
    // Find the issue creation time (first transition or earliest timestamp)
    const creationTime = this.getIssueCreationTime(issue);

    // Find completion time (last transition to completed status)
    const completionTransition = issue.statusTransitions
      .reverse()
      .find(t => this.isCompletedStatus(t.toStatus));

    if (!completionTransition) {
      return 0;
    }

    const completionTime = new Date(completionTransition.timestamp).getTime();

    // Return difference in hours
    return (completionTime - creationTime) / (1000 * 60 * 60);
  }

  /**
   * Identify bottlenecks in the workflow
   * @param issues - Array of issues
   * @returns Array of bottleneck information
   */
  identifyBottlenecks(issues: IssueData[]): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];

    // Analyze status dwell times
    const statusDwellTimes = this.calculateStatusDwellTimes(issues);

    // Identify statuses with high dwell time
    const avgDwellTime = this.calculateAverageDwellTime(statusDwellTimes);

    for (const [status, data] of statusDwellTimes.entries()) {
      // Skip completed statuses - they're not bottlenecks
      if (this.isCompletedStatus(status)) {
        continue;
      }

      const avgTime = data.totalTime / data.count;

      // Only flag as bottleneck if:
      // 1. Average time is positive (not negative due to data issues)
      // 2. Average time is 50% higher than overall average
      // 3. At least 2 issues affected
      // 4. Average time is at least 1 hour (ignore very short times)
      if (avgTime > 1 && avgTime > avgDwellTime * 1.5 && data.count >= 2) {
        const severity = Math.min(10, Math.floor((avgTime / avgDwellTime) * 3));

        bottlenecks.push({
          location: status,
          type: 'STATUS',
          affectedIssues: data.issues,
          severity,
          description: `Issues spend an average of ${avgTime.toFixed(1)} hours in "${status}" status, which is ${((avgTime / avgDwellTime - 1) * 100).toFixed(0)}% above average.`,
        });
      }
    }

    // Sort by severity (highest first)
    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Calculate average cycle time for a set of issues
   * @param issues - Array of issues
   * @returns Average cycle time in hours
   */
  private calculateAverageCycleTime(issues: IssueData[]): number {
    if (issues.length === 0) {
      return 0;
    }

    const cycleTimes = issues.map(issue => this.calculateCycleTime(issue.statusTransitions));
    const validCycleTimes = cycleTimes.filter(time => time > 0);

    if (validCycleTimes.length === 0) {
      return 0;
    }

    return validCycleTimes.reduce((sum, time) => sum + time, 0) / validCycleTimes.length;
  }

  /**
   * Calculate average lead time for a set of issues
   * @param issues - Array of issues
   * @returns Average lead time in hours
   */
  private calculateAverageLeadTime(issues: IssueData[]): number {
    if (issues.length === 0) {
      return 0;
    }

    const leadTimes = issues.map(issue => this.calculateLeadTime(issue));
    const validLeadTimes = leadTimes.filter(time => time > 0);

    if (validLeadTimes.length === 0) {
      return 0;
    }

    return validLeadTimes.reduce((sum, time) => sum + time, 0) / validLeadTimes.length;
  }

  /**
   * Calculate velocity (sum of completed story points)
   * @param completedIssues - Array of completed issues
   * @returns Total story points completed
   */
  private calculateVelocity(completedIssues: IssueData[]): number {
    return completedIssues.reduce((sum, issue) => {
      return sum + (issue.storyPoints || 0);
    }, 0);
  }

  /**
   * Calculate PR latency (creation to merge)
   * @param pr - Pull request data
   * @returns Latency in hours
   */
  private calculatePRLatency(pr: PullRequestData): number {
    if (!pr.mergedAt) {
      return 0;
    }

    const createdTime = new Date(pr.createdAt).getTime();
    const mergedTime = new Date(pr.mergedAt).getTime();

    return (mergedTime - createdTime) / (1000 * 60 * 60);
  }

  /**
   * Calculate time to first review
   * @param pr - Pull request data
   * @returns Time in hours
   */
  private calculateTimeToFirstReview(pr: PullRequestData): number {
    if (!pr.firstReviewAt) {
      return 0;
    }

    const createdTime = new Date(pr.createdAt).getTime();
    const firstReviewTime = new Date(pr.firstReviewAt).getTime();

    return (firstReviewTime - createdTime) / (1000 * 60 * 60);
  }

  /**
   * Get completed issues
   * @param issues - Array of issues
   * @returns Filtered array of completed issues
   */
  private getCompletedIssues(issues: IssueData[]): IssueData[] {
    return issues.filter(issue => this.isCompletedStatus(issue.status));
  }

  /**
   * Get active (in-progress) issues
   * @param issues - Array of issues
   * @returns Filtered array of active issues
   */
  private getActiveIssues(issues: IssueData[]): IssueData[] {
    return issues.filter(issue => this.isActiveStatus(issue.status));
  }

  /**
   * Get carry-over issues (issues that existed before sprint start)
   * @param issues - Array of issues
   * @param sprint - Sprint data
   * @returns Filtered array of carry-over issues
   */
  private getCarryOverIssues(issues: IssueData[], sprint: SprintData): IssueData[] {
    const sprintStartTime = new Date(sprint.startDate).getTime();

    return issues.filter(issue => {
      const creationTime = this.getIssueCreationTime(issue);
      return creationTime < sprintStartTime;
    });
  }

  /**
   * Get issue creation time from transitions
   * @param issue - Issue data
   * @returns Creation timestamp in milliseconds
   */
  private getIssueCreationTime(issue: IssueData): number {
    if (issue.statusTransitions.length === 0) {
      // If no transitions, assume created recently
      return Date.now();
    }

    // Find earliest transition timestamp
    const earliestTransition = issue.statusTransitions.reduce((earliest, transition) => {
      const time = new Date(transition.timestamp).getTime();
      return time < earliest ? time : earliest;
    }, new Date(issue.statusTransitions[0].timestamp).getTime());

    return earliestTransition;
  }

  /**
   * Check if a status is an active status
   * @param status - Status name
   * @returns True if active
   */
  private isActiveStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return this.ACTIVE_STATUSES.some(activeStatus => 
      normalized.includes(activeStatus)
    );
  }

  /**
   * Check if a status is a completed status
   * @param status - Status name
   * @returns True if completed
   */
  private isCompletedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return this.COMPLETED_STATUSES.some(completedStatus => 
      normalized.includes(completedStatus)
    );
  }

  /**
   * Calculate dwell time for each status across all issues
   * @param issues - Array of issues
   * @returns Map of status to dwell time data
   */
  private calculateStatusDwellTimes(issues: IssueData[]): Map<string, { totalTime: number; count: number; issues: string[] }> {
    const dwellTimes = new Map<string, { totalTime: number; count: number; issues: string[] }>();

    for (const issue of issues) {
      const transitions = issue.statusTransitions;

      for (let i = 0; i < transitions.length - 1; i++) {
        const currentTransition = transitions[i];
        const nextTransition = transitions[i + 1];

        const status = currentTransition.toStatus;
        const dwellTime = (new Date(nextTransition.timestamp).getTime() - new Date(currentTransition.timestamp).getTime()) / (1000 * 60 * 60);

        if (!dwellTimes.has(status)) {
          dwellTimes.set(status, { totalTime: 0, count: 0, issues: [] });
        }

        const data = dwellTimes.get(status)!;
        data.totalTime += dwellTime;
        data.count++;
        if (!data.issues.includes(issue.key)) {
          data.issues.push(issue.key);
        }
      }
    }

    return dwellTimes;
  }

  /**
   * Calculate average dwell time across all statuses
   * @param dwellTimes - Map of status dwell times
   * @returns Average dwell time in hours
   */
  private calculateAverageDwellTime(dwellTimes: Map<string, { totalTime: number; count: number; issues: string[] }>): number {
    let totalTime = 0;
    let totalCount = 0;

    for (const data of dwellTimes.values()) {
      totalTime += data.totalTime;
      totalCount += data.count;
    }

    return totalCount > 0 ? totalTime / totalCount : 0;
  }
}
