#!/usr/bin/env node

/**
 * Later MCP Server V3.0 - Hexagonal Architecture
 *
 * Built on hexagonal architecture with:
 * - Domain layer: Pure business logic
 * - Application layer: Commands and queries
 * - Infrastructure layer: Storage adapters
 * - Presentation layer: MCP handlers
 *
 * MCP 2025-06 Specification Compliant:
 * - Progressive tool disclosure (90% token reduction)
 * - Automatic PII tokenization (handled by capture handler)
 * - Structured error responses with isError pattern
 * - Graceful shutdown handling
 * - All logging to stderr (stdout reserved for protocol)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  createContainer,
  getDefaultDataDir,
  type Container,
} from '../composition-root.js';

import {
  createCaptureHandler,
  createListHandler,
  createShowHandler,
  createDoHandler,
  createUpdateHandler,
  createDeleteHandler,
  createSearchHandler,
} from './handlers/index.js';

import type { ToolMetadata, JsonSchema } from './tool-metadata.js';

// Version
const VERSION = '3.0.0';

// Create container with default configuration
const container: Container = createContainer({
  dataDir: getDefaultDataDir(),
});

// Create handlers bound to container
const handlers = {
  later_capture: createCaptureHandler(container),
  later_list: createListHandler(container),
  later_show: createShowHandler(container),
  later_do: createDoHandler(container),
  later_update: createUpdateHandler(container),
  later_delete: createDeleteHandler(container),
  later_search: createSearchHandler(container),
};

/**
 * Tool definitions with MCP schemas
 */
const tools: ToolMetadata[] = [
  {
    name: 'search_tools',
    category: 'meta',
    keywords: ['search', 'find', 'discover', 'tools', 'help'],
    priority: 10,
    description:
      'Discover available Later tools. Use this to find the right tool for your task.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what you want to do',
        },
      },
      required: ['query'],
    },
    handler: async (args: { query: string }) => {
      const query = (args.query || '').toLowerCase().trim();
      const matches = tools
        .filter((t) => t.name !== 'search_tools')
        .filter((t) => {
          if (!query) return true;
          const searchText =
            `${t.name} ${t.description} ${t.keywords.join(' ')}`.toLowerCase();
          return query.split(/\s+/).some((word) => searchText.includes(word));
        })
        .map((t) => ({
          name: t.name,
          category: t.category,
          description: t.description,
          keywords: t.keywords,
          inputSchema: t.inputSchema,
        }));

      return {
        success: true,
        tools: matches,
        count: matches.length,
      };
    },
  },
  {
    name: 'later_capture',
    category: 'core',
    keywords: ['capture', 'save', 'defer', 'record', 'add', 'create', 'new'],
    priority: 10,
    description:
      'Capture a deferred decision with context. Automatically sanitizes secrets and tokenizes PII.',
    inputSchema: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          description: 'The decision to defer (required)',
        },
        context: {
          type: 'string',
          description: 'Additional context about the decision',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Priority level (default: medium)',
        },
      },
      required: ['decision'],
    },
    handler: handlers.later_capture,
  },
  {
    name: 'later_list',
    category: 'core',
    keywords: ['list', 'show', 'all', 'filter', 'pending', 'items'],
    priority: 9,
    description: 'List deferred items with optional filtering by status, priority, or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in-progress', 'done', 'archived'],
          description: 'Filter by status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Filter by priority',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (OR logic)',
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return',
        },
      },
    },
    handler: handlers.later_list,
  },
  {
    name: 'later_show',
    category: 'core',
    keywords: ['show', 'view', 'get', 'details', 'item'],
    priority: 8,
    description: 'Show detailed information about a specific deferred item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Item ID to show (required)',
        },
        include_deps: {
          type: 'boolean',
          description: 'Include dependency information',
        },
        include_retro: {
          type: 'boolean',
          description: 'Include retrospective data if available',
        },
      },
      required: ['id'],
    },
    handler: handlers.later_show,
  },
  {
    name: 'later_do',
    category: 'workflow',
    keywords: ['do', 'complete', 'done', 'finish', 'resolve'],
    priority: 9,
    description:
      'Mark a deferred item as done. Optionally record outcome and lessons learned.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Item ID to mark as done (required)',
        },
        outcome: {
          type: 'string',
          enum: ['success', 'failure', 'partial'],
          description: 'Outcome of the decision',
        },
        lessons_learned: {
          type: 'string',
          description: 'Lessons learned from this decision',
        },
        impact_time_saved: {
          type: 'number',
          description: 'Time saved in minutes',
        },
        impact_cost_saved: {
          type: 'number',
          description: 'Cost saved in currency units',
        },
        effort_estimated: {
          type: 'number',
          description: 'Originally estimated effort in minutes',
        },
        effort_actual: {
          type: 'number',
          description: 'Actual effort in minutes',
        },
        force: {
          type: 'boolean',
          description: 'Force completion even if blocked by dependencies',
        },
      },
      required: ['id'],
    },
    handler: handlers.later_do,
  },
  {
    name: 'later_update',
    category: 'workflow',
    keywords: ['update', 'modify', 'change', 'edit'],
    priority: 7,
    description: 'Update fields of an existing deferred item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Item ID to update (required)',
        },
        decision: {
          type: 'string',
          description: 'New decision text',
        },
        context: {
          type: 'string',
          description: 'New context',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in-progress', 'done', 'archived'],
          description: 'New status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'New priority',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace all tags',
        },
        add_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to add',
        },
        remove_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to remove',
        },
      },
      required: ['id'],
    },
    handler: handlers.later_update,
  },
  {
    name: 'later_delete',
    category: 'workflow',
    keywords: ['delete', 'remove', 'archive'],
    priority: 6,
    description:
      'Delete (archive) a deferred item. Use hard=true for permanent deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Item ID to delete (required)',
        },
        hard: {
          type: 'boolean',
          description: 'Permanently delete instead of archiving (default: false)',
        },
      },
      required: ['id'],
    },
    handler: handlers.later_delete,
  },
  {
    name: 'later_search',
    category: 'search',
    keywords: ['search', 'find', 'query', 'lookup'],
    priority: 8,
    description: 'Full-text search across all deferred items with relevance ranking.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (required)',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in-progress', 'done', 'archived'],
          description: 'Filter by status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Filter by priority',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
        },
        include_archived: {
          type: 'boolean',
          description: 'Include archived items in search (default: false)',
        },
      },
      required: ['query'],
    },
    handler: handlers.later_search,
  },
];

