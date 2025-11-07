/**
 * Workflow Tools - Operations that change item state (do, update, delete)
 */

import { toolRegistry } from '../../registry.js';
import { handleDo } from './do.js';
import { handleUpdate } from './update.js';
import { handleDelete } from './delete.js';

// Register do tool
toolRegistry.register({
  name: 'later_do',
  category: 'workflow',
  keywords: ['do', 'start', 'begin', 'work', 'action', 'execute'],
  priority: 8,
  description: 'Mark a deferred item as in-progress and get actionable guidance. Checks dependencies and provides todo recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The ID of the item to work on (required)'
      }
    },
    required: ['id']
  },
  handler: handleDo
});

// Register update tool
toolRegistry.register({
  name: 'later_update',
  category: 'workflow',
  keywords: ['update', 'edit', 'modify', 'change', 'revise'],
  priority: 7,
  description: 'Update an existing deferred item. Can modify decision, context, status, priority, tags, or dependencies.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The ID of the item to update (required)'
      },
      decision: {
        type: 'string',
        description: 'Updated decision text (optional)'
      },
      context: {
        type: 'string',
        description: 'Updated context (optional)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'archived'],
        description: 'Updated status (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Updated priority (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tags (optional, replaces existing)'
      },
      dependencies: {
        type: 'array',
        items: { type: 'number' },
        description: 'Updated dependencies (optional, replaces existing)'
      }
    },
    required: ['id']
  },
  handler: handleUpdate
});

// Register delete tool
toolRegistry.register({
  name: 'later_delete',
  category: 'workflow',
  keywords: ['delete', 'remove', 'discard', 'archive'],
  priority: 6,
  description: 'Delete or archive a deferred item. Soft delete by default (archived), hard delete with --hard flag.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The ID of the item to delete (required)'
      },
      hard: {
        type: 'boolean',
        description: 'Permanently delete (true) or archive (false, default)'
      }
    },
    required: ['id']
  },
  handler: handleDelete
});

export { handleDo, handleUpdate, handleDelete };
