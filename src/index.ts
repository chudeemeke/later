#!/usr/bin/env node

/**
 * Later MCP Server V2.0
 * Token-Efficient Progressive Disclosure Architecture
 *
 * V2.0 Features:
 * - Progressive tool disclosure (90% token reduction)
 * - Automatic PII tokenization (95%+ detection)
 * - On-demand tool loading
 * - Backward compatible with V1.0.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getStorage } from './storage/jsonl.js';
import { toolRegistry } from './registry.js';

// Import and register all tools
import './tools/meta/index.js';      // search_tools (always visible)
import './tools/core/index.js';      // capture, list, show
import './tools/workflow/index.js';  // do, update, delete
import './tools/batch/index.js';     // bulk_update, bulk_delete
import './tools/search/index.js';    // search

// Initialize storage
const storage = getStorage();

// Create MCP server
const server = new Server(
  {
    name: 'later',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * V2.0: Progressive Disclosure
 * Only expose search_tools initially, reducing token overhead by 90%
 * Other tools are discovered on-demand via search_tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return only search_tools for progressive disclosure
  const searchTool = toolRegistry.get('search_tools');

  if (!searchTool) {
    throw new Error('search_tools not found in registry');
  }

  return {
    tools: [
      {
        name: searchTool.name,
        description: searchTool.description,
        inputSchema: searchTool.inputSchema,
      },
    ],
  };
});

/**
 * V2.0: Dynamic Tool Execution
 * Tools are executed dynamically from registry
 * This enables on-demand loading while maintaining backward compatibility
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Get tool from registry
  const tool = toolRegistry.get(name);

  if (!tool) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: Tool '${name}' not found. Use search_tools to discover available tools.`,
        },
      ],
    };
  }

  try {
    // Execute tool handler
    const result = await tool.handler(args, storage);

    // Format response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${(error as Error).message}`,
        },
      ],
    };
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol)
  console.error('Later MCP Server V2.0 started');
  console.error(`- Registered tools: ${toolRegistry.getAll().length}`);
  console.error('- Progressive disclosure enabled');
  console.error('- PII tokenization active');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
