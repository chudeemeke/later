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
import type {
  CaptureArgs,
  ListArgs,
  ShowArgs,
  DoArgs,
} from './types.js';

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
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'later_capture': {
        const result = await handleCapture(args as unknown as CaptureArgs, storage);
        return {
          content: [
            {
              type: 'text',
              text: formatCaptureResult(result),
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
              text: result.formatted_output || result.message || 'No items found',
            },
          ],
        };
      }

      case 'later_show': {
        const result = await handleShow(args as unknown as ShowArgs, storage);
        if (!result.success) {
          throw new Error(result.error);
        }
        return {
          content: [
            {
              type: 'text',
              text: result.formatted_output || 'Item details not available',
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
              text: formatDoResult(result),
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
