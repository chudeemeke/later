import { McpClient } from '../mcp-client.js';
import { formatItem, formatError } from '../output/formatter.js';
import { TableFormatter } from '../output/table-formatter.js';
import { JsonFormatter } from '../output/json-formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the show command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleShow(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Item ID is required',
        'Provide the ID of the item you want to view'
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

    // Call MCP server
    const result = await client.callTool('later_show', { id });

    // Display result
    if (result.success && result.item) {
      // Format based on --json flag
      const output = parsed.globalFlags?.json
        ? JsonFormatter.formatShowResult(result.item)
        : TableFormatter.formatItem(result.item);

      console.log(output);

      return 0;
    } else {
      throw new UserError(
        result.error || `Item #${id} not found`,
        'Check that the item exists with: later list'
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
