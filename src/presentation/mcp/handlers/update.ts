/**
 * MCP Update Handler
 *
 * Wraps UpdateItemCommand for MCP tool interface.
 * Allows updating item fields.
 */

import type { Container } from '../../composition-root.js';
import type { StatusValue } from '../../../domain/value-objects/Status.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface UpdateArgs {
  id: number;
  decision?: string;
  context?: string;
  status?: StatusValue;
  priority?: PriorityValue;
  tags?: string[];
  add_tags?: string[];
  remove_tags?: string[];
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface UpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  changes_applied?: string[];
}

/**
 * Create an update handler bound to the container
 */
export function createUpdateHandler(
  container: Container
): (args: UpdateArgs) => Promise<UpdateResult> {
  return async (args: UpdateArgs): Promise<UpdateResult> => {
    // Validate ID
    if (!args.id || args.id <= 0) {
      return {
        success: false,
        error: 'Valid item ID is required',
      };
    }

    // Track changes for response
    const changesApplied: string[] = [];

    // Build update input
    const updateInput: Parameters<typeof container.commands.update.execute>[0] = {
      id: args.id,
    };

    if (args.decision !== undefined) {
      updateInput.decision = args.decision;
      changesApplied.push('decision');
    }

    if (args.context !== undefined) {
      updateInput.context = args.context;
      changesApplied.push('context');
    }

    if (args.status !== undefined) {
      updateInput.status = args.status;
      changesApplied.push('status');
    }

    if (args.priority !== undefined) {
      updateInput.priority = args.priority;
      changesApplied.push('priority');
    }

    if (args.tags !== undefined) {
      updateInput.tags = args.tags;
      changesApplied.push('tags');
    }

    if (args.add_tags !== undefined) {
      updateInput.addTags = args.add_tags;
      changesApplied.push('tags (added)');
    }

    if (args.remove_tags !== undefined) {
      updateInput.removeTags = args.remove_tags;
      changesApplied.push('tags (removed)');
    }

    // Execute the application command
    const result = await container.commands.update.execute(updateInput);

    // Handle errors
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    return {
      success: true,
      message: `Item #${args.id} updated`,
      changes_applied: changesApplied,
    };
  };
}
