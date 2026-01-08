/**
 * MCP Do Handler
 *
 * Wraps CompleteItemCommand for MCP tool interface.
 * Marks an item as done with optional retrospective.
 */

import type { Container } from '../../composition-root.js';
import type { OutcomeValue } from '../../../domain/value-objects/Outcome.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface DoArgs {
  id: number;
  outcome?: OutcomeValue;
  lessons_learned?: string;
  impact_time_saved?: number;
  impact_cost_saved?: number;
  effort_estimated?: number;
  effort_actual?: number;
  force?: boolean; // Force complete even if blocked
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface DoResult {
  success: boolean;
  message?: string;
  error?: string;
  blocked_by?: Array<{
    id: number;
    decision: string;
  }>;
  retrospective_created?: boolean;
}

/**
 * Create a do handler bound to the container
 */
export function createDoHandler(
  container: Container
): (args: DoArgs) => Promise<DoResult> {
  return async (args: DoArgs): Promise<DoResult> => {
    // Validate ID
    if (!args.id || args.id <= 0) {
      return {
        success: false,
        error: 'Valid item ID is required',
      };
    }

    // Build retrospective if outcome provided
    const hasRetrospective =
      args.outcome ||
      args.lessons_learned ||
      args.impact_time_saved !== undefined ||
      args.impact_cost_saved !== undefined ||
      args.effort_estimated !== undefined ||
      args.effort_actual !== undefined;

    // Execute the application command
    const result = await container.commands.complete.execute({
      id: args.id,
      force: args.force,
      retrospective: hasRetrospective
        ? {
            outcome: args.outcome || 'success',
            lessonsLearned: args.lessons_learned,
            impactTimeSaved: args.impact_time_saved,
            impactCostSaved: args.impact_cost_saved,
            effortEstimated: args.effort_estimated,
            effortActual: args.effort_actual,
          }
        : undefined,
    });

    // Handle errors
    if (!result.success) {
      const doResult: DoResult = {
        success: false,
        error: result.error || 'Unknown error',
      };

      // Include blocking info if applicable
      if (result.blockedBy && result.blockedBy.length > 0) {
        doResult.blocked_by = result.blockedBy;
        doResult.error = `Item is blocked by ${result.blockedBy.length} unresolved item(s). Use force=true to complete anyway.`;
      }

      return doResult;
    }

    return {
      success: true,
      message: `Item #${args.id} marked as done`,
      retrospective_created: result.retrospective !== undefined,
    };
  };
}
