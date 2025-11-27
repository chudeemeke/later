/**
 * Output Schemas for MCP Tools
 * MCP 2025-06 Specification: Tools SHOULD declare output schemas
 * to enable precise, typed outputs that clients can validate
 */

import type { JsonSchema } from '../types/tool-metadata.js';

/**
 * Common schema components for reuse
 */
const deferredItemSchema: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', description: 'Unique item identifier' },
    decision: { type: 'string', description: 'The deferred decision text' },
    context: { type: 'string', description: 'Additional context' },
    status: {
      type: 'string',
      enum: ['pending', 'in-progress', 'done', 'archived'],
      description: 'Current status'
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Priority level'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Associated tags'
    },
    created_at: { type: 'string', description: 'ISO 8601 creation timestamp' },
    updated_at: { type: 'string', description: 'ISO 8601 update timestamp' },
    dependencies: {
      type: 'array',
      items: { type: 'number' },
      description: 'IDs of items this depends on'
    }
  },
  required: ['id', 'decision', 'status', 'priority', 'tags', 'created_at', 'updated_at']
};

/**
 * Output schema for later_capture
 */
export const captureOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether capture succeeded' },
    item_id: { type: 'number', description: 'ID of created item' },
    message: { type: 'string', description: 'Human-readable result message' },
    error: { type: 'string', description: 'Error message if failed' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Warnings (e.g., PII detected, secrets sanitized)'
    },
    duplicate_detected: { type: 'boolean', description: 'Whether similar items exist' },
    similar_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          decision: { type: 'string' },
          similarity: { type: 'number', description: 'Similarity percentage' }
        }
      },
      description: 'Similar existing items if detected'
    }
  },
  required: ['success']
};

/**
 * Output schema for later_list
 */
export const listOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether list operation succeeded' },
    items: {
      type: 'array',
      items: deferredItemSchema,
      description: 'Array of deferred items'
    },
    total_count: { type: 'number', description: 'Total items matching filter' },
    showing_count: { type: 'number', description: 'Number of items returned' },
    formatted_output: { type: 'string', description: 'Human-readable formatted list' },
    message: { type: 'string', description: 'Result summary message' },
    error: { type: 'string', description: 'Error message if failed' },
    pageInfo: {
      type: 'object',
      properties: {
        hasNextPage: { type: 'boolean' },
        hasPrevPage: { type: 'boolean' },
        startCursor: { type: 'string' },
        endCursor: { type: 'string' },
        totalCount: { type: 'number' }
      },
      description: 'Pagination information'
    }
  },
  required: ['success', 'items', 'total_count']
};

/**
 * Output schema for later_show
 */
export const showOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether show operation succeeded' },
    item: deferredItemSchema,
    formatted_output: { type: 'string', description: 'Human-readable formatted item' },
    error: { type: 'string', description: 'Error message if failed' },
    dependencies_resolved: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          decision: { type: 'string' },
          status: { type: 'string' }
        }
      },
      description: 'Resolved dependency items'
    }
  },
  required: ['success']
};

/**
 * Output schema for later_do
 */
export const doOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether operation succeeded' },
    message: { type: 'string', description: 'Result message' },
    error: { type: 'string', description: 'Error message if failed' },
    item: deferredItemSchema,
    blocked_by: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          decision: { type: 'string' },
          status: { type: 'string' }
        }
      },
      description: 'Blocking dependencies if any'
    },
    todo_guidance: { type: 'string', description: 'Recommended TodoWrite guidance' }
  },
  required: ['success']
};

/**
 * Output schema for later_update
 */
export const updateOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether update succeeded' },
    message: { type: 'string', description: 'Result message' },
    error: { type: 'string', description: 'Error message if failed' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any warnings during update'
    },
    item: deferredItemSchema
  },
  required: ['success']
};

/**
 * Output schema for later_delete
 */
export const deleteOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether delete succeeded' },
    message: { type: 'string', description: 'Result message' },
    error: { type: 'string', description: 'Error message if failed' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any warnings'
    },
    deleted_id: { type: 'number', description: 'ID of deleted item' },
    hard_delete: { type: 'boolean', description: 'Whether permanently deleted' }
  },
  required: ['success']
};

/**
 * Output schema for later_bulk_update
 */
export const bulkUpdateOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether all updates succeeded' },
    message: { type: 'string', description: 'Summary message' },
    error: { type: 'string', description: 'Error if complete failure' },
    total: { type: 'number', description: 'Total items processed' },
    succeeded: { type: 'number', description: 'Number of successful updates' },
    failed: { type: 'number', description: 'Number of failed updates' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          success: { type: 'boolean' },
          error: { type: 'string' }
        }
      },
      description: 'Per-item results'
    }
  },
  required: ['success', 'total', 'succeeded', 'failed']
};

/**
 * Output schema for later_bulk_delete
 */
export const bulkDeleteOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether all deletes succeeded' },
    message: { type: 'string', description: 'Summary message' },
    error: { type: 'string', description: 'Error if complete failure' },
    total: { type: 'number', description: 'Total items processed' },
    succeeded: { type: 'number', description: 'Number of successful deletes' },
    failed: { type: 'number', description: 'Number of failed deletes' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          success: { type: 'boolean' },
          error: { type: 'string' }
        }
      },
      description: 'Per-item results'
    }
  },
  required: ['success', 'total', 'succeeded', 'failed']
};

/**
 * Output schema for later_search
 */
export const searchOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether search succeeded' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...deferredItemSchema.properties,
          score: { type: 'number', description: 'Relevance score' }
        }
      },
      description: 'Search results with scores'
    },
    total_count: { type: 'number', description: 'Total matching items' },
    query: { type: 'string', description: 'Search query used' },
    message: { type: 'string', description: 'Result summary' },
    error: { type: 'string', description: 'Error if failed' }
  },
  required: ['success']
};

/**
 * Output schema for search_tools (meta tool)
 */
export const searchToolsOutputSchema: JsonSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', description: 'Whether search succeeded' },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tool name' },
          category: { type: 'string', description: 'Tool category' },
          description: { type: 'string', description: 'Tool description' },
          score: { type: 'number', description: 'Relevance score' },
          inputSchema: { type: 'object', description: 'Tool input schema (if detail=full)' }
        },
        required: ['name', 'category', 'description', 'score']
      },
      description: 'Matching tools'
    },
    total_found: { type: 'number', description: 'Total tools matching query' },
    query: { type: 'string', description: 'Search query used' }
  },
  required: ['success', 'tools', 'total_found', 'query']
};
