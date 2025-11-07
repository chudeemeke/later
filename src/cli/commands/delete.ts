import { McpClient } from '../mcp-client.js';
import { formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the delete command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleDelete(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Item ID is required',
        'Provide the ID of the item you want to delete'
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

    // Check for hard delete flag
    const hard = parsed.flags?.hard === true;

    // Call MCP server
    const result = await client.callTool('later_delete', { id, hard });

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
        result.error || `Failed to delete item #${id}`,
        'Check that the item exists with: later show <id>'
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
