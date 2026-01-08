/**
 * MCP Add Dependency Handler
 *
 * Wraps AddDependencyCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { DependencyTypeValue } from '../../../domain/value-objects/DependencyType.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface AddDependencyArgs {
  item_id: number;
  depends_on_id: number;
  type?: DependencyTypeValue;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface AddDependencyResult {
  success: boolean;
  message?: string;
  error?: string;
  cycle_detected?: boolean;
  cycle_path?: number[];
}

/**
 * Create an add dependency handler bound to the container
 */
export function createAddDependencyHandler(
  container: Container
): (args: AddDependencyArgs) => Promise<AddDependencyResult> {
  return async (args: AddDependencyArgs): Promise<AddDependencyResult> => {
    // Execute the application command
    const result = await container.commands.addDependency.execute({
      itemId: args.item_id,
      dependsOnId: args.depends_on_id,
      type: args.type,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      const mcpResult: AddDependencyResult = {
        success: false,
        error: result.error || 'Unknown error',
      };

      // Include cycle detection info if present
      if (result.cycleDetected) {
        mcpResult.cycle_detected = true;
        mcpResult.cycle_path = result.cycleDetected.path;
      }

      return mcpResult;
    }

    return {
      success: true,
      message: `Dependency added: #${args.item_id} -> #${args.depends_on_id} (${args.type || 'blocks'})`,
    };
  };
}
