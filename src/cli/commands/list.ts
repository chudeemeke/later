import { McpClient } from '../mcp-client.js';
import { formatList, formatError } from '../output/formatter.js';

/**
 * Handle the list command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param args - Command arguments from parser (unused in Phase 1 MVP)
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleList(args: string[], client: McpClient): Promise<number> {
  try {
    // Call MCP server (no filters in Phase 1 MVP)
    const result = await client.callTool('later_list', {});

    // Display result
    if (result.success) {
      // Format and display items
      const output = formatList(result.items || []);
      console.log(output);

      return 0;
    } else {
      console.error(formatError(result.error || 'List failed'));
      return 1;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    return 1;
  }
}
