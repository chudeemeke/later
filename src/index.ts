#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getStorage } from './storage/jsonl.js';
import { handleCapture } from './tools/capture.js';
import { handleList } from './tools/list.js';
import { handleShow } from './tools/show.js';
import { handleDo } from './tools/do.js';
import { handleUpdate } from './tools/update.js';
import { handleDelete } from './tools/delete.js';
import { handleBulkUpdate, handleBulkDelete } from './tools/bulk.js';
import { handleSearch } from './tools/search.js';
import type {
  CaptureArgs,
  ListArgs,
  ShowArgs,
  DoArgs,
} from './types.js';
import type { UpdateArgs } from './tools/update.js';
import type { DeleteArgs } from './tools/delete.js';
import type { BulkUpdateArgs, BulkDeleteArgs } from './tools/bulk.js';
import type { SearchArgs } from './tools/search.js';

// Initialize storage
const storage = getStorage();

// Create MCP server
const server = new Server(
  {
    name: 'later',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'later_capture',
        description:
          'Capture a deferred decision with context for later review. ' +
          'Automatically detects and sanitizes secrets, checks for duplicates, ' +
          'and stores with full metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            decision: {
              type: 'string',
              description: 'The decision or task to defer (required)',
            },
            context: {
              type: 'string',
              description: 'Additional context or reasoning (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization (optional)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Priority level (optional, default: medium)',
            },
          },
          required: ['decision'],
        },
      },
      {
        name: 'later_list',
        description:
          'List and filter deferred items. ' +
          'Supports filtering by status, tags, and priority. ' +
          'Returns formatted list with status icons and timestamps.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'done', 'archived'],
              description: 'Filter by status (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags - OR logic (optional)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Filter by priority (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return (optional)',
            },
          },
        },
      },
      {
        name: 'later_show',
        description:
          'Show full details of a specific deferred item. ' +
          'Displays decision, context, status, priority, tags, timestamps, ' +
          'and resolves any dependencies.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'The item ID to show',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'later_do',
        description:
          'Mark an item as in-progress and get TodoWrite guidance. ' +
          'Checks dependencies, provides actionable todo suggestions, ' +
          'and updates the item status.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'The item ID to start working on',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'later_update',
        description:
          'Update an existing deferred item. ' +
          'Modify any field (decision, context, tags, priority, status, dependencies). ' +
          'Validates state transitions and detects dependency cycles.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'The item ID to update (required)',
            },
            decision: {
              type: 'string',
              description: 'Updated decision text (optional, max 500 chars)',
            },
            context: {
              type: 'string',
              description: 'Updated context (optional)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Updated tags (optional)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Updated priority (optional)',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'done', 'archived'],
              description: 'Updated status (optional, validates transitions)',
            },
            dependencies: {
              type: 'array',
              items: { type: 'number' },
              description: 'Updated dependencies (optional, checks for cycles)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'later_delete',
        description:
          'Delete a deferred item. ' +
          'By default performs soft delete (marks as archived). ' +
          'Use hard=true for permanent removal (Phase 2 feature).',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              description: 'The item ID to delete (required)',
            },
            hard: {
              type: 'boolean',
              description: 'If true, permanently delete (default: false, soft delete)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'later_bulk_update',
        description:
          'Update multiple items at once with the same changes. ' +
          'Useful for batch operations like changing priority or adding tags to multiple items. ' +
          'Returns detailed results showing which items succeeded and which failed.',
        inputSchema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of item IDs to update (required)',
            },
            changes: {
              type: 'object',
              description: 'Changes to apply to all items',
              properties: {
                decision: { type: 'string' },
                context: { type: 'string' },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in-progress', 'done', 'archived'],
                },
                dependencies: {
                  type: 'array',
                  items: { type: 'number' },
                },
              },
            },
          },
          required: ['ids', 'changes'],
        },
      },
      {
        name: 'later_bulk_delete',
        description:
          'Delete multiple items at once. ' +
          'By default performs soft delete (marks as archived). ' +
          'Use hard=true for permanent removal. ' +
          'Returns detailed results showing which items were deleted and which failed.',
        inputSchema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of item IDs to delete (required)',
            },
            hard: {
              type: 'boolean',
              description: 'If true, permanently delete (default: false)',
            },
          },
          required: ['ids'],
        },
      },
      {
        name: 'later_search',
        description:
          'Full-text search across all deferred items with TF-IDF relevance scoring. ' +
          'Searches decision, context, and tags fields. ' +
          'Returns results ranked by relevance with match details.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (required)',
            },
            fields: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['decision', 'context', 'tags'],
              },
              description: 'Fields to search (default: all fields)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
            minScore: {
              type: 'number',
              description: 'Minimum relevance score (default: 0.01)',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    // Check if raw JSON response is requested (for CLI client)
    const rawMode = (args as any).__raw === true;

    switch (name) {
      case 'later_capture': {
        const result = await handleCapture(args as unknown as CaptureArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatCaptureResult(result),
            },
          ],
        };
      }

      case 'later_list': {
        const result = await handleList((args || {}) as unknown as ListArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : (result.formatted_output || result.message || 'No items found'),
            },
          ],
        };
      }

      case 'later_show': {
        const result = await handleShow(args as unknown as ShowArgs, storage);
        if (!rawMode && !result.success) {
          throw new Error(result.error);
        }
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : (result.formatted_output || 'Item details not available'),
            },
          ],
        };
      }

      case 'later_do': {
        const result = await handleDo(args as unknown as DoArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatDoResult(result),
            },
          ],
        };
      }

      case 'later_update': {
        const result = await handleUpdate(args as unknown as UpdateArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatUpdateResult(result),
            },
          ],
        };
      }

      case 'later_delete': {
        const result = await handleDelete(args as unknown as DeleteArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatDeleteResult(result),
            },
          ],
        };
      }

      case 'later_bulk_update': {
        const result = await handleBulkUpdate(args as unknown as BulkUpdateArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatBulkResult('update', result),
            },
          ],
        };
      }

      case 'later_bulk_delete': {
        const result = await handleBulkDelete(args as unknown as BulkDeleteArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatBulkResult('delete', result),
            },
          ],
        };
      }

      case 'later_search': {
        const result = await handleSearch(args as unknown as SearchArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: rawMode ? JSON.stringify(result) : formatSearchResult(result),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Helper functions for formatting results
function formatCaptureResult(result: any): string {
  if (!result.success) {
    return `❌ Failed to capture: ${result.error}`;
  }

  let output = result.message;

  if (result.warnings) {
    output += '\n\n' + result.warnings.join('\n');
  }

  return output;
}

function formatDoResult(result: any): string {
  if (!result.success) {
    return `❌ Failed: ${result.error}`;
  }

  let output = result.message;

  if (result.warnings) {
    output += '\n\n' + result.warnings;
  }

  if (result.todo_guidance) {
    output += '\n\n' + result.todo_guidance;
  }

  return output;
}

function formatUpdateResult(result: any): string {
  if (!result.success) {
    return `❌ Failed to update: ${result.error}`;
  }

  let output = result.message;

  if (result.warnings && result.warnings.length > 0) {
    output += '\n\n⚠️  Warnings:\n' + result.warnings.join('\n');
  }

  return output;
}

function formatDeleteResult(result: any): string {
  if (!result.success) {
    return `❌ Failed to delete: ${result.error}`;
  }

  let output = result.message;

  if (result.warnings && result.warnings.length > 0) {
    output += '\n\n⚠️  Warnings:\n' + result.warnings.join('\n');
  }

  return output;
}

function formatBulkResult(operation: 'update' | 'delete', result: any): string {
  const emoji = result.success ? '✅' : '⚠️';
  let output = `${emoji} Bulk ${operation} completed:\n`;
  output += `Total: ${result.total} | Succeeded: ${result.succeeded} | Failed: ${result.failedCount}`;

  if (result.processed.length > 0) {
    output += `\n\n✅ Processed IDs: ${result.processed.join(', ')}`;
  }

  if (result.failed.length > 0) {
    output += `\n\n❌ Failed items:\n`;
    result.failed.forEach((failure: any) => {
      output += `  • ID ${failure.id}: ${failure.error}\n`;
    });
  }

  return output.trim();
}

function formatSearchResult(result: any): string {
  if (!result.success) {
    return `❌ Search failed`;
  }

  if (result.totalFound === 0) {
    return `🔍 No results found for "${result.query}"`;
  }

  let output = `🔍 Found ${result.totalFound} result${result.totalFound === 1 ? '' : 's'} for "${result.query}" (${result.searchTime}ms)\n\n`;

  result.results.forEach((r: any, i: number) => {
    output += `${i + 1}. [#${r.item.id}] ${r.item.decision}\n`;
    output += `   Score: ${r.score} | Status: ${r.item.status} | Priority: ${r.item.priority}\n`;

    if (r.item.tags.length > 0) {
      output += `   Tags: ${r.item.tags.join(', ')}\n`;
    }

    const matches = [];
    if (r.matches.decision) matches.push(`decision(${r.matches.decision})`);
    if (r.matches.context) matches.push(`context(${r.matches.context})`);
    if (r.matches.tags) matches.push(`tags(${r.matches.tags})`);
    if (matches.length > 0) {
      output += `   Matches: ${matches.join(', ')}\n`;
    }
    output += '\n';
  });

  return output.trim();
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Later MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
