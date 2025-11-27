/**
 * Batch Tools - Bulk operations on multiple items
 *
 * MCP 2025-06 Compliant: Includes outputSchema for typed responses
 */

import { toolRegistry } from '../../registry.js';
import { handleBulkUpdate, handleBulkDelete } from './bulk.js';
import {
  bulkUpdateOutputSchema,
  bulkDeleteOutputSchema
} from '../../schemas/output-schemas.js';

// Register bulk update tool
toolRegistry.register({
  name: 'later_bulk_update',
  category: 'batch',
  keywords: ['bulk', 'batch', 'multiple', 'many', 'update', 'mass'],
  priority: 5,
  description: 'Update multiple deferred items at once. Efficient for mass status changes, priority updates, or tagging.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of item IDs to update (required)'
      },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'archived'],
        description: 'New status for all items (optional)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'New priority for all items (optional)'
      },
      add_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to add to all items (optional)'
      },
      remove_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to remove from all items (optional)'
      }
    },
    required: ['ids']
  },
  outputSchema: bulkUpdateOutputSchema,
  handler: handleBulkUpdate
});

// Register bulk delete tool
toolRegistry.register({
  name: 'later_bulk_delete',
  category: 'batch',
  keywords: ['bulk', 'batch', 'multiple', 'many', 'delete', 'remove', 'mass'],
  priority: 5,
  description: 'Delete or archive multiple deferred items at once. Efficient cleanup of completed or obsolete items.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of item IDs to delete (required)'
      },
      hard: {
        type: 'boolean',
        description: 'Permanently delete (true) or archive (false, default)'
      }
    },
    required: ['ids']
  },
  outputSchema: bulkDeleteOutputSchema,
  handler: handleBulkDelete
});

export { handleBulkUpdate, handleBulkDelete };
