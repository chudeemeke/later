/**
 * Search Tools - Advanced search and filtering
 *
 * MCP 2025-06 Compliant: Includes outputSchema for typed responses
 */

import { toolRegistry } from '../../registry.js';
import { handleSearch } from './search.js';
import { searchOutputSchema } from '../../schemas/output-schemas.js';

// Register search tool
toolRegistry.register({
  name: 'later_search',
  category: 'search',
  keywords: ['search', 'find', 'query', 'lookup', 'filter', 'text'],
  priority: 8,
  description: 'Search deferred items using full-text search across decision and context fields. Returns ranked results with match highlighting.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (searches decision and context fields)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'archived'],
        description: 'Filter by status (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Filter by priority (optional)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)'
      }
    },
    required: ['query']
  },
  outputSchema: searchOutputSchema,
  handler: handleSearch
});

export { handleSearch };
