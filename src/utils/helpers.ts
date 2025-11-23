// Utility helper functions

/**
 * Calculate the difference in hours between two dates
 */
export function calculateHoursDifference(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate the difference in days between two dates
 */
export function calculateDaysDifference(startDate: string, endDate: string): number {
  return calculateHoursDifference(startDate, endDate) / 24;
}

/**
 * Format a date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: string): boolean {
  return new Date(date) < new Date();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}
