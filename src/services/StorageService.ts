import { storage } from '@forge/api';
import { SprintData, IssueData, PullRequestData, SprintMetrics, PRMetrics, HistoricalMetrics, SprintReport } from '../types';

/**
 * Storage service using Forge Storage API
 * Provides caching and persistence for sprint data, metrics, and reports
 */
export class StorageService {
  // Cache key prefixes
  private static readonly SPRINT_DATA_PREFIX = 'sprint_data:';
  private static readonly PR_DATA_PREFIX = 'pr_data:';
  private static readonly HISTORICAL_METRICS_PREFIX = 'historical_metrics:';
  private static readonly REPORT_PREFIX = 'report:';
  private static readonly CACHE_METADATA_PREFIX = 'cache_meta:';

  // TTL values in milliseconds
  private static readonly SPRINT_DATA_TTL = 15 * 60 * 1000; // 15 minutes
  private static readonly PR_DATA_TTL = 10 * 60 * 1000; // 10 minutes
  private static readonly REPORT_TTL = 60 * 60 * 1000; // 1 hour
  private static readonly HISTORICAL_METRICS_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Cache sprint data with TTL support
   */
  async cacheSprintData(sprintId: string, data: { sprint: SprintData; issues: IssueData[] }): Promise<void> {
    const key = `${StorageService.SPRINT_DATA_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;
    
    const cacheEntry = {
      data,
      cachedAt: Date.now(),
      ttl: StorageService.SPRINT_DATA_TTL
    };

    await storage.set(key, cacheEntry);
    await storage.set(metaKey, { expiresAt: Date.now() + StorageService.SPRINT_DATA_TTL });
  }

  /**
   * Get cached sprint data if not expired
   */
  async getCachedSprintData(sprintId: string): Promise<{ sprint: SprintData; issues: IssueData[] } | null> {
    const key = `${StorageService.SPRINT_DATA_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    try {
      const cacheEntry = await storage.get(key);
      const metadata = await storage.get(metaKey);

      if (!cacheEntry || !metadata) {
        return null;
      }

      // Check if cache has expired
      if (Date.now() > metadata.expiresAt) {
        // Clear expired cache
        await this.clearCacheEntry(key, metaKey);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error('Error retrieving cached sprint data:', error);
      return null;
    }
  }

  /**
   * Cache pull request data with TTL support
   */
  async cachePRData(sprintId: string, prs: PullRequestData[]): Promise<void> {
    const key = `${StorageService.PR_DATA_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;
    
    const cacheEntry = {
      data: prs,
      cachedAt: Date.now(),
      ttl: StorageService.PR_DATA_TTL
    };

    await storage.set(key, cacheEntry);
    await storage.set(metaKey, { expiresAt: Date.now() + StorageService.PR_DATA_TTL });
  }

  /**
   * Get cached PR data if not expired
   */
  async getCachedPRData(sprintId: string): Promise<PullRequestData[] | null> {
    const key = `${StorageService.PR_DATA_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    try {
      const cacheEntry = await storage.get(key);
      const metadata = await storage.get(metaKey);

      if (!cacheEntry || !metadata) {
        return null;
      }

      // Check if cache has expired
      if (Date.now() > metadata.expiresAt) {
        // Clear expired cache
        await this.clearCacheEntry(key, metaKey);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error('Error retrieving cached PR data:', error);
      return null;
    }
  }

  /**
   * Store historical metrics for a completed sprint
   */
  async storeHistoricalMetrics(
    sprintId: string,
    sprintName: string,
    completedAt: string,
    metrics: SprintMetrics,
    prMetrics: PRMetrics
  ): Promise<void> {
    const historicalMetric: HistoricalMetrics = {
      sprintId,
      sprintName,
      completedAt,
      metrics,
      prMetrics
    };

    const key = `${StorageService.HISTORICAL_METRICS_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    await storage.set(key, historicalMetric);
    await storage.set(metaKey, { expiresAt: Date.now() + StorageService.HISTORICAL_METRICS_TTL });
  }

  /**
   * Get historical metrics for a specific sprint
   */
  async getHistoricalMetric(sprintId: string): Promise<HistoricalMetrics | null> {
    const key = `${StorageService.HISTORICAL_METRICS_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    try {
      const metric = await storage.get(key);
      const metadata = await storage.get(metaKey);

      if (!metric) {
        return null;
      }

      // Check if cache has expired
      if (metadata && Date.now() > metadata.expiresAt) {
        await this.clearCacheEntry(key, metaKey);
        return null;
      }

      return metric;
    } catch (error) {
      console.error('Error retrieving historical metric:', error);
      return null;
    }
  }

  /**
   * Get historical metrics for multiple sprints (for trend analysis)
   * @param _boardId - The board ID (reserved for future use with board-level indexing)
   * @param sprintIds - Array of sprint IDs to retrieve metrics for
   */
  async getHistoricalMetrics(_boardId: string, sprintIds: string[]): Promise<HistoricalMetrics[]> {
    // Note: _boardId is reserved for future use when implementing board-level cache indexing
    const metrics: HistoricalMetrics[] = [];

    for (const sprintId of sprintIds) {
      const metric = await this.getHistoricalMetric(sprintId);
      if (metric) {
        metrics.push(metric);
      }
    }

    // Sort by completion date (most recent first)
    return metrics.sort((a, b) => 
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }

  /**
   * Store a generated sprint report
   */
  async storeReport(sprintId: string, report: SprintReport): Promise<void> {
    const key = `${StorageService.REPORT_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    await storage.set(key, report);
    await storage.set(metaKey, { expiresAt: Date.now() + StorageService.REPORT_TTL });
  }

  /**
   * Get a cached sprint report if not expired
   */
  async getReport(sprintId: string): Promise<SprintReport | null> {
    const key = `${StorageService.REPORT_PREFIX}${sprintId}`;
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;

    try {
      const report = await storage.get(key);
      const metadata = await storage.get(metaKey);

      if (!report) {
        return null;
      }

      // Check if cache has expired
      if (metadata && Date.now() > metadata.expiresAt) {
        await this.clearCacheEntry(key, metaKey);
        return null;
      }

      return report;
    } catch (error) {
      console.error('Error retrieving cached report:', error);
      return null;
    }
  }

  /**
   * Clear a specific cache entry and its metadata
   */
  private async clearCacheEntry(key: string, metaKey: string): Promise<void> {
    try {
      await storage.delete(key);
      await storage.delete(metaKey);
    } catch (error) {
      console.error('Error clearing cache entry:', error);
    }
  }

  /**
   * Clear all expired cache entries
   * This method can be called periodically to clean up stale data
   */
  async clearExpiredCache(): Promise<void> {
    // Note: Forge Storage API doesn't provide a way to list all keys
    // In a real implementation, you might maintain an index of cache keys
    // For now, this is a placeholder that would need to be enhanced
    // based on actual usage patterns
    console.log('Cache cleanup initiated');
  }

  /**
   * Invalidate cache for a specific sprint
   * Useful when sprint data is updated and cache needs to be refreshed
   */
  async invalidateSprintCache(sprintId: string): Promise<void> {
    const sprintDataKey = `${StorageService.SPRINT_DATA_PREFIX}${sprintId}`;
    const sprintDataMetaKey = `${StorageService.CACHE_METADATA_PREFIX}${sprintDataKey}`;
    const prDataKey = `${StorageService.PR_DATA_PREFIX}${sprintId}`;
    const prDataMetaKey = `${StorageService.CACHE_METADATA_PREFIX}${prDataKey}`;
    const reportKey = `${StorageService.REPORT_PREFIX}${sprintId}`;
    const reportMetaKey = `${StorageService.CACHE_METADATA_PREFIX}${reportKey}`;

    await Promise.all([
      this.clearCacheEntry(sprintDataKey, sprintDataMetaKey),
      this.clearCacheEntry(prDataKey, prDataMetaKey),
      this.clearCacheEntry(reportKey, reportMetaKey)
    ]);
  }

  /**
   * Check if a cache entry exists and is valid
   */
  async isCacheValid(key: string): Promise<boolean> {
    const metaKey = `${StorageService.CACHE_METADATA_PREFIX}${key}`;
    
    try {
      const metadata = await storage.get(metaKey);
      if (!metadata) {
        return false;
      }

      return Date.now() <= metadata.expiresAt;
    } catch (error) {
      return false;
    }
  }
}
