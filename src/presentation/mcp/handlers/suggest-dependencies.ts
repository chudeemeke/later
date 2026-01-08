/**
 * MCP Suggest Dependencies Handler
 *
 * Wraps SuggestDependenciesQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { DependencyTypeValue } from '../../../domain/value-objects/DependencyType.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface SuggestDependenciesArgs {
  item_id: number;
  limit?: number;
  min_confidence?: number;
  include_completed?: boolean;
  include_target_details?: boolean;
}

/**
 * Suggested dependency in MCP format
 */
export interface SuggestedDependencyMCP {
  target_id: number;
  suggested_type: DependencyTypeValue;
  confidence: number;
  reason: string;
  target_decision?: string;
  target_status?: string;
  target_priority?: string;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface SuggestDependenciesResult {
  success: boolean;
  suggestions?: SuggestedDependencyMCP[];
  error?: string;
}

/**
 * Create a suggest dependencies handler bound to the container
 */
export function createSuggestDependenciesHandler(
  container: Container
): (args: SuggestDependenciesArgs) => Promise<SuggestDependenciesResult> {
  return async (args: SuggestDependenciesArgs): Promise<SuggestDependenciesResult> => {
    // Execute the application query
    const result = await container.queries.suggestDependencies.execute({
      itemId: args.item_id,
      limit: args.limit,
      minConfidence: args.min_confidence,
      includeCompleted: args.include_completed,
      includeTargetDetails: args.include_target_details,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: SuggestDependenciesResult = {
      success: true,
    };

    // Transform suggestions
    if (result.suggestions) {
      mcpResult.suggestions = result.suggestions.map((s) => ({
        target_id: s.targetId,
        suggested_type: s.suggestedType,
        confidence: s.confidence,
        reason: s.reason,
        target_decision: s.targetDecision,
        target_status: s.targetStatus,
        target_priority: s.targetPriority,
      }));
    }

    return mcpResult;
  };
}
