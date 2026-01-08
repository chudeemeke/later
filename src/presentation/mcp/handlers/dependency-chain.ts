/**
 * MCP Dependency Chain Handler
 *
 * Wraps GetDependencyChainQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface DependencyChainArgs {
  item_id: number;
  include_item_details?: boolean;
  include_all_types?: boolean;
  include_dependents?: boolean;
  include_visualization?: boolean;
}

/**
 * Chain item detail in MCP format
 */
export interface ChainItemDetailMCP {
  id: number;
  decision: string;
  status: string;
  priority: string;
}

/**
 * Dependency summary in MCP format
 */
export interface DependencySummaryMCP {
  item_id: number;
  depends_on_id: number;
  type: string;
  depends_on_decision?: string;
  depends_on_status?: string;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface DependencyChainResult {
  success: boolean;
  chain?: {
    item_id: number;
    depth: number;
    path: number[];
    total_blockers: number;
  };
  chain_details?: ChainItemDetailMCP[];
  all_dependencies?: DependencySummaryMCP[];
  would_unblock?: number[];
  visualization?: string;
  error?: string;
}

/**
 * Create a dependency chain handler bound to the container
 */
export function createDependencyChainHandler(
  container: Container
): (args: DependencyChainArgs) => Promise<DependencyChainResult> {
  return async (args: DependencyChainArgs): Promise<DependencyChainResult> => {
    // Execute the application query
    const result = await container.queries.getDependencyChain.execute({
      itemId: args.item_id,
      includeItemDetails: args.include_item_details,
      includeAllTypes: args.include_all_types,
      includeDependents: args.include_dependents,
      includeVisualization: args.include_visualization,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: DependencyChainResult = {
      success: true,
    };

    // Transform chain info
    if (result.chain) {
      mcpResult.chain = {
        item_id: result.chain.itemId,
        depth: result.chain.depth,
        path: result.chain.path,
        total_blockers: result.chain.totalBlockers,
      };
    }

    // Transform chain details
    if (result.chainDetails) {
      mcpResult.chain_details = result.chainDetails.map((d) => ({
        id: d.id,
        decision: d.decision,
        status: d.status,
        priority: d.priority,
      }));
    }

    // Transform all dependencies
    if (result.allDependencies) {
      mcpResult.all_dependencies = result.allDependencies.map((d) => ({
        item_id: d.itemId,
        depends_on_id: d.dependsOnId,
        type: d.type,
        depends_on_decision: d.dependsOnDecision,
        depends_on_status: d.dependsOnStatus,
      }));
    }

    // Include would unblock list
    if (result.wouldUnblock) {
      mcpResult.would_unblock = result.wouldUnblock;
    }

    // Include visualization
    if (result.visualization) {
      mcpResult.visualization = result.visualization;
    }

    return mcpResult;
  };
}
