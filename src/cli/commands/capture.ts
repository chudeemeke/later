import { McpClient } from '../mcp-client.js';
import { formatSuccess, formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the capture command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleCapture(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Decision text is required',
        'Provide the decision you want to defer'
      );
    }

    // Extract decision text (first argument)
    const decision = parsed.args[0];

    // Build capture request from flags
    const captureArgs: any = { decision };

    if (parsed.flags) {
      if (parsed.flags.context) captureArgs.context = parsed.flags.context;
      if (parsed.flags.tags) captureArgs.tags = parsed.flags.tags;

      // Priority handling: --priority <value> OR --high (shorthand)
      if (parsed.flags.high) {
        captureArgs.priority = 'high';
      } else if (parsed.flags.priority) {
        captureArgs.priority = parsed.flags.priority;
      }
    }

    // Call MCP server
    const result = await client.callTool('later_capture', captureArgs);

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
      throw new UserError(
        result.error || 'Capture failed',
        'Check that your decision text is valid (max 500 chars)'
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
