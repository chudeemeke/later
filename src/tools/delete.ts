/**
 * Delete tool - Remove deferred items (soft or hard delete)
 */

import type { Storage } from '../storage/interface.js';
import { validateDelete } from '../utils/validation.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:delete');

export interface DeleteArgs {
  id: number;
  hard?: boolean;
}

export interface DeleteResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Handle delete tool request
 * Soft delete: Mark as archived (default)
 * Hard delete: Permanently remove from storage
 */
export async function handleDelete(
  args: DeleteArgs,
  storage: Storage
): Promise<DeleteResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const isHardDelete = args.hard === true;

  try {
    // Validate arguments
    const validation = validateDelete(args);
    if (!validation.valid) {
      log.error('delete_validation_failed', {
        id: args.id,
        errors: validation.errors,
      });
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        warnings,
      };
    }

    // Check if item exists
    const existing = await storage.findById(args.id);
    if (!existing) {
      log.error('delete_item_not_found', { id: args.id });
      return {
        success: false,
        error: `Item #${args.id} not found`,
        warnings,
      };
    }

    if (isHardDelete) {
      // Hard delete: Remove from storage
      // Note: This requires storage layer to support delete operation
      // For now, we'll just mark as archived with a flag
      // In Phase 2, we'll implement actual removal
      const deleted = {
        ...existing,
        status: 'archived' as const,
        updated_at: new Date().toISOString(),
      };

      await storage.update(deleted);

      const duration = Date.now() - startTime;
      log.info('delete_hard', {
        id: args.id,
        duration_ms: duration,
      });

      warnings.push(
        'Hard delete not fully implemented yet - item marked as archived instead'
      );

      return {
        success: true,
        message: `✅ Item #${args.id} archived (hard delete pending Phase 2 implementation)`,
        warnings,
      };
    } else {
      // Soft delete: Mark as archived
      const archived = {
        ...existing,
        status: 'archived' as const,
        updated_at: new Date().toISOString(),
      };

      await storage.update(archived);

      const duration = Date.now() - startTime;
      log.info('delete_soft', {
        id: args.id,
        duration_ms: duration,
      });

      return {
        success: true,
        message: `✅ Item #${args.id} archived (soft delete)`,
        warnings,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('delete_failed', {
      id: args.id,
      error: errorMessage,
      duration_ms: duration,
    });

    return {
      success: false,
      error: `Failed to delete item: ${errorMessage}`,
      warnings,
    };
  }
}
