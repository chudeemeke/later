import { McpClient } from '../mcp-client.js';
import { formatError } from '../output/formatter.js';
import { UserError } from '../errors.js';
import { ParsedArgs } from '../parser.js';

/**
 * Handle the search command
 *
 * Thin client - delegates all logic to MCP server
 *
 * @param parsed - Parsed arguments with flags
 * @param client - MCP client instance
 * @returns Exit code (0 = success, 1 = error)
 */
export async function handleSearch(parsed: ParsedArgs, client: McpClient): Promise<number> {
  try {
    // Validate arguments
    if (parsed.args.length === 0) {
      throw new UserError(
        'Search query is required',
        'Provide a search query (e.g., "database" or "optimization")'
      );
    }

    // Build search request
    const searchArgs: any = {
      query: parsed.args[0],
    };

    if (parsed.flags) {
      if (parsed.flags.fields) searchArgs.fields = parsed.flags.fields;
      if (parsed.flags.limit) searchArgs.limit = parsed.flags.limit;
      if (parsed.flags['min-score']) searchArgs.minScore = parsed.flags['min-score'];
    }

    // Call MCP server
    const result = await client.callTool('later_search', searchArgs);

    // Display result
    if (result.success) {
      if (result.totalFound === 0) {
        console.log(`🔍 No results found for "${searchArgs.query}"`);
        return 0;
      }

      // Header
      console.log(`🔍 Found ${result.totalFound} result${result.totalFound === 1 ? '' : 's'} for "${searchArgs.query}" (${result.searchTime}ms)`);
      console.log('');

      // Results
      result.results.forEach((r: any, i: number) => {
        console.log(`${i + 1}. [#${r.item.id}] ${r.item.decision}`);
        console.log(`   Score: ${r.score} | Status: ${r.item.status} | Priority: ${r.item.priority}`);

        if (r.item.tags && r.item.tags.length > 0) {
          console.log(`   Tags: ${r.item.tags.join(', ')}`);
        }

        // Match details
        const matches = [];
        if (r.matches.decision) matches.push(`decision(${r.matches.decision})`);
        if (r.matches.context) matches.push(`context(${r.matches.context})`);
        if (r.matches.tags) matches.push(`tags(${r.matches.tags})`);
        if (matches.length > 0) {
          console.log(`   Matches: ${matches.join(', ')}`);
        }

        console.log('');
      });

      return 0;
    } else {
      throw new UserError(
        result.error || 'Search failed',
        'Try a different query or check your search parameters'
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
