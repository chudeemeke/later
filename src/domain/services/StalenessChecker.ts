/**
 * Staleness Checker Service
 *
 * Domain service for determining when items need attention.
 * Checks time-based staleness, context freshness, and activity triggers.
 */

import { Item } from '../entities/Item.js';

/**
 * Staleness configuration
 */
export interface StalenessConfig {
  /** Days until item is considered stale (default: 30) */
  defaultThresholdDays: number;

  /** Days for high priority items (default: 7) */
  highPriorityThresholdDays: number;

  /** Days for in-progress items (default: 14) */
  inProgressThresholdDays: number;

  /** Weight for time factor (0-1, default: 0.4) */
  timeWeight: number;

  /** Weight for priority factor (0-1, default: 0.3) */
  priorityWeight: number;

  /** Weight for activity factor (0-1, default: 0.3) */
  activityWeight: number;
}

/**
 * Default staleness configuration
 */
export const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  defaultThresholdDays: 30,
  highPriorityThresholdDays: 7,
  inProgressThresholdDays: 14,
  timeWeight: 0.4,
  priorityWeight: 0.3,
  activityWeight: 0.3,
};

/**
 * Staleness check result for a single item
 */
export interface StalenessResult {
  itemId: number;
  isStale: boolean;
  stalenessScore: number; // 0-1, higher = more stale
  daysSinceUpdate: number;
  applicableThreshold: number;
  factors: {
    timeFactor: number;
    priorityFactor: number;
    activityFactor: number;
  };
  recommendation?: 'review' | 'refresh' | 'archive' | 'none';
}

/**
 * Context staleness result
 */
export interface ContextStalenessResult {
  itemId: number;
  isContextStale: boolean;
  staleness: number; // 0-1
  reason?: string;
  changedFiles?: string[];
}

/**
 * Batch staleness report
 */
export interface StalenessReport {
  totalItems: number;
  staleItems: number;
  criticalItems: number;
  avgStaleness: number;
  itemsByRecommendation: {
    review: number[];
    refresh: number[];
    archive: number[];
    none: number[];
  };
  mostStale: Array<{ itemId: number; score: number }>;
}

/**
 * Staleness Checker Service
 */
export class StalenessChecker {
  private config: StalenessConfig;

