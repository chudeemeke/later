/**
 * MCP Get Retrospective Stats Handler
 *
 * Wraps GetRetrospectiveStatsQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface GetRetrospectiveStatsArgs {
  include_detailed_analysis?: boolean;
  include_lessons_summary?: boolean;
  after_date?: string;
  before_date?: string;
}

/**
 * Basic stats in MCP format
 */
export interface RetrospectiveStatsMCP {
  total: number;
  by_outcome: Record<string, number>;
  avg_accuracy: number | null;
  avg_variance: number | null;
}

/**
 * Detailed analysis in MCP format
 */
export interface DetailedAnalysisMCP {
  success_rate: number;
  total_time_saved: number;
  total_cost_saved: number;
  avg_time_saved: number;
  avg_cost_saved: number;
  items_with_impact: number;
  underestimation_rate: number;
  overestimation_rate: number;
  avg_effort_variance: number;
}

/**
 * Lessons summary in MCP format
 */
export interface LessonsSummaryMCP {
  total_with_lessons: number;
  lessons: Array<{
    item_id: number;
    outcome: string;
    lessons: string;
  }>;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface GetRetrospectiveStatsResult {
  success: boolean;
  stats?: RetrospectiveStatsMCP;
  detailed_analysis?: DetailedAnalysisMCP;
  lessons_summary?: LessonsSummaryMCP;
  error?: string;
}

/**
 * Create a get retrospective stats handler bound to the container
 */
export function createGetRetrospectiveStatsHandler(
  container: Container
): (args: GetRetrospectiveStatsArgs) => Promise<GetRetrospectiveStatsResult> {
  return async (args: GetRetrospectiveStatsArgs): Promise<GetRetrospectiveStatsResult> => {
    // Parse dates if provided
    const afterDate = args.after_date ? new Date(args.after_date) : undefined;
    const beforeDate = args.before_date ? new Date(args.before_date) : undefined;

    // Execute the application query
    const result = await container.queries.getRetrospectiveStats.execute({
      includeDetailedAnalysis: args.include_detailed_analysis,
      includeLessonsSummary: args.include_lessons_summary,
      afterDate,
      beforeDate,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: GetRetrospectiveStatsResult = {
      success: true,
    };

    // Transform basic stats
    if (result.stats) {
      mcpResult.stats = {
        total: result.stats.total,
        by_outcome: result.stats.byOutcome,
        avg_accuracy: result.stats.avgAccuracy,
        avg_variance: result.stats.avgVariance,
      };
    }

    // Transform detailed analysis if included
    if (result.detailedAnalysis) {
      mcpResult.detailed_analysis = {
        success_rate: result.detailedAnalysis.successRate,
        total_time_saved: result.detailedAnalysis.totalTimeSaved,
        total_cost_saved: result.detailedAnalysis.totalCostSaved,
        avg_time_saved: result.detailedAnalysis.avgTimeSaved,
        avg_cost_saved: result.detailedAnalysis.avgCostSaved,
        items_with_impact: result.detailedAnalysis.itemsWithImpact,
        underestimation_rate: result.detailedAnalysis.underestimationRate,
        overestimation_rate: result.detailedAnalysis.overestimationRate,
        avg_effort_variance: result.detailedAnalysis.avgEffortVariance,
      };
    }

    // Transform lessons summary if included
    if (result.lessonsSummary) {
      mcpResult.lessons_summary = {
        total_with_lessons: result.lessonsSummary.totalWithLessons,
        lessons: result.lessonsSummary.lessons.map((l) => ({
          item_id: l.itemId,
          outcome: l.outcome,
          lessons: l.lessons,
        })),
      };
    }

    return mcpResult;
  };
}
