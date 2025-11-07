import { McpClient } from '../mcp-client.js';
import { formatSuccess, formatError } from '../output/formatter.js';

/**
 * Handle the capture command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param args - Command arguments from parser
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleCapture(args: string[], client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (args.length === 0) {
      console.error(formatError('Decision text is required'));
      console.error('Usage: later capture "Decision text to defer"');
      return 1;
    }

    // Extract decision text (first argument)
    const decision = args[0];

    // Call MCP server
    const result = await client.callTool('later_capture', {
      decision,
    });

    // Display result
    if (result.success) {
      console.log(formatSuccess(result.message));

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning: string) => {
          console.log(warning);
        });
      }

      return 0;
    } else {
      console.error(formatError(result.error || 'Capture failed'));
      return 1;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    return 1;
  }
}
