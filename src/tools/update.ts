/**
 * Update tool - Modify existing deferred items
 */

import type { Storage } from '../storage/interface.js';
import type { DeferredItem } from '../types.js';
import { validateUpdate } from '../utils/validation.js';
import { validateTransition, getTransitionError } from '../utils/state-machine.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:update');

export interface UpdateArgs {
  id: number;
  decision?: string;
  context?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in-progress' | 'done' | 'archived';
  dependencies?: number[];
}

export interface UpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
  item?: DeferredItem;
}

/**
 * Check for dependency cycles using DFS
 */
async function hasDependencyCycle(
  itemId: number,
  newDependencies: number[],
  storage: Storage,
  visited: Set<number> = new Set(),
  recursionStack: Set<number> = new Set()
): Promise<boolean> {
  // Self-dependency check
  if (newDependencies.includes(itemId)) {
    return true;
  }

  // Build dependency graph starting from new dependencies
  for (const depId of newDependencies) {
    // Skip if already visited in this path
    if (recursionStack.has(depId)) {
      return true; // Cycle detected
    }

    // Cycle back to original item
    if (depId === itemId) {
      return true;
    }

    if (!visited.has(depId)) {
      visited.add(depId);
      recursionStack.add(depId);

      // Get dependencies of this dependency
      const depItem = await storage.findById(depId);
      if (depItem && depItem.dependencies && depItem.dependencies.length > 0) {
        const hasCycle = await hasDependencyCycle(
          itemId,
          depItem.dependencies,
          storage,
          visited,
          recursionStack
        );

        if (hasCycle) {
          return true;
        }
      }

      recursionStack.delete(depId);
    }
  }

  return false;
}

/**
 * Handle update tool request
 */
export async function handleUpdate(
  args: UpdateArgs,
  storage: Storage
): Promise<UpdateResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Validate arguments
    const validation = validateUpdate(args);
    if (!validation.valid) {
      log.error('update_validation_failed', {
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
      log.error('update_item_not_found', { id: args.id });
      return {
        success: false,
        error: `Item #${args.id} not found`,
        warnings,
      };
    }

    // Validate state transition if status is being updated
    if (args.status && args.status !== existing.status) {
      if (!validateTransition(existing.status, args.status)) {
        const transitionError = getTransitionError(existing.status, args.status);
        log.error('update_invalid_transition', {
          id: args.id,
          from: existing.status,
          to: args.status,
        });
        return {
          success: false,
          error: `Invalid status transition: ${transitionError}`,
          warnings,
        };
      }
    }

    // Check for dependency cycles if dependencies are being updated
    if (args.dependencies !== undefined && args.dependencies.length > 0) {
      const hasCycle = await hasDependencyCycle(args.id, args.dependencies, storage);

      if (hasCycle) {
        log.error('update_dependency_cycle', {
          id: args.id,
          dependencies: args.dependencies,
        });
        return {
          success: false,
          error: `Dependency cycle detected: Item #${args.id} would create a circular dependency`,
          warnings,
        };
      }
    }

    // Build updated item (merge with existing)
    const updated: DeferredItem = {
      ...existing,
      ...(args.decision !== undefined && { decision: args.decision }),
      ...(args.context !== undefined && { context: args.context }),
      ...(args.tags !== undefined && { tags: args.tags }),
      ...(args.priority !== undefined && { priority: args.priority }),
      ...(args.status !== undefined && { status: args.status }),
      ...(args.dependencies !== undefined && { dependencies: args.dependencies }),
      id: existing.id, // Ensure ID doesn't change
      created_at: existing.created_at, // Preserve creation timestamp
      updated_at: new Date().toISOString(), // Update timestamp
    };

    // Update storage
    await storage.update(updated);

    const duration = Date.now() - startTime;
    log.info('update_success', {
      id: args.id,
      changes: Object.keys(args).filter((k) => k !== 'id'),
      duration_ms: duration,
    });

    return {
      success: true,
      message: `✅ Updated item #${args.id}`,
      item: updated,
      warnings,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('update_failed', {
      id: args.id,
      error: errorMessage,
      duration_ms: duration,
    });

    return {
      success: false,
      error: `Failed to update item: ${errorMessage}`,
      warnings,
    };
  }
}
