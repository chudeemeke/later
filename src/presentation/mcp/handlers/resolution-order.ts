/**
 * MCP Resolution Order Handler
 *
 * Wraps GetResolutionOrderQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface ResolutionOrderArgs {
  include_completed?: boolean;
  include_stats?: boolean;
  include_next_actions?: boolean;
  priority_filter?: PriorityValue[];
  tag_filter?: string[];
  limit?: number;
}

/**
 * Ordered item in MCP format
 */
export interface OrderedItemMCP {
  id: number;
  decision: string;
  status: string;
  priority: string;
  tags: string[];
  is_blocked: boolean;
  blocker_count: number;
  order: number;
}

/**
 * Resolution stats in MCP format
 */
export interface ResolutionStatsMCP {
  total_items: number;
  items_with_dependencies: number;
  blocked_items: number;
  max_depth: number;
}

/**
 * Next action in MCP format
 */
export interface NextActionMCP {
  id: number;
  decision: string;
  priority: string;
  reason: string;
  unblocks: number;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface ResolutionOrderResult {
  success: boolean;
  order?: OrderedItemMCP[];
  stats?: ResolutionStatsMCP;
  next_actions?: NextActionMCP[];
  error?: string;
}

/**
 * Create a resolution order handler bound to the container
 */
export function createResolutionOrderHandler(
  container: Container
): (args: ResolutionOrderArgs) => Promise<ResolutionOrderResult> {
  return async (args: ResolutionOrderArgs): Promise<ResolutionOrderResult> => {
    // Execute the application query
    const result = await container.queries.getResolutionOrder.execute({
      includeCompleted: args.include_completed,
      includeStats: args.include_stats,
      includeNextActions: args.include_next_actions,
      priorityFilter: args.priority_filter,
      tagFilter: args.tag_filter,
      limit: args.limit,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: ResolutionOrderResult = {
      success: true,
    };

    // Transform order
    if (result.order) {
      mcpResult.order = result.order.map((item) => ({
        id: item.id,
        decision: item.decision,
        status: item.status,
        priority: item.priority,
        tags: item.tags,
        is_blocked: item.isBlocked,
        blocker_count: item.blockerCount,
        order: item.order,
      }));
    }

    // Transform stats
    if (result.stats) {
      mcpResult.stats = {
        total_items: result.stats.totalItems,
        items_with_dependencies: result.stats.itemsWithDependencies,
        blocked_items: result.stats.blockedItems,
        max_depth: result.stats.maxDepth,
      };
    }

    // Transform next actions
    if (result.nextActions) {
      mcpResult.next_actions = result.nextActions.map((action) => ({
        id: action.id,
        decision: action.decision,
        priority: action.priority,
        reason: action.reason,
        unblocks: action.unblocks,
      }));
    }

    return mcpResult;
  };
}