  constructor(config: Partial<StalenessConfig> = {}) {
    this.config = { ...DEFAULT_STALENESS_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<StalenessConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check staleness of a single item
   */
  checkItem(item: Item): StalenessResult {
    // Skip completed/archived items
    if (item.isComplete()) {
      return {
        itemId: item.id.value,
        isStale: false,
        stalenessScore: 0,
        daysSinceUpdate: item.daysSinceUpdate(),
        applicableThreshold: this.config.defaultThresholdDays,
        factors: { timeFactor: 0, priorityFactor: 0, activityFactor: 0 },
        recommendation: 'none',
      };
    }

    const daysSinceUpdate = item.daysSinceUpdate();
    const threshold = this.getThresholdForItem(item);
    const factors = this.calculateFactors(item, daysSinceUpdate, threshold);
    const score = this.calculateScore(factors);
    const isStale = score >= 0.5;

    return {
      itemId: item.id.value,
      isStale,
      stalenessScore: score,
      daysSinceUpdate,
      applicableThreshold: threshold,
      factors,
      recommendation: this.getRecommendation(item, score, daysSinceUpdate),
    };
  }

  /**
   * Get threshold based on item characteristics
   */
  private getThresholdForItem(item: Item): number {
    if (item.priority.value === 'high') {
      return this.config.highPriorityThresholdDays;
    }

    if (item.status.isInProgress()) {
      return this.config.inProgressThresholdDays;
    }

    return this.config.defaultThresholdDays;
  }

  /**
   * Calculate individual staleness factors
   */
  private calculateFactors(
    item: Item,
    daysSinceUpdate: number,
    threshold: number
  ): { timeFactor: number; priorityFactor: number; activityFactor: number } {
    // Time factor: How much of threshold has elapsed
    const timeFactor = Math.min(1, daysSinceUpdate / threshold);

    // Priority factor: Higher priority = faster staleness
    const priorityWeights: Record<string, number> = {
      high: 1.0,
      medium: 0.5,
      low: 0.25,
    };
    const priorityFactor = priorityWeights[item.priority.value] ?? 0.5;

    // Activity factor: Based on status
    let activityFactor = 0;
    if (item.status.isInProgress()) {
      // In-progress items need more attention
      activityFactor = 0.8;
    } else if (item.status.isPending()) {
      // Pending items with dependencies are more urgent
      activityFactor = item.hasDependencies() ? 0.6 : 0.4;
    }

    return { timeFactor, priorityFactor, activityFactor };
  }

  /**
   * Calculate overall staleness score
   */
  private calculateScore(factors: {
    timeFactor: number;
    priorityFactor: number;
    activityFactor: number;
  }): number {
    const score =
      factors.timeFactor * this.config.timeWeight +
      factors.priorityFactor * this.config.priorityWeight +
      factors.activityFactor * this.config.activityWeight;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Get recommendation based on staleness
   */
  private getRecommendation(
    item: Item,
    score: number,
    daysSinceUpdate: number
  ): 'review' | 'refresh' | 'archive' | 'none' {
    // Very stale and low priority - consider archiving
    // Use direct time check rather than score for archive (score caps out)
    if (
      item.priority.value === 'low' &&
      daysSinceUpdate > this.config.defaultThresholdDays * 2.5
    ) {
      return 'archive';
    }

    // Stale with context - needs refresh
    if (score >= 0.6 && item.context && item.context.length > 0) {
      return 'refresh';
    }

    // Moderately stale - needs review
    if (score >= 0.5) {
      return 'review';
    }

    return 'none';
  }

  /**
   * Check staleness of multiple items
   */
  checkItems(items: Item[]): StalenessResult[] {
    return items.map((item) => this.checkItem(item));
  }

  /**
   * Get stale items only
   */
  getStaleItems(items: Item[], minScore?: number): StalenessResult[] {
    const threshold = minScore ?? 0.5;
    return this.checkItems(items).filter(
      (result) => result.stalenessScore >= threshold
    );
  }

  /**
   * Generate staleness report
   */
  generateReport(items: Item[]): StalenessReport {
    const results = this.checkItems(items);
    const activeResults = results.filter(
      (r) => r.recommendation !== 'none' || r.isStale
    );

    const staleResults = results.filter((r) => r.isStale);
    const criticalResults = results.filter((r) => r.stalenessScore >= 0.8);

    const avgStaleness =
      activeResults.length > 0
        ? activeResults.reduce((sum, r) => sum + r.stalenessScore, 0) /
          activeResults.length
        : 0;

    const itemsByRecommendation = {
      review: results.filter((r) => r.recommendation === 'review').map((r) => r.itemId),
      refresh: results.filter((r) => r.recommendation === 'refresh').map((r) => r.itemId),
      archive: results.filter((r) => r.recommendation === 'archive').map((r) => r.itemId),
      none: results.filter((r) => r.recommendation === 'none').map((r) => r.itemId),
    };

    const mostStale = results
      .filter((r) => r.isStale)
      .sort((a, b) => b.stalenessScore - a.stalenessScore)
      .slice(0, 10)
      .map((r) => ({ itemId: r.itemId, score: r.stalenessScore }));

    return {
      totalItems: items.length,
      staleItems: staleResults.length,
      criticalItems: criticalResults.length,
      avgStaleness,
      itemsByRecommendation,
      mostStale,
    };
  }

  /**
   * Check if context files have changed
   * (Uses file hashes stored in item)
   */
  checkContextStaleness(
    item: Item,
    currentFileHashes: Record<string, string>
  ): ContextStalenessResult {
    const contextFiles = item.contextFiles;

    if (!contextFiles || contextFiles.length === 0) {
      return {
        itemId: item.id.value,
        isContextStale: false,
        staleness: 0,
        reason: 'No context files tracked',
      };
    }

    // Check for missing or changed files
    const changedFiles: string[] = [];
    let missingFiles = 0;

    // Parse stored hashes if available
    let storedHashes: Record<string, string> = {};
    if (item.contextHash) {
      try {
        storedHashes = JSON.parse(item.contextHash);
      } catch {
        // Not JSON, might be single hash - treat as unknown
      }
    }

    for (const file of contextFiles) {
      const currentHash = currentFileHashes[file];
      const storedHash = storedHashes[file];

      if (!currentHash) {
        // File might be deleted
        missingFiles++;
        changedFiles.push(file);
      } else if (storedHash && currentHash !== storedHash) {
        changedFiles.push(file);
      }
    }

    const changedRatio = changedFiles.length / contextFiles.length;
    const isStale = changedRatio > 0.2 || missingFiles > 0;

    let reason = '';
    if (missingFiles > 0) {
      reason = `${missingFiles} context file(s) no longer exist`;
    } else if (changedFiles.length > 0) {
      reason = `${changedFiles.length} context file(s) have changed`;
    }

    return {
      itemId: item.id.value,
      isContextStale: isStale,
      staleness: changedRatio,
      reason,
      changedFiles,
    };
  }

  /**
   * Get items needing immediate attention
   * (Critical staleness or high priority + stale)
   */
  getUrgentItems(items: Item[]): StalenessResult[] {
    return this.checkItems(items).filter((result) => {
      // Critical staleness (score >= 0.65 is realistically achievable)
      if (result.stalenessScore >= 0.65) {
        return true;
      }

      // High priority and stale
      const item = items.find((i) => i.id.value === result.itemId);
      if (item && item.priority.value === 'high' && result.isStale) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get configuration
   */
  getConfig(): StalenessConfig {
    return { ...this.config };
  }
}
