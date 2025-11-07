import type { DoArgs, DeferredItem } from '../types.js';
import type { Storage } from '../storage/interface.js';

export interface DoResult {
  success: boolean;
  message?: string;
  todo_guidance?: string;
  warnings?: string;
  error?: string;
}

/**
 * Generates TodoWrite guidance for a deferred item
 */
function generateTodoGuidance(item: DeferredItem): string {
  const lines: string[] = [];

  lines.push(`📋 Ready to work on: ${item.decision}`);
  lines.push('');

  // Priority indicator
  if (item.priority === 'high') {
    lines.push(`⚠️ Priority: HIGH - Consider tackling this soon`);
  } else if (item.priority === 'low') {
    lines.push(`ℹ️ Priority: Low - Work on when time permits`);
  }

  // Context
  if (item.context && item.context.trim().length > 0) {
    lines.push('');
    lines.push(`Context:`);
    lines.push(`  ${item.context}`);
  }

  // Tags
  if (item.tags.length > 0) {
    lines.push('');
    lines.push(`Tags: ${item.tags.join(', ')}`);
  }

  // Todo guidance
  lines.push('');
  lines.push(`Suggested approach:`);
  lines.push(`1. Use the TodoWrite tool to create actionable tasks`);
  lines.push(`2. Break down "${item.decision}" into specific steps`);
  lines.push(`3. Mark this item as done when complete: later_show ${item.id}`);

  lines.push('');
  lines.push(`Example todo items:`);
  lines.push(`  • Research and plan: ${item.decision}`);
  lines.push(`  • Implement: ${item.decision}`);
  lines.push(`  • Test and validate: ${item.decision}`);

  return lines.join('\n');
}

/**
 * Checks if dependencies are met for an item
 */
async function checkDependencies(
  item: DeferredItem,
  storage: Storage
): Promise<{ met: boolean; unmetDeps: number[] }> {
  if (!item.dependencies || item.dependencies.length === 0) {
    return { met: true, unmetDeps: [] };
  }

  const unmetDeps: number[] = [];

  for (const depId of item.dependencies) {
    const depItem = await storage.findById(depId);
    if (!depItem || depItem.status !== 'done') {
      unmetDeps.push(depId);
    }
  }

  return { met: unmetDeps.length === 0, unmetDeps };
}

/**
 * Handles the later_do tool invocation
 * @param args - Do arguments (item ID)
 * @param storage - Storage instance
 * @returns Do result with guidance and status update
 */
export async function handleDo(
  args: DoArgs,
  storage: Storage
): Promise<DoResult> {
  // Validate ID
  if (args.id <= 0) {
    return {
      success: false,
      error: 'Invalid ID: must be a positive number',
    };
  }

  try {
    // Find item
    const item = await storage.findById(args.id);

    if (!item) {
      return {
        success: false,
        error: `Item #${args.id} not found`,
      };
    }

    const warnings: string[] = [];

    // Check current status
    if (item.status === 'done') {
      warnings.push('⚠️ This item is already done');
    } else if (item.status === 'in-progress') {
      warnings.push('ℹ️ This item is already in-progress');
    }

    // Check dependencies
    const { met, unmetDeps } = await checkDependencies(item, storage);
    if (!met) {
      warnings.push(
        `⚠️ Dependencies not met: Items ${unmetDeps.map(id => `#${id}`).join(', ')} must be completed first`
      );
    }

    // Update item status to in-progress (if not already done)
    if (item.status !== 'done') {
      item.status = 'in-progress';
      item.updated_at = new Date().toISOString();
      await storage.update(item);
    }

    // Generate todo guidance
    const todoGuidance = generateTodoGuidance(item);

    return {
      success: true,
      message: `✅ Item #${args.id} marked as in-progress`,
      todo_guidance: todoGuidance,
      warnings: warnings.length > 0 ? warnings.join('\n') : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process item: ${(error as Error).message}`,
    };
  }
}
