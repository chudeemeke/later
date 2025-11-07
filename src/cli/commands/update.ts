import { McpClient } from '../mcp-client.js';
import { formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the update command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleUpdate(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Item ID is required',
        'Provide the ID of the item you want to update'
      );
    }

    // Parse ID
    const id = parseInt(parsed.args[0], 10);
    if (isNaN(id)) {
      throw new UserError(
        `Invalid ID: ${parsed.args[0]}`,
        'ID must be a number'
      );
    }

    // Build update request from flags
    const updateArgs: any = { id };

    if (parsed.flags) {
      // Direct mappings
      if (parsed.flags.decision) updateArgs.decision = parsed.flags.decision;
      if (parsed.flags.context) updateArgs.context = parsed.flags.context;
      if (parsed.flags.priority) updateArgs.priority = parsed.flags.priority;
      if (parsed.flags.status) updateArgs.status = parsed.flags.status;

      // Tag operations
      if (parsed.flags.tags) updateArgs.tags = parsed.flags.tags;
      if (parsed.flags['add-tags']) updateArgs.add_tags = parsed.flags['add-tags'];
      if (parsed.flags['remove-tags']) updateArgs.remove_tags = parsed.flags['remove-tags'];

      // Dependencies (array of numbers)
      if (parsed.flags.deps) {
        updateArgs.dependencies = parsed.flags.deps.map((dep: string) => {
          const num = parseInt(dep, 10);
          if (isNaN(num)) {
            throw new UserError(
              `Invalid dependency ID: ${dep}`,
              'All dependency IDs must be numbers'
            );
          }
          return num;
        });
      }
    }

    // Check if any update fields were provided
    const hasUpdates = Object.keys(updateArgs).length > 1; // > 1 because id is always present
    if (!hasUpdates) {
      throw new UserError(
        'No update fields provided',
        'Specify at least one field to update (e.g., --priority, --status, --decision)'
      );
    }

    // Call MCP server
    const result = await client.callTool('later_update', updateArgs);

    // Display result
    if (result.success) {
      console.log(result.message);

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.log('');
        result.warnings.forEach((warning: string) => {
          console.log(`⚠️  ${warning}`);
        });
      }

      return 0;
    } else {
      throw new UserError(
        result.error || `Failed to update item #${id}`,
        'Check that the item exists and the update values are valid'
      );
    }
  } catch (error) {
    if (error instanceof UserError) {
      throw error; // Re-throw for CLI error handler
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    return 1;
  }
}
