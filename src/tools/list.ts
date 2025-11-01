import type { ListArgs, DeferredItem } from '../types.js';
import type { Storage } from '../storage/interface.js';

export interface ListResult {
  success: boolean;
  items: DeferredItem[];
  total_count: number;
  showing_count?: number;
  formatted_output?: string;
  message?: string;
  error?: string;
}

const STATUS_ICONS: Record<DeferredItem['status'], string> = {
  'pending': '⏸️',
  'in-progress': '▶️',
  'done': '✅',
  'archived': '📦',
};

const PRIORITY_COLORS: Record<DeferredItem['priority'], string> = {
  'high': '🔴',
  'medium': '🟡',
  'low': '🟢',
};

/**
 * Formats a relative time string (e.g., "2 days ago")
 */
function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return 'just now';
  }
}

/**
 * Formats a single deferred item for display
 */
function formatItem(item: DeferredItem): string {
  const statusIcon = STATUS_ICONS[item.status];
  const priorityIcon = PRIORITY_COLORS[item.priority];
  const age = getRelativeTime(item.created_at);

  let line = `${statusIcon} #${item.id}: ${item.decision}`;

  // Add priority if not medium
  if (item.priority !== 'medium') {
    line += ` ${priorityIcon} ${item.priority}`;
  }

  // Add tags if present
  if (item.tags.length > 0) {
    line += ` [${item.tags.join(', ')}]`;
  }

  line += ` (${age})`;

  return line;
}

/**
 * Filters items based on criteria
 */
function filterItems(
  items: DeferredItem[],
  filters: ListArgs
): DeferredItem[] {
  let filtered = items;

  // Filter by status
  if (filters.status) {
    filtered = filtered.filter((item) => item.status === filters.status);
  }

  // Filter by tags (OR logic - item must have at least one of the specified tags)
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((item) =>
      filters.tags!.some((tag) => item.tags.includes(tag))
    );
  }

  // Filter by priority
  if (filters.priority) {
    filtered = filtered.filter((item) => item.priority === filters.priority);
  }

  return filtered;
}

/**
 * Handles the later_list tool invocation
 * @param args - List arguments (filters)
 * @param storage - Storage instance
 * @returns List result with items and formatted output
 */
export async function handleList(
  args: ListArgs,
  storage: Storage
): Promise<ListResult> {
  try {
    // Read all items
    const allItems = await storage.readAll();

    // Apply filters
    let filtered = filterItems(allItems, args);

    // Sort by created_at descending (newest first)
    filtered.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const totalCount = filtered.length;

    // Apply limit if specified
    let showing = filtered;
    if (args.limit && args.limit > 0) {
      showing = filtered.slice(0, args.limit);
    }

    // Handle empty results
    if (totalCount === 0) {
      return {
        success: true,
        items: [],
        total_count: 0,
        message: 'No items found matching the criteria',
      };
    }

    // Format output
    const lines = showing.map(formatItem);
    let formattedOutput = lines.join('\n');

    // Add summary footer
    if (args.limit && showing.length < totalCount) {
      formattedOutput += `\n\nShowing ${showing.length} of ${totalCount} items`;
    } else {
      formattedOutput += `\n\nTotal: ${totalCount} item${totalCount === 1 ? '' : 's'}`;
    }

    return {
      success: true,
      items: showing,
      total_count: totalCount,
      showing_count: showing.length,
      formatted_output: formattedOutput,
      message: `Found ${totalCount} item${totalCount === 1 ? '' : 's'}`,
    };
  } catch (error) {
    return {
      success: false,
      items: [],
      total_count: 0,
      error: `Failed to list items: ${(error as Error).message}`,
    };
  }
}