// Tool lookup map
const toolMap = new Map(tools.map((t) => [t.name, t]));

// Logger to stderr only
function log(level: string, message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  console.error(JSON.stringify(entry));
}

// Shutdown flag
let isShuttingDown = false;

// Create MCP server
const server = new Server(
  {
    name: 'later',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Progressive Disclosure: Only expose search_tools initially
 * Other tools discovered via search_tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const searchTool = toolMap.get('search_tools');

  if (!searchTool) {
    throw new Error('search_tools not found');
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
 * Tool execution with MCP-compliant error handling
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = toolMap.get(name);

  if (!tool) {
    log('warn', 'tool_not_found', { tool: name });
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'TOOL_NOT_FOUND',
              message: `Tool '${name}' not found. Use search_tools to discover available tools.`,
              available_tools: tools.map((t) => t.name),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  try {
    const result = await tool.handler(args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', 'tool_execution_error', { tool: name, error: errorMessage });

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'TOOL_EXECUTION_ERROR',
              tool: name,
              message: errorMessage,
              hint: 'Check the tool arguments and try again. Use search_tools for help.',
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  log('info', 'shutdown_initiated', { signal });

  try {
    await server.close();
    await container.close();
    log('info', 'shutdown_complete', { signal });
    process.exit(0);
  } catch (error) {
    log('error', 'shutdown_error', {
      signal,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

process.on('uncaughtException', (error) => {
  log('error', 'uncaught_exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log('error', 'unhandled_rejection', { reason: message });
  gracefulShutdown('unhandledRejection');
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('info', 'server_started', {
    version: VERSION,
    architecture: 'hexagonal',
    tools_count: tools.length,
    features: ['progressive_disclosure', 'composition_root', 'graceful_shutdown'],
  });
}

main().catch((error) => {
  log('error', 'fatal_error', { error: error.message });
  process.exit(1);
});

export { server, container, tools };
