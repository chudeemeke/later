/**
 * MCP Update Retrospective Handler
 *
 * Wraps UpdateRetrospectiveCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { OutcomeValue } from '../../../domain/value-objects/Outcome.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface UpdateRetrospectiveArgs {
  item_id: number;
  outcome?: OutcomeValue;
  impact_time_saved?: number;
  impact_cost_saved?: number;
  effort_estimated?: number;
  effort_actual?: number;
  lessons_learned?: string;
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
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface UpdateRetrospectiveResult {
  success: boolean;
  retrospective?: RetrospectiveMCP;
  message?: string;
  error?: string;
}

/**
 * Create an update retrospective handler bound to the container
 */
export function createUpdateRetrospectiveHandler(
  container: Container
): (args: UpdateRetrospectiveArgs) => Promise<UpdateRetrospectiveResult> {
  return async (args: UpdateRetrospectiveArgs): Promise<UpdateRetrospectiveResult> => {
    // Execute the application command
    const result = await container.commands.updateRetrospective.execute({
      itemId: args.item_id,
      outcome: args.outcome,
      impactTimeSaved: args.impact_time_saved,
      impactCostSaved: args.impact_cost_saved,
      effortEstimated: args.effort_estimated,
      effortActual: args.effort_actual,
      lessonsLearned: args.lessons_learned,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: UpdateRetrospectiveResult = {
      success: true,
      message: `Retrospective for item #${args.item_id} updated`,
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

    return mcpResult;
  };
}
