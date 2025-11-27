/**
 * Core Tools - Essential operations (capture, list, show)
 * These are the most frequently used tools
 *
 * MCP 2025-06 Compliant: Includes outputSchema for typed responses
 */

import { toolRegistry } from '../../registry.js';
import { handleCapture } from './capture.js';
import { handleList } from './list.js';
import { handleShow } from './show.js';
import {
  captureOutputSchema,
  listOutputSchema,
  showOutputSchema
} from '../../schemas/output-schemas.js';

// Register capture tool
toolRegistry.register({
  name: 'later_capture',
  category: 'core',
  keywords: ['create', 'add', 'capture', 'defer', 'save', 'new', 'record'],
  priority: 10,
  description: 'Capture a deferred decision with context for later review. Automatically detects and protects PII, checks for duplicates, and stores with full metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        description: 'The decision or task to defer (required)'
      },
      context: {
        type: 'string',
        description: 'Additional context or reasoning (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Priority level (optional, default: medium)'
      }
    },
    required: ['decision']
  },
  outputSchema: captureOutputSchema,
  handler: handleCapture
});

// Register list tool
toolRegistry.register({
  name: 'later_list',
  category: 'core',
  keywords: ['list', 'show', 'display', 'view', 'filter', 'all', 'items'],
  priority: 10,
  description: 'List and filter deferred items. Supports filtering by status, tags, and priority. Returns formatted list with status icons and timestamps.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'archived'],
        description: 'Filter by status (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags - OR logic (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Filter by priority (optional)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of items to return (optional, default: 50)'
      }
    }
  },
  outputSchema: listOutputSchema,
  handler: handleList
});

// Register show tool
toolRegistry.register({
  name: 'later_show',
  category: 'core',
  keywords: ['show', 'get', 'display', 'view', 'details', 'item'],
  priority: 10,
  description: 'Show detailed information for a specific deferred item including full context, dependencies, and metadata. PII is automatically detokenized for display.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The ID of the item to show (required)'
      }
    },
    required: ['id']
  },
  outputSchema: showOutputSchema,
  handler: handleShow
});

export { handleCapture, handleList, handleShow };
