/**
 * MCP Delete Handler
 *
 * Wraps DeleteItemCommand for MCP tool interface.
 * Supports soft delete (archive) and hard delete.
 */

import type { Container } from '../../composition-root.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface DeleteArgs {
  id: number;
  hard?: boolean; // Permanent delete vs archive (default: archive)
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface DeleteResult {
  success: boolean;
  message?: string;
  error?: string;
  deleted_id?: number;
  was_archived?: boolean;
  cleaned_up_dependencies?: number;
  cleaned_up_reminders?: number;
}

/**
 * Create a delete handler bound to the container
 */
export function createDeleteHandler(
  container: Container
): (args: DeleteArgs) => Promise<DeleteResult> {
  return async (args: DeleteArgs): Promise<DeleteResult> => {
    // Validate ID
    if (!args.id || args.id <= 0) {
      return {
        success: false,
        error: 'Valid item ID is required',
      };
    }

    // Execute the application command
    const result = await container.commands.delete.execute({
      id: args.id,
      hard: args.hard,
    });

    // Handle errors
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    // Build success message
    const action = args.hard ? 'permanently deleted' : 'archived';
    let message = `Item #${args.id} ${action}`;

    if (result.cleanedUpDependencies && result.cleanedUpDependencies > 0) {
      message += ` (${result.cleanedUpDependencies} dependencies cleaned up)`;
    }

    return {
      success: true,
      message,
      deleted_id: result.deletedId,
      was_archived: result.wasArchived,
      cleaned_up_dependencies: result.cleanedUpDependencies,
      cleaned_up_reminders: result.cleanedUpReminders,
    };
  };
}
