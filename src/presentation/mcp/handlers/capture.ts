/**
 * MCP Capture Handler
 *
 * Wraps CaptureItemCommand for MCP tool interface.
 * Maintains backward compatibility with existing tool API.
 */

import type { Container } from '../../composition-root.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface CaptureArgs {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: PriorityValue;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
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
 * Create a capture handler bound to the container
 */
export function createCaptureHandler(
  container: Container
): (args: CaptureArgs) => Promise<CaptureResult> {
  return async (args: CaptureArgs): Promise<CaptureResult> => {
    // Execute the application command
    const result = await container.commands.capture.execute({
      decision: args.decision,
      context: args.context,
      tags: args.tags,
      priority: args.priority,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const captureResult: CaptureResult = {
      success: true,
      item_id: result.item!.id,
      message: `Captured as item #${result.item!.id}`,
    };

    // Include duplicate warning if detected
    if (result.duplicateWarning) {
      captureResult.duplicate_detected = true;
      captureResult.similar_items = [
        {
          id: result.duplicateWarning.existingId,
          decision: result.duplicateWarning.decision,
          similarity: result.duplicateWarning.similarity,
        },
      ];
      captureResult.message += `\n\nSimilar item found: #${result.duplicateWarning.existingId}`;
    }

    return captureResult;
  };
}
