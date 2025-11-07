import type { ShowArgs, DeferredItem } from '../types.js';
import type { Storage } from '../storage/interface.js';

export interface ShowResult {
  success: boolean;
  item?: DeferredItem;
  formatted_output?: string;
  error?: string;
}

const STATUS_ICONS: Record<DeferredItem['status'], string> = {
  'pending': '⏸️ Pending',
  'in-progress': '▶️ In Progress',
  'done': '✅ Done',
  'archived': '📦 Archived',
};

const PRIORITY_ICONS: Record<DeferredItem['priority'], string> = {
  'high': '🔴 High',
  'medium': '🟡 Medium',
  'low': '🟢 Low',
};

/**
 * Formats a date in a human-readable format
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a deferred item for detailed display
 */
async function formatItemDetails(
  item: DeferredItem,
  storage: Storage
): Promise<string> {
  const lines: string[] = [];

  // Header
  lines.push(`╔═══════════════════════════════════════════════════════════════╗`);
  lines.push(`║ Item #${item.id.toString().padEnd(56, ' ')}║`);
  lines.push(`╚═══════════════════════════════════════════════════════════════╝`);
  lines.push('');

  // Decision
  lines.push(`Decision: ${item.decision}`);
  lines.push('');

  // Status and Priority
  lines.push(`Status: ${STATUS_ICONS[item.status]}`);
  lines.push(`Priority: ${PRIORITY_ICONS[item.priority]}`);
  lines.push('');

  // Tags
  if (item.tags.length > 0) {
    lines.push(`Tags: ${item.tags.join(', ')}`);
  } else {
    lines.push(`Tags: (none)`);
  }
  lines.push('');

  // Context
  lines.push(`Context:`);
  if (item.context && item.context.trim().length > 0) {
    // Wrap context at reasonable line length
    const contextLines = item.context.split('\n');
    for (const line of contextLines) {
      if (line.length <= 60) {
        lines.push(`  ${line}`);
      } else {
        // Simple word wrap
        const words = line.split(' ');
        let currentLine = '  ';
        for (const word of words) {
          if (currentLine.length + word.length + 1 <= 60) {
            currentLine += (currentLine.length > 2 ? ' ' : '') + word;
          } else {
            lines.push(currentLine);
            currentLine = '  ' + word;
          }
        }
        if (currentLine.length > 2) {
          lines.push(currentLine);
        }
      }
    }
  } else {
    lines.push(`  (no context provided)`);
  }
  lines.push('');

  // Dependencies
  if (item.dependencies && item.dependencies.length > 0) {
    lines.push(`Dependencies:`);
    for (const depId of item.dependencies) {
      const depItem = await storage.findById(depId);
      if (depItem) {
        const statusIcon = STATUS_ICONS[depItem.status];
        lines.push(`  #${depId}: ${depItem.decision} (${statusIcon})`);
      } else {
        lines.push(`  #${depId}: (not found)`);
      }
    }
    lines.push('');
  }

  // Conversation link
  if (item.conversation_id) {
    lines.push(`Conversation: ${item.conversation_id}`);
    lines.push('');
  }

  // Metadata
  lines.push(`Created: ${formatDate(item.created_at)}`);
  lines.push(`Updated: ${formatDate(item.updated_at)}`);

  return lines.join('\n');
}

/**
 * Handles the later_show tool invocation
 * @param args - Show arguments (item ID)
 * @param storage - Storage instance
 * @returns Show result with item details and formatted output
 */
export async function handleShow(
  args: ShowArgs,
  storage: Storage
): Promise<ShowResult> {
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

    // Format output
    const formattedOutput = await formatItemDetails(item, storage);

    return {
      success: true,
      item,
      formatted_output: formattedOutput,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to show item: ${(error as Error).message}`,
    };
  }
}
