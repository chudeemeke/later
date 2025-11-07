import { McpClient } from '../mcp-client.js';
import { formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the bulk-update command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleBulkUpdate(parsed: ParsedArgs, client: McpClient): Promise<number> {
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

    // Build changes object from flags
    const changes: any = {};

    if (parsed.flags) {
      if (parsed.flags.decision) changes.decision = parsed.flags.decision;
      if (parsed.flags.context) changes.context = parsed.flags.context;
      if (parsed.flags.priority) changes.priority = parsed.flags.priority;
      if (parsed.flags.status) changes.status = parsed.flags.status;
      if (parsed.flags.tags) changes.tags = parsed.flags.tags;
      if (parsed.flags['add-tags']) changes.add_tags = parsed.flags['add-tags'];
    }

    // Check if any changes were provided
    if (Object.keys(changes).length === 0) {
      throw new UserError(
        'No changes provided',
        'Specify at least one field to update (e.g., --priority, --status)'
      );
    }

    // Call MCP server
    const result = await client.callTool('later_bulk_update', { ids, changes });

    // Display result
    if (result.success || result.succeeded > 0) {
      console.log(result.message || `Bulk update completed`);
      console.log(`Total: ${result.total} | Succeeded: ${result.succeeded} | Failed: ${result.failedCount || 0}`);

      // Show processed IDs
      if (result.processed && result.processed.length > 0) {
        console.log('');
        console.log(`✅ Updated: ${result.processed.join(', ')}`);
      }

      // Show failures
      if (result.failed && result.failed.length > 0) {
        console.log('');
        console.log('❌ Failed:');
        result.failed.forEach((failure: any) => {
          console.log(`  • ID ${failure.id}: ${failure.error}`);
        });
      }

      return result.failedCount > 0 ? 1 : 0;
    } else {
      throw new UserError(
        result.error || 'Bulk update failed',
        'Check that the items exist and the update values are valid'
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
