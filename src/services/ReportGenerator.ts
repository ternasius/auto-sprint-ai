import {
  SprintReport,
  SprintData,
  SprintMetrics,
  PRMetrics,
  RiskAssessment,
  Recommendation,
  NextSprintSuggestions,
  IssueData,
  PullRequestData,
  BottleneckInfo,
} from '../types';

/**
 * ReportGenerator - Formats analysis results into comprehensive sprint reports
 * 
 * This class provides methods to:
 * - Generate complete sprint reports with all sections
 * - Create concise sprint health summaries (1-2 sentences)
 * - Extract and format key findings from metrics
 * - Format risk assessments for display
 * - Format recommendations and next sprint suggestions
 * 
 * Reports are structured for easy consumption in UI components and documentation.
 */
export class ReportGenerator {
  /**
   * Generate a complete sprint report
   * @param sprint - Sprint data
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   * @param riskAssessment - Risk assessment results
   * @param recommendations - Array of recommendations
   * @param issues - Issue data for detailed analysis
   * @param prs - Pull request data for detailed analysis
   * @param bottlenecks - Optional bottleneck information
   * @param nextSprintSuggestions - Optional next sprint suggestions
   * @returns Complete sprint report
   */
  generateReport(
    sprint: SprintData,
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics,
    riskAssessment: RiskAssessment,
    recommendations: Recommendation[],
    issues: IssueData[],
    prs: PullRequestData[],
    bottlenecks?: BottleneckInfo[],
    nextSprintSuggestions?: NextSprintSuggestions
  ): SprintReport {
    // Generate summary (1-2 sentences)
    const summary = this.generateSummary(sprint, sprintMetrics, riskAssessment);

    // Generate key findings (5-7 bullet points)
    const keyFindings = this.generateKeyFindings(
      sprintMetrics,
      prMetrics,
      issues,
      prs,
      bottlenecks
    );

    // Format risk assessment for display
    const formattedRiskAssessment = this.formatRiskAssessment(riskAssessment);

    // Format recommendations (already prioritized)
    const formattedRecommendations = this.formatRecommendations(recommendations);

    return {
      summary,
      keyFindings,
      riskAssessment: formattedRiskAssessment,
      recommendations: formattedRecommendations,
      nextSprintSuggestions,
      metrics: {
        sprint: sprintMetrics,
        pullRequests: prMetrics,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a concise sprint health summary (1-2 sentences)
   * @param sprint - Sprint data
   * @param sprintMetrics - Sprint metrics
   * @param riskAssessment - Risk assessment
   * @returns Summary text
   */
  private generateSummary(
    sprint: SprintData,
    sprintMetrics: SprintMetrics,
    riskAssessment: RiskAssessment
  ): string {
    const sprintName = sprint.name;
    const completionRate = sprintMetrics.completionRate.toFixed(0);
    const riskLevel = riskAssessment.level;
    const velocity = sprintMetrics.velocity;

    // Generate summary based on sprint state and metrics
    if (sprint.state === 'closed') {
      // Completed sprint summary
      if (sprintMetrics.completionRate >= 90) {
        return `${sprintName} completed successfully with ${completionRate}% completion rate and ${velocity} story points delivered. The sprint had ${riskLevel} risk and met team expectations.`;
      } else if (sprintMetrics.completionRate >= 70) {
        return `${sprintName} completed with ${completionRate}% completion rate and ${velocity} story points delivered. The sprint had ${riskLevel} risk with some tasks carrying over to the next sprint.`;
      } else {
        return `${sprintName} completed with ${completionRate}% completion rate and ${velocity} story points delivered. The sprint had ${riskLevel} risk with significant challenges impacting delivery.`;
      }
    } else {
      // Active sprint summary
      if (riskLevel === 'Low') {
        return `${sprintName} is progressing well with ${completionRate}% completion rate and ${riskLevel} risk. The team is on track to meet sprint goals.`;
      } else if (riskLevel === 'Medium') {
        return `${sprintName} is at ${riskLevel} risk with ${completionRate}% completion rate. Some adjustments may be needed to ensure successful delivery.`;
      } else {
        return `${sprintName} is at ${riskLevel} risk with ${completionRate}% completion rate. Immediate action is recommended to address blockers and improve sprint outcomes.`;
      }
    }
  }

  /**
   * Generate key findings from metrics (5-7 bullet points)
   * @param sprintMetrics - Sprint metrics
   * @param prMetrics - PR metrics
   * @param issues - Issue data
   * @param prs - Pull request data
   * @param bottlenecks - Optional bottleneck information
   * @returns Array of key findings
   */
  private generateKeyFindings(
    sprintMetrics: SprintMetrics,
    prMetrics: PRMetrics,
    issues: IssueData[],
    prs: PullRequestData[],
    bottlenecks?: BottleneckInfo[]
  ): string[] {
    const findings: string[] = [];

    // Finding 1: Completion rate and throughput
    findings.push(
      `Completed ${sprintMetrics.throughput} issues (${sprintMetrics.completionRate.toFixed(0)}% completion rate) with ${sprintMetrics.velocity} story points delivered.`
    );

    // Finding 2: WIP levels
    if (sprintMetrics.wipCount > 0) {
      const wipPercentage = ((sprintMetrics.wipCount / (sprintMetrics.throughput + sprintMetrics.wipCount)) * 100).toFixed(0);
      findings.push(
        `Current WIP is ${sprintMetrics.wipCount} issues (${wipPercentage}% of total work), ${this.getWIPAssessment(sprintMetrics.wipCount)}.`
      );
    }

    // Finding 3: Cycle time and lead time
    if (sprintMetrics.cycleTime > 0) {
      findings.push(
        `Average cycle time is ${sprintMetrics.cycleTime.toFixed(1)} hours and lead time is ${sprintMetrics.leadTime.toFixed(1)} hours.`
      );
    }

    // Finding 4: PR metrics
    if (prs.length > 0) {
      const prFinding = this.generatePRFinding(prMetrics, prs);
      if (prFinding) {
        findings.push(prFinding);
      }
    }

    // Finding 5: Bottlenecks
    if (bottlenecks && bottlenecks.length > 0) {
      const topBottleneck = bottlenecks[0];
      findings.push(
        `Bottleneck detected: ${topBottleneck.description}`
      );
    }

    // Finding 6: Carry-over tasks
    if (sprintMetrics.carryOverCount > 0) {
      findings.push(
        `${sprintMetrics.carryOverCount} tasks are carry-overs from previous sprints, indicating potential scope or estimation issues.`
      );
    }

    // Finding 7: Developer workload (if we have issue data)
    const workloadFinding = this.generateWorkloadFinding(issues);
    if (workloadFinding) {
      findings.push(workloadFinding);
    }

    // Limit to 7 most important findings
    return findings.slice(0, 7);
  }

  /**
   * Format risk assessment for display
   * @param riskAssessment - Risk assessment results
   * @returns Formatted risk assessment
   */
  private formatRiskAssessment(riskAssessment: RiskAssessment): {
    level: 'Low' | 'Medium' | 'High';
    justification: string;
  } {
    return {
      level: riskAssessment.level,
      justification: riskAssessment.justification,
    };
  }

  /**
   * Format recommendations for display (already prioritized)
   * @param recommendations - Array of recommendations
   * @returns Formatted recommendations
   */
  private formatRecommendations(recommendations: Recommendation[]): Recommendation[] {
    // Recommendations are already prioritized by RecommendationGenerator
    // Just ensure they're in the correct order
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate PR-related finding
   * @param prMetrics - PR metrics
   * @param prs - Pull request data
   * @returns PR finding text or null
   */
  private generatePRFinding(prMetrics: PRMetrics, prs: PullRequestData[]): string | null {
    const openPRs = prs.filter(pr => pr.state === 'OPEN').length;
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED').length;

    if (prMetrics.averageLatency > 48) {
      return `${mergedPRs} PRs merged with ${prMetrics.averageLatency.toFixed(1)} hour average latency (${openPRs} still open), indicating review delays.`;
    } else if (prMetrics.averageTimeToFirstReview > 24) {
      return `${prs.length} PRs processed with ${prMetrics.averageTimeToFirstReview.toFixed(1)} hour average time to first review, suggesting reviewer availability issues.`;
    } else if (openPRs > mergedPRs && openPRs > 5) {
      return `${openPRs} PRs are currently open (vs ${mergedPRs} merged), indicating a potential review backlog.`;
    } else {
      return `${mergedPRs} PRs merged with ${prMetrics.averageLatency.toFixed(1)} hour average latency and ${prMetrics.averageRevisions.toFixed(1)} revisions per PR.`;
    }
  }

  /**
   * Generate workload-related finding
   * @param issues - Issue data
   * @returns Workload finding text or null
   */
  private generateWorkloadFinding(issues: IssueData[]): string | null {
    // Count issues by assignee
    const assigneeCounts = new Map<string, number>();
    
    for (const issue of issues) {
      if (issue.assignee) {
        assigneeCounts.set(
          issue.assignee,
          (assigneeCounts.get(issue.assignee) || 0) + 1
        );
      }
    }

    if (assigneeCounts.size === 0) {
      return null;
    }

    const counts = Array.from(assigneeCounts.values());
    const maxIssues = Math.max(...counts);
    const minIssues = Math.min(...counts);
    const avgIssues = counts.reduce((sum, count) => sum + count, 0) / counts.length;

    // Check for workload imbalance
    if (maxIssues > avgIssues * 1.5 && assigneeCounts.size > 1) {
      return `Workload imbalance detected: ${assigneeCounts.size} developers with ${minIssues}-${maxIssues} issues each (avg: ${avgIssues.toFixed(1)}).`;
    }

    return null;
  }

  /**
   * Get WIP assessment text
   * @param wipCount - WIP count
   * @returns Assessment text
   */
  private getWIPAssessment(wipCount: number): string {
    if (wipCount <= 3) {
      return 'which is healthy';
    } else if (wipCount <= 6) {
      return 'which is moderate';
    } else if (wipCount <= 10) {
      return 'which is high and may impact flow';
    } else {
      return 'which is very high and likely causing bottlenecks';
    }
  }
}
