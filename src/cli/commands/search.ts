import { McpClient } from "../mcp-client.js";
import { formatError } from "../output/formatter.js";
import { TableFormatter } from "../output/table-formatter.js";
import { JsonFormatter } from "../output/json-formatter.js";
import { UserError } from "../errors.js";
import { ParsedArgs } from "../parser.js";
import { OutputWriter } from "../output/writer.js";

/**
 * Handle the search command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @param output - Output writer for testable output
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleSearch(
  parsed: ParsedArgs,
  client: McpClient,
  output: OutputWriter,
): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        "Search query is required",
        'Provide a search query (e.g., "database" or "optimization")',
      );
    }

    // Build search request
    const searchArgs: Record<string, unknown> = {
      query: parsed.args[0],
    };

    if (parsed.flags) {
      if (parsed.flags.fields) searchArgs.fields = parsed.flags.fields;
      if (parsed.flags.limit) searchArgs.limit = parsed.flags.limit;
      if (parsed.flags["min-score"])
        searchArgs.minScore = parsed.flags["min-score"];
    }

    // Call MCP server
    const result = await client.callTool("later_search", searchArgs);

    // Display result
    if (result.success) {
      // Format based on --json flag
      if (parsed.globalFlags?.json) {
        output.writeLine(JsonFormatter.formatSearchResult(result));
      } else {
        // Transform results to include matchedFields for table display
        const transformedResults = (result.results || []).map(
          (r: Record<string, unknown>) => ({
            score: r.score,
            item: r.item,
            matchedFields: Object.keys(
              (r.matches as Record<string, number>) || {},
            ).filter((k) => (r.matches as Record<string, number>)[k] > 0),
          }),
        );

        output.writeLine(
          TableFormatter.formatSearchResults(transformedResults),
        );
      }

      return 0;
    } else {
      throw new UserError(
        result.error || "Search failed",
        "Try a different query or check your search parameters",
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
