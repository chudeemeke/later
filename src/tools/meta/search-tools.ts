/**
 * search_tools - Tool Discovery Meta-Tool
 * Enables progressive disclosure by allowing on-demand tool discovery
 *
 * This is the ONLY tool exposed initially, reducing token overhead by 90%
 */

import { toolRegistry } from '../../registry.js';
import type { ToolSearchResult } from '../../types/tool-metadata.js';

export interface SearchToolsArgs {
  query: string;
  detail?: 'brief' | 'full';
  limit?: number;
}

export interface SearchToolsResult {
  success: boolean;
  tools: ToolSearchResult[];
  total_found: number;
  query: string;
}

/**
 * Search for tools based on natural language query
 */
export async function handleSearchTools(
  args: SearchToolsArgs
): Promise<SearchToolsResult> {
  const { query, detail = 'brief', limit = 5 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      tools: [],
      total_found: 0,
      query: ''
    };
  }

  // Search registry
  const allMatches = toolRegistry.search(query);
  const limited = allMatches.slice(0, limit);

  // Format results based on detail level
  const tools: ToolSearchResult[] = limited.map(tool => {
    const result: ToolSearchResult = {
      name: tool.name,
      category: tool.category,
      description: tool.description,
      score: 0 // Score already used for sorting
    };

    if (detail === 'full') {
      result.inputSchema = tool.inputSchema;
    }

    return result;
  });

  return {
    success: true,
    tools,
    total_found: allMatches.length,
    query
  };
}

export const searchToolsSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Natural language description of what you want to do (e.g., "create a new decision", "list high priority items", "search for optimization tasks")'
    },
    detail: {
      type: 'string',
      enum: ['brief', 'full'],
      description: 'Level of detail: brief (names and descriptions only) or full (complete schemas). Default: brief'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of tools to return. Default: 5'
    }
  },
  required: ['query']
};
