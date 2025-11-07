import type { ListArgs, DeferredItem, PageInfo } from '../../types.js';
import type { Storage } from '../../storage/interface.js';
import { applyFilters, applySorting, paginateResults } from '../../utils/query.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('later:list');

export interface ListResult {
  success: boolean;
  items: DeferredItem[];
  total_count: number;
  showing_count?: number;
  formatted_output?: string;
  message?: string;
  error?: string;
  pageInfo?: PageInfo; // Phase 2: Pagination info
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
 * Phase 2: Enhanced with advanced filtering, sorting, and pagination
 * @param args - List arguments (filters, sorting, pagination)
 * @param storage - Storage instance
 * @returns List result with items and formatted output
 */
export async function handleList(
  args: ListArgs,
  storage: Storage
): Promise<ListResult> {
  const startTime = Date.now();

  try {
    // Read all items
    let items = await storage.readAll();
    const originalCount = items.length;

    // Apply legacy filters (backward compatibility)
    items = filterItems(items, args);
    const afterLegacyFilter = items.length;

    // Apply advanced filters (Phase 2)
    if (args.filters) {
      items = applyFilters(items, args.filters);
      log.info('advanced_filters_applied', {
        before: afterLegacyFilter,
        after: items.length,
      });
    }

    const totalFiltered = items.length;

    // Handle empty results early
    if (totalFiltered === 0) {
      const duration = Date.now() - startTime;
      log.info('list_empty', {
        original_count: originalCount,
        duration_ms: duration,
      });

      return {
        success: true,
        items: [],
        total_count: 0,
        showing_count: 0,
        message: 'No items found matching the criteria',
      };
    }

    // Apply sorting (Phase 2)
    const sortOptions = args.orderBy || [
      { field: 'created_at', direction: 'DESC' },
    ];
    items = applySorting(items, sortOptions);

    // Apply pagination (Phase 2)
    let pageInfo: PageInfo | undefined;
    let showing: DeferredItem[];

    if (args.pagination) {
      // Use cursor-based pagination
      const paginated = paginateResults(items, args.pagination);
      showing = paginated.items;
      pageInfo = paginated.pageInfo;

      log.info('pagination_applied', {
        total_items: totalFiltered,
        page_size: showing.length,
        has_next: pageInfo.hasNextPage,
        has_prev: pageInfo.hasPrevPage,
      });
    } else if (args.limit && args.limit > 0) {
      // Legacy limit (backward compatibility)
      showing = items.slice(0, args.limit);
    } else {
      showing = items;
    }

    // Format output
    const lines = showing.map(formatItem);
    let formattedOutput = lines.join('\n');

    // Add summary footer
    if (pageInfo) {
      formattedOutput += `\n\nShowing ${showing.length} of ${totalFiltered} items`;
      if (pageInfo.hasNextPage) {
        formattedOutput += ' (more available)';
      }
    } else if (args.limit && showing.length < totalFiltered) {
      formattedOutput += `\n\nShowing ${showing.length} of ${totalFiltered} items`;
    } else {
      formattedOutput += `\n\nTotal: ${totalFiltered} item${totalFiltered === 1 ? '' : 's'}`;
    }

    const duration = Date.now() - startTime;
    log.info('list_success', {
      original_count: originalCount,
      filtered_count: totalFiltered,
      returned_count: showing.length,
      duration_ms: duration,
    });

    return {
      success: true,
      items: showing,
      total_count: totalFiltered,
      showing_count: showing.length,
      formatted_output: formattedOutput,
      message: `Found ${totalFiltered} item${totalFiltered === 1 ? '' : 's'}`,
      pageInfo,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('list_failed', {
      error: errorMessage,
      duration_ms: duration,
    });

    return {
      success: false,
      items: [],
      total_count: 0,
      error: `Failed to list items: ${errorMessage}`,
    };
  }
}
