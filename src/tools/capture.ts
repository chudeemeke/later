import type { CaptureArgs, DeferredItem } from '../types.js';
import type { Storage } from '../storage/interface.js';
import type { SimilarItem } from '../utils/duplicate.js';
import { sanitizeSecrets, hasSecrets, getSecretsSummary } from '../utils/security.js';
import { findSimilarItems } from '../utils/duplicate.js';
import { extractContext, truncateContext } from '../utils/context.js';

export interface CaptureResult {
  success: boolean;
  item_id?: number;
  message?: string;
  error?: string;
  warnings?: string[];
  duplicate_detected?: boolean;
  similar_items?: Array<{
    id: number;
    decision: string;
    similarity: number;
  }>;
}

/**
 * Handles the later_capture tool invocation
 * @param args - Capture arguments
 * @param storage - Storage instance
 * @returns Capture result with item ID and messages
 */
export async function handleCapture(
  args: CaptureArgs,
  storage: Storage
): Promise<CaptureResult> {
  // Validate input
  if (!args.decision || args.decision.trim().length === 0) {
    return {
      success: false,
      error: 'Decision cannot be empty',
    };
  }

  const warnings: string[] = [];

  // Extract and process context
  let context = extractContext(args.context);

  // Truncate context if too long (before secret detection to avoid false positives)
  context = truncateContext(context, 5000);

  // Check for secrets in context
  if (hasSecrets(context)) {
    const summary = getSecretsSummary(context);
    warnings.push(`⚠️  Secrets detected and sanitized: ${summary}`);
    context = sanitizeSecrets(context);
  }

  // Check for duplicates
  const existingItems = await storage.readAll();
  const newItem: Partial<DeferredItem> = {
    decision: args.decision.trim(),
    context,
    tags: args.tags || [],
    priority: args.priority || 'medium',
    status: 'pending',
  };

  const similarItems = findSimilarItems(
    newItem as DeferredItem,
    existingItems,
    80 // 80% similarity threshold
  );

  // If duplicates detected, include in result
  let duplicateDetected = false;
  let similarItemsInfo: Array<{ id: number; decision: string; similarity: number }> = [];

  if (similarItems.length > 0) {
    duplicateDetected = true;
    similarItemsInfo = similarItems.map((si) => ({
      id: si.item.id,
      decision: si.item.decision,
      similarity: si.similarity,
    }));
  }

  // Create item without ID (will be auto-assigned atomically)
  const now = new Date().toISOString();

  const item = {
    decision: args.decision.trim(),
    context,
    status: 'pending' as const,
    tags: args.tags || [],
    priority: args.priority || 'medium',
    created_at: now,
    updated_at: now,
  };

  // Save to storage (ID assigned atomically within lock for concurrency safety)
  try {
    const id = await storage.append(item);

    const result: CaptureResult = {
      success: true,
      item_id: id,
      message: `✅ Captured as item #${id}`,
      duplicate_detected: duplicateDetected,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    if (duplicateDetected) {
      result.similar_items = similarItemsInfo;
      result.message += `\n\n⚠️  Similar items found:\n` +
        similarItemsInfo
          .map((si) => `  #${si.id}: ${si.decision} (${si.similarity}% similar)`)
          .join('\n');
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to capture item: ${(error as Error).message}`,
    };
  }
}
