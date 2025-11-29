/**
 * Bulk operations for efficient multi-item updates and deletes
 * Provides transactional-style operations with detailed error reporting
 *
 * Design: Uses Dependency Injection for handler functions to enable
 * testability while maintaining backward compatibility with defaults.
 */

import type { Storage } from "../../storage/interface.js";
import {
  handleUpdate as defaultHandleUpdate,
  UpdateArgs,
  UpdateResult,
} from "../workflow/update.js";
import {
  handleDelete as defaultHandleDelete,
  DeleteArgs,
  DeleteResult,
} from "../workflow/delete.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("later:bulk");

/**
 * Handler function types for dependency injection
 * Allows mocking in tests while using real implementations by default
 */
export type UpdateHandler = (
  args: UpdateArgs,
  storage: Storage,
) => Promise<UpdateResult>;
export type DeleteHandler = (
  args: DeleteArgs,
  storage: Storage,
) => Promise<DeleteResult>;

export interface BulkUpdateArgs {
  ids: number[];
  changes: {
    decision?: string;
    context?: string;
    tags?: string[];
    priority?: "low" | "medium" | "high";
    status?: "pending" | "in-progress" | "done" | "archived";
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
 *
 * @param args - Bulk update arguments (ids and changes)
 * @param storage - Storage implementation
 * @param updateFn - Optional update handler for dependency injection (defaults to handleUpdate)
 */
export async function handleBulkUpdate(
  args: BulkUpdateArgs,
  storage: Storage,
  updateFn: UpdateHandler = defaultHandleUpdate,
): Promise<BulkResult> {
  const startTime = Date.now();
  const processed: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  log.info("bulk_update_started", {
    total_items: args.ids.length,
    changes: Object.keys(args.changes),
  });

  for (const id of args.ids) {
    try {
      const updateArgs: UpdateArgs = { id, ...args.changes };
      const result = await updateFn(updateArgs, storage);

      if (result.success) {
        processed.push(id);
      } else {
        failed.push({
          id,
          error: result.error || "Update failed",
        });
      }
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const duration = Date.now() - startTime;
  const success = failed.length === 0;

  log.info("bulk_update_completed", {
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
 *
 * @param args - Bulk delete arguments (ids and hard flag)
 * @param storage - Storage implementation
 * @param deleteFn - Optional delete handler for dependency injection (defaults to handleDelete)
 */
export async function handleBulkDelete(
  args: BulkDeleteArgs,
  storage: Storage,
  deleteFn: DeleteHandler = defaultHandleDelete,
): Promise<BulkResult> {
  const startTime = Date.now();
  const processed: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  log.info("bulk_delete_started", {
    total_items: args.ids.length,
    hard: args.hard || false,
  });

  for (const id of args.ids) {
    try {
      const result = await deleteFn({ id, hard: args.hard }, storage);

      if (result.success) {
        processed.push(id);
      } else {
        failed.push({
          id,
          error: result.error || "Delete failed",
        });
      }
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const duration = Date.now() - startTime;
  const success = failed.length === 0;

  log.info("bulk_delete_completed", {
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
