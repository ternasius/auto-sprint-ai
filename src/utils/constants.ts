// Application constants

export const CACHE_TTL = {
  SPRINT_DATA: 15 * 60 * 1000, // 15 minutes
  PR_DATA: 10 * 60 * 1000, // 10 minutes
  HISTORICAL_METRICS: 24 * 60 * 60 * 1000, // 24 hours
  REPORTS: 60 * 60 * 1000, // 1 hour
};

export const RISK_THRESHOLDS = {
  LOW: 33,
  MEDIUM: 66,
  HIGH: 100,
};

export const WORKLOAD_THRESHOLDS = {
  HIGH_WIP: 5,
  REVIEWER_OVERLOAD: 8,
};

export const COMPLETION_RATE_THRESHOLD = 0.7; // 70%
export const PR_DELAY_THRESHOLD = 0.3; // 30% above baseline
