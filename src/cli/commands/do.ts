import { McpClient } from '../mcp-client.js';
import { formatItem, formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';

/**
 * Handle the do command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param args - Command arguments from parser
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleDo(args: string[], client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (args.length === 0) {
      throw new UserError(
        'Item ID is required',
        'Provide the ID of the item you want to start working on'
      );
    }

    // Parse ID
    const id = parseInt(args[0], 10);
    if (isNaN(id)) {
      throw new UserError(
        `Invalid ID: ${args[0]}`,
        'ID must be a number'
      );
    }

    // Call MCP server
    const result = await client.callTool('later_do', { id });

    // Display result
    if (result.success) {
      console.log(result.message);

      // Show todo guidance if available
      if (result.todo_guidance) {
        console.log('');
        console.log(result.todo_guidance);
      }

      // Show warnings if any
      if (result.warnings) {
        console.log('');
        console.log(result.warnings);
      }

      return 0;
    } else {
      throw new UserError(
        result.error || `Item #${id} not found`,
        'Check that the item ID exists with: later list'
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
