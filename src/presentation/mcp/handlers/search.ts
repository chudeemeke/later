/**
 * MCP Search Handler
 *
 * Wraps SearchItemsQuery for MCP tool interface.
 * Provides full-text search with relevance ranking.
 */

import type { Container } from '../../composition-root.js';
import type { StatusValue } from '../../../domain/value-objects/Status.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface SearchArgs {
  query: string;
  status?: StatusValue | StatusValue[];
  priority?: PriorityValue | PriorityValue[];
  tags?: string[];
  limit?: number;
  offset?: number;
  include_archived?: boolean;
}

/**
 * MCP search result item (snake_case for MCP compatibility)
 */
export interface SearchResultItem {
  id: number;
  decision: string;
  context?: string;
  status: StatusValue;
  priority: PriorityValue;
  tags: string[];
  created_at: string;
  updated_at: string;
  score: number;
  highlights?: string[];
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface SearchResult {
  success: boolean;
  results?: SearchResultItem[];
  total_count?: number;
  has_more?: boolean;
  formatted_output?: string;
  error?: string;
}

/**
 * Create a search handler bound to the container
 */
export function createSearchHandler(
  container: Container
): (args: SearchArgs) => Promise<SearchResult> {
  return async (args: SearchArgs): Promise<SearchResult> => {
    // Validate query
    if (!args.query || args.query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required',
      };
    }

    // Execute the application query
    const result = await container.queries.searchItems.execute({
      query: args.query,
      status: args.status,
      priority: args.priority,
      tags: args.tags,
      limit: args.limit,
      offset: args.offset,
      includeArchived: args.include_archived,
    });

    // Handle errors
    if (!result.success || !result.results) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    // Transform to MCP format
    const searchResults: SearchResultItem[] = result.results.map((r) => ({
      id: r.item.id,
      decision: r.item.decision,
      context: r.item.context,
      status: r.item.status,
      priority: r.item.priority,
      tags: r.item.tags,
      created_at: r.item.createdAt.toISOString(),
      updated_at: r.item.updatedAt.toISOString(),
      score: r.score,
      highlights: r.highlights,
    }));

    // Format output
    const formattedOutput = formatSearchResults(searchResults, args.query);

    return {
      success: true,
      results: searchResults,
      total_count: result.total,
      has_more: result.hasMore,
      formatted_output: formattedOutput,
    };
  };
}

/**
 * Format search results for display
 */
function formatSearchResults(results: SearchResultItem[], query: string): string {
  const lines: string[] = [];

  lines.push(`Search results for "${query}"`);
  lines.push('─'.repeat(40));

  if (results.length === 0) {
    lines.push('No results found');
    return lines.join('\n');
  }

  for (const result of results) {
    const scoreStr = `[${(result.score * 100).toFixed(0)}%]`;
    lines.push(`${scoreStr} #${result.id}: ${result.decision}`);

    if (result.highlights && result.highlights.length > 0) {
      lines.push(`  Matches: ${result.highlights.slice(0, 2).join(', ')}`);
    }
  }

  lines.push('');
  lines.push(`Total: ${results.length} result${results.length === 1 ? '' : 's'}`);

  return lines.join('\n');
}
