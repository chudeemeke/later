import { McpClient } from '../mcp-client.js';
import { formatError } from '../output/formatter.js';
import { TableFormatter } from '../output/table-formatter.js';
import { JsonFormatter } from '../output/json-formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the bulk-delete command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleBulkDelete(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Item IDs are required',
        'Provide comma-separated IDs (e.g., 1,2,3)'
      );
    }

    // Parse comma-separated IDs
    const idsStr = parsed.args[0];
    const ids = idsStr.split(',').map(idStr => {
      const id = parseInt(idStr.trim(), 10);
      if (isNaN(id)) {
        throw new UserError(
          `Invalid ID: ${idStr.trim()}`,
          'All IDs must be numbers'
        );
      }
      return id;
    });

    if (ids.length === 0) {
      throw new UserError(
        'No valid IDs provided',
        'Provide at least one item ID'
      );
    }

    // Check for hard delete flag
    const hard = parsed.flags?.hard === true;

    // Call MCP server
    const result = await client.callTool('later_bulk_delete', { ids, hard });

    // Display result
    if (result.success || result.succeeded > 0) {
      // Format based on --json flag
      if (parsed.globalFlags?.json) {
        console.log(JsonFormatter.formatBulkResult(result));
      } else {
        const successful = result.processed || [];
        const failed = result.failed || [];
        console.log(TableFormatter.formatBulkResults('delete', successful, failed));
      }

      return result.failedCount > 0 ? 1 : 0;
    } else {
      throw new UserError(
        result.error || 'Bulk delete failed',
        'Check that the items exist'
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
