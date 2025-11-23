// Core type definitions for Auto Sprint AI

// ============================================================================
// Sprint and Issue Data Types
// ============================================================================

export interface SprintData {
  id: string;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate: string;
  endDate: string;
  goal?: string;
}

export interface StatusTransition {
  fromStatus: string;
  toStatus: string;
  timestamp: string;
}

export interface IssueData {
  id: string;
  key: string;
  summary: string;
  assignee: string | null;
  storyPoints: number | null;
  status: string;
  statusTransitions: StatusTransition[];
  linkedPRs: string[];
}

// ============================================================================
// Pull Request Data Types
// ============================================================================

export interface ReviewerData {
  username: string;
  approvedAt: string | null;
  commentCount: number;
}

export interface PullRequestData {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  firstReviewAt: string | null;
  mergedAt: string | null;
  state: 'OPEN' | 'MERGED' | 'DECLINED';
  reviewers: ReviewerData[];
  revisionCount: number;
  linkedIssues: string[];
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface SprintMetrics {
  cycleTime: number; // average in hours
  leadTime: number; // average in hours
  throughput: number; // completed issues
  velocity: number; // completed story points
  wipCount: number;
  carryOverCount: number;
  completionRate: number; // percentage
}

export interface PRMetrics {
  averageLatency: number; // hours from creation to merge
  averageTimeToFirstReview: number; // hours
  averageReviewCycles: number;
  averageRevisions: number;
}

export interface HistoricalMetrics {
  sprintId: string;
  sprintName: string;
  completedAt: string;
  metrics: SprintMetrics;
  prMetrics: PRMetrics;
}

// ============================================================================
// Risk Assessment Types
// ============================================================================

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface RiskFactor {
  category: 'PR_DELAYS' | 'HIGH_WIP' | 'COMPLEXITY' | 'CARRYOVER' | 'BOTTLENECK';
  severity: number; // 0-10
  description: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0-100
  factors: RiskFactor[];
  justification: string;
}

// ============================================================================
// Recommendation Types
// ============================================================================

export interface Recommendation {
  priority: number; // 1-7
  category: 'SCOPE' | 'REVIEWER' | 'WIP' | 'PROCESS' | 'PLANNING';
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface ReviewerAssignment {
  reviewer: string;
  recommendedPRCount: number;
  rationale: string;
}

export interface NextSprintSuggestions {
  targetStoryPoints: number;
  tasksToInclude: string[];
  tasksToPostpone: string[];
  reviewerAssignments: ReviewerAssignment[];
}

// ============================================================================
// Report Types
// ============================================================================

export interface SprintReport {
  summary: string;
  keyFindings: string[];
  riskAssessment: {
    level: RiskLevel;
    justification: string;
  };
  recommendations: Recommendation[];
  nextSprintSuggestions?: NextSprintSuggestions;
  metrics: {
    sprint: SprintMetrics;
    pullRequests: PRMetrics;
  };
  generatedAt: string;
}

// ============================================================================
// Additional Supporting Types
// ============================================================================

export interface BottleneckInfo {
  location: string; // status name or reviewer
  type: 'STATUS' | 'REVIEWER' | 'DEPENDENCY';
  affectedIssues: string[];
  severity: number; // 0-10
  description: string;
}

export interface DeveloperWorkload {
  username: string;
  activeIssues: number;
  storyPoints: number;
  openPRs: number;
  reviewingPRs: number;
}

export interface SpilloverPrediction {
  issueKey: string;
  probability: number; // 0-1
  reasons: string[];
}
