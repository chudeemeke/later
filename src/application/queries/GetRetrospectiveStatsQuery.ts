/**
 * Get Retrospective Stats Query
 *
 * Retrieves aggregate statistics from all retrospectives.
 */

import {
  Retrospective,
  RetrospectiveProps,
} from '../../domain/entities/Retrospective.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';

/**
 * Query input
 */
export interface GetRetrospectiveStatsInput {
  includeDetailedAnalysis?: boolean;
  includeLessonsSummary?: boolean;
  afterDate?: Date;
  beforeDate?: Date;
}

/**
 * Basic stats from storage
 */
export interface RetrospectiveBasicStats {
  total: number;
  byOutcome: Record<string, number>;
  avgAccuracy: number | null;
  avgVariance: number | null;
}

/**
 * Detailed analysis
 */
export interface RetrospectiveDetailedAnalysis {
  successRate: number;
  totalTimeSaved: number;
  totalCostSaved: number;
  avgTimeSaved: number;
  avgCostSaved: number;
  itemsWithImpact: number;
  underestimationRate: number;
  overestimationRate: number;
  avgEffortVariance: number;
}

/**
 * Lessons summary
 */
export interface LessonsSummary {
  totalWithLessons: number;
  lessons: Array<{
    itemId: number;
    outcome: string;
    lessons: string;
  }>;
}

/**
 * Query result
 */
export interface GetRetrospectiveStatsResult {
  success: boolean;
  stats?: RetrospectiveBasicStats;
  detailedAnalysis?: RetrospectiveDetailedAnalysis;
  lessonsSummary?: LessonsSummary;
  error?: string;
}

/**
 * Get Retrospective Stats Query Handler
 */
export class GetRetrospectiveStatsQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetRetrospectiveStatsInput): Promise<GetRetrospectiveStatsResult> {
    try {
      // Get basic stats from storage
      const stats = await this.storage.getRetrospectiveStats();

      const result: GetRetrospectiveStatsResult = {
        success: true,
        stats,
      };

      // Include detailed analysis if requested
      if (input.includeDetailedAnalysis || input.includeLessonsSummary) {
        const retrospectives = await this.storage.listRetrospectives();

        // Filter by date if specified
        const filtered = this.filterByDate(retrospectives, input.afterDate, input.beforeDate);

        if (input.includeDetailedAnalysis) {
          result.detailedAnalysis = this.calculateDetailedAnalysis(filtered);
        }

        if (input.includeLessonsSummary) {
          result.lessonsSummary = this.buildLessonsSummary(filtered);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Filter retrospectives by date range
   */
  private filterByDate(
    retrospectives: RetrospectiveProps[],
    afterDate?: Date,
    beforeDate?: Date
  ): RetrospectiveProps[] {
    return retrospectives.filter((r) => {
      const completedAt = new Date(r.completedAt);
      if (afterDate && completedAt < afterDate) return false;
      if (beforeDate && completedAt > beforeDate) return false;
      return true;
    });
  }

  /**
   * Calculate detailed analysis metrics
   */
  private calculateDetailedAnalysis(
    retrospectives: RetrospectiveProps[]
  ): RetrospectiveDetailedAnalysis {
    if (retrospectives.length === 0) {
      return {
        successRate: 0,
        totalTimeSaved: 0,
        totalCostSaved: 0,
        avgTimeSaved: 0,
        avgCostSaved: 0,
        itemsWithImpact: 0,
        underestimationRate: 0,
        overestimationRate: 0,
        avgEffortVariance: 0,
      };
    }

    // Count outcomes
    const successCount = retrospectives.filter(
      (r) => r.outcome === 'success'
    ).length;

    // Calculate time/cost savings
    let totalTimeSaved = 0;
    let totalCostSaved = 0;
    let itemsWithTimeSaved = 0;
    let itemsWithCostSaved = 0;
    let itemsWithImpact = 0;

    for (const r of retrospectives) {
      if (r.impactTimeSaved !== undefined && r.impactTimeSaved > 0) {
        totalTimeSaved += r.impactTimeSaved;
        itemsWithTimeSaved++;
        itemsWithImpact++;
      }
      if (r.impactCostSaved !== undefined && r.impactCostSaved > 0) {
        totalCostSaved += r.impactCostSaved;
        itemsWithCostSaved++;
        if (r.impactTimeSaved === undefined || r.impactTimeSaved === 0) {
          itemsWithImpact++;
        }
      }
    }

    // Calculate estimation metrics
    let underestimatedCount = 0;
    let overestimatedCount = 0;
    let totalVariance = 0;
    let itemsWithEffort = 0;

    for (const r of retrospectives) {
      if (r.effortEstimated !== undefined && r.effortActual !== undefined) {
        itemsWithEffort++;
        const variance = r.effortActual - r.effortEstimated;
        totalVariance += variance;

        if (r.effortActual > r.effortEstimated) {
          underestimatedCount++;
        } else if (r.effortActual < r.effortEstimated) {
          overestimatedCount++;
        }
      }
    }

    return {
      successRate: (successCount / retrospectives.length) * 100,
      totalTimeSaved,
      totalCostSaved,
      avgTimeSaved: itemsWithTimeSaved > 0 ? totalTimeSaved / itemsWithTimeSaved : 0,
      avgCostSaved: itemsWithCostSaved > 0 ? totalCostSaved / itemsWithCostSaved : 0,
      itemsWithImpact,
      underestimationRate:
        itemsWithEffort > 0 ? (underestimatedCount / itemsWithEffort) * 100 : 0,
      overestimationRate:
        itemsWithEffort > 0 ? (overestimatedCount / itemsWithEffort) * 100 : 0,
      avgEffortVariance: itemsWithEffort > 0 ? totalVariance / itemsWithEffort : 0,
    };
  }

  /**
   * Build lessons summary
   */
  private buildLessonsSummary(retrospectives: RetrospectiveProps[]): LessonsSummary {
    const lessonsItems = retrospectives.filter(
      (r) => r.lessonsLearned && r.lessonsLearned.trim().length > 0
    );

    return {
      totalWithLessons: lessonsItems.length,
      lessons: lessonsItems.map((r) => ({
        itemId: r.itemId,
        outcome: r.outcome,
        lessons: r.lessonsLearned!,
      })),
    };
  }
}
