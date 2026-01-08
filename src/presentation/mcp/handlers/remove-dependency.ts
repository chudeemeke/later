/**
 * MCP Remove Dependency Handler
 *
 * Wraps RemoveDependencyCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { DependencyTypeValue } from '../../../domain/value-objects/DependencyType.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface RemoveDependencyArgs {
  item_id: number;
  depends_on_id: number;
  type?: DependencyTypeValue;
  report_unblocked?: boolean;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface RemoveDependencyResult {
  success: boolean;
  message?: string;
  error?: string;
  not_found?: boolean;
  unblocked_items?: number[];
}

/**
 * Create a remove dependency handler bound to the container
 */
export function createRemoveDependencyHandler(
  container: Container
): (args: RemoveDependencyArgs) => Promise<RemoveDependencyResult> {
  return async (args: RemoveDependencyArgs): Promise<RemoveDependencyResult> => {
    // Execute the application command
    const result = await container.commands.removeDependency.execute({
      itemId: args.item_id,
      dependsOnId: args.depends_on_id,
      type: args.type,
      reportUnblocked: args.report_unblocked,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      const mcpResult: RemoveDependencyResult = {
        success: false,
        error: result.error || 'Unknown error',
      };

      if (result.notFound) {
        mcpResult.not_found = true;
      }

      return mcpResult;
    }

    const mcpResult: RemoveDependencyResult = {
      success: true,
      message: `Dependency removed: #${args.item_id} -> #${args.depends_on_id}`,
    };

    // Include unblocked items if requested
    if (result.unblockedItems && result.unblockedItems.length > 0) {
      mcpResult.unblocked_items = result.unblockedItems;
      mcpResult.message += `\nUnblocked items: ${result.unblockedItems.map((id) => `#${id}`).join(', ')}`;
    }

    return mcpResult;
  };
}
