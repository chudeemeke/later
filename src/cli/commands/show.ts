import { McpClient } from '../mcp-client.js';
import { formatItem, formatError } from '../output/formatter.js';

/**
 * Handle the show command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param args - Command arguments from parser (expects ID as first arg)
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleShow(args: string[], client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (args.length === 0) {
      console.error(formatError('Item ID is required'));
      console.error('Usage: later show <id>');
      return 1;
    }

    // Parse ID
    const id = parseInt(args[0], 10);
    if (isNaN(id)) {
      console.error(formatError(`Invalid ID: ${args[0]}`));
      console.error('ID must be a number');
      return 1;
    }

    // Call MCP server
    const result = await client.callTool('later_show', { id });

    // Display result
    if (result.success && result.item) {
      const output = formatItem(result.item);
      console.log(output);

      return 0;
    } else {
      console.error(formatError(result.error || `Item #${id} not found`));
      return 1;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    return 1;
  }
}
