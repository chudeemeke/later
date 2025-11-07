/**
 * Bulk operations for efficient multi-item updates and deletes
 * Provides transactional-style operations with detailed error reporting
 */

import type { Storage } from '../storage/interface.js';
import { handleUpdate, UpdateArgs } from './update.js';
import { handleDelete } from './delete.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:bulk');

export interface BulkUpdateArgs {
  ids: number[];
  changes: {
    decision?: string;
    context?: string;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'in-progress' | 'done' | 'archived';
    dependencies?: number[];
  };
}

export interface BulkDeleteArgs {
  ids: number[];
  hard?: boolean;
}

export interface BulkResult {
  success: boolean;
  processed: number[];
  failed: Array<{ id: number; error: string }>;
  total: number;
  succeeded: number;
  failedCount: number;
}

/**
 * Update multiple items with the same changes
 */
export async function handleBulkUpdate(
  args: BulkUpdateArgs,
  storage: Storage
): Promise<BulkResult> {
  const startTime = Date.now();
  const processed: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  log.info('bulk_update_started', {
    total_items: args.ids.length,
    changes: Object.keys(args.changes),
  });

  for (const id of args.ids) {
    try {
      const updateArgs: UpdateArgs = { id, ...args.changes };
      const result = await handleUpdate(updateArgs, storage);

      if (result.success) {
        processed.push(id);
      } else {
        failed.push({
          id,
          error: result.error || 'Update failed',
        });
      }
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const duration = Date.now() - startTime;
  const success = failed.length === 0;

  log.info('bulk_update_completed', {
    total: args.ids.length,
    succeeded: processed.length,
    failed: failed.length,
    duration_ms: duration,
    success,
  });

  return {
    success,
    processed,
    failed,
    total: args.ids.length,
    succeeded: processed.length,
    failedCount: failed.length,
  };
}

/**
 * Delete multiple items
 */
export async function handleBulkDelete(
  args: BulkDeleteArgs,
  storage: Storage
): Promise<BulkResult> {
  const startTime = Date.now();
  const processed: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  log.info('bulk_delete_started', {
    total_items: args.ids.length,
    hard: args.hard || false,
  });

  for (const id of args.ids) {
    try {
      const result = await handleDelete({ id, hard: args.hard }, storage);

      if (result.success) {
        processed.push(id);
      } else {
        failed.push({
          id,
          error: result.error || 'Delete failed',
        });
      }
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const duration = Date.now() - startTime;
  const success = failed.length === 0;

  log.info('bulk_delete_completed', {
    total: args.ids.length,
    succeeded: processed.length,
    failed: failed.length,
    duration_ms: duration,
    success,
  });

  return {
    success,
    processed,
    failed,
    total: args.ids.length,
    succeeded: processed.length,
    failedCount: failed.length,
  };
}
