import { McpClient } from "../mcp-client.js";
import { formatError } from "../output/formatter.js";
import { TableFormatter } from "../output/table-formatter.js";
import { JsonFormatter } from "../output/json-formatter.js";
import { UserError } from "../errors.js";
import { ParsedArgs } from "../parser.js";
import { OutputWriter } from "../output/writer.js";

/**
 * Handle the list command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @param output - Output writer for testable output
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleList(
  parsed: ParsedArgs,
  client: McpClient,
  output: OutputWriter,
): Promise<number> {
  try {
    // Build list request from flags
    const listArgs: Record<string, unknown> = {};

    if (parsed.flags) {
      if (parsed.flags.status) listArgs.status = parsed.flags.status;
      if (parsed.flags.priority) listArgs.priority = parsed.flags.priority;
      if (parsed.flags.tags) listArgs.tags = parsed.flags.tags;
      if (parsed.flags.limit) listArgs.limit = parsed.flags.limit;
    }

    // Call MCP server
    const result = await client.callTool("later_list", listArgs);

    // Display result
    if (result.success) {
      // Format based on --json flag
      const formatted = parsed.globalFlags?.json
        ? JsonFormatter.formatListResult(result.items || [])
        : TableFormatter.formatList(result.items || []);

      output.writeLine(formatted);

      return 0;
    } else {
      throw new UserError(
        result.error || "List failed",
        "Check that your filter values are valid",
      );
    }
  } catch (error) {
    if (error instanceof UserError) {
      throw error; // Re-throw for CLI error handler
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    output.errorLine(formatError(errorMessage));
    return 1;
  }
}
