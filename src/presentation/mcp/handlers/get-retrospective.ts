/**
 * MCP Get Retrospective Handler
 *
 * Wraps GetRetrospectiveQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { OutcomeValue } from '../../../domain/value-objects/Outcome.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface GetRetrospectiveArgs {
  item_id: number;
  include_item_details?: boolean;
  include_analysis?: boolean;
}

/**
 * Retrospective analysis in MCP format
 */
export interface RetrospectiveAnalysisMCP {
  estimation_accuracy?: number;
  effort_variance?: number;
  was_underestimated: boolean;
  was_overestimated: boolean;
  is_positive: boolean;
  has_impact: boolean;
  has_lessons: boolean;
}

/**
 * Retrospective in MCP format
 */
export interface RetrospectiveMCP {
  item_id: number;
  outcome: OutcomeValue;
  impact_time_saved?: number;
  impact_cost_saved?: number;
  effort_estimated?: number;
  effort_actual?: number;
  lessons_learned?: string;
  completed_at: string;
}

/**
 * Item in MCP format
 */
export interface ItemDetailMCP {
  id: number;
  decision: string;
  context?: string;
  status: string;
  priority: string;
  tags: string[];
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface GetRetrospectiveResult {
  success: boolean;
  retrospective?: RetrospectiveMCP;
  item?: ItemDetailMCP;
  analysis?: RetrospectiveAnalysisMCP;
  error?: string;
}

/**
 * Create a get retrospective handler bound to the container
 */
export function createGetRetrospectiveHandler(
  container: Container
): (args: GetRetrospectiveArgs) => Promise<GetRetrospectiveResult> {
  return async (args: GetRetrospectiveArgs): Promise<GetRetrospectiveResult> => {
    // Execute the application query
    const result = await container.queries.getRetrospective.execute({
      itemId: args.item_id,
      includeItemDetails: args.include_item_details,
      includeAnalysis: args.include_analysis,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: GetRetrospectiveResult = {
      success: true,
    };

    // Transform retrospective
    if (result.retrospective) {
      mcpResult.retrospective = {
        item_id: result.retrospective.itemId,
        outcome: result.retrospective.outcome,
        impact_time_saved: result.retrospective.impactTimeSaved,
        impact_cost_saved: result.retrospective.impactCostSaved,
        effort_estimated: result.retrospective.effortEstimated,
        effort_actual: result.retrospective.effortActual,
        lessons_learned: result.retrospective.lessonsLearned,
        completed_at: result.retrospective.completedAt.toISOString(),
      };
    }

    // Transform item if included
    if (result.item) {
      mcpResult.item = {
        id: result.item.id,
        decision: result.item.decision,
        context: result.item.context,
        status: result.item.status,
        priority: result.item.priority,
        tags: result.item.tags,
      };
    }

    // Transform analysis if included
    if (result.analysis) {
      mcpResult.analysis = {
        estimation_accuracy: result.analysis.estimationAccuracy,
        effort_variance: result.analysis.effortVariance,
        was_underestimated: result.analysis.wasUnderestimated,
        was_overestimated: result.analysis.wasOverestimated,
        is_positive: result.analysis.isPositive,
        has_impact: result.analysis.hasImpact,
        has_lessons: result.analysis.hasLessons,
      };
    }

    return mcpResult;
  };
}
