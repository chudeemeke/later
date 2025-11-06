/**
 * Query utilities for filtering, sorting, and pagination
 */

import type {
  DeferredItem,
  AdvancedFilters,
  FilterOperator,
  SortOptions,
  PaginationArgs,
  PaginatedResult,
  PageInfo,
} from '../types.js';

/**
 * Encode item ID as base64 cursor
 */
export function encodeCursor(id: number): string {
  return Buffer.from(id.toString()).toString('base64');
}

/**
 * Decode base64 cursor to item ID
 */
export function decodeCursor(cursor: string): number | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const id = parseInt(decoded, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

/**
 * Apply a single filter operator to a field value
 */
function matchesFilter(
  value: any,
  operator: FilterOperator,
  item?: DeferredItem
): boolean {
  // Equality
  if (operator.eq !== undefined) {
    return value === operator.eq;
  }

  // Inequality
  if (operator.ne !== undefined) {
    return value !== operator.ne;
  }

  // In array
  if (operator.in !== undefined) {
    return operator.in.includes(value);
  }

  // String operations
  if (typeof value === 'string') {
    if (operator.contains !== undefined) {
      return value.toLowerCase().includes(operator.contains.toLowerCase());
    }

    if (operator.startsWith !== undefined) {
      return value.startsWith(operator.startsWith);
    }

    if (operator.endsWith !== undefined) {
      return value.endsWith(operator.endsWith);
    }
  }

  // Numeric operations
  if (typeof value === 'number') {
    if (operator.gte !== undefined && value < operator.gte) {
      return false;
    }

    if (operator.lte !== undefined && value > operator.lte) {
      return false;
    }

    // If we passed both gte and lte checks, return true
    if (operator.gte !== undefined || operator.lte !== undefined) {
      return true;
    }
  }

  // Tag operations
  if (operator.hasTag !== undefined && item) {
    return item.tags.includes(operator.hasTag);
  }

  return true;
}

/**
 * Apply advanced filters to items
 */
export function applyFilters(
  items: DeferredItem[],
  filters: AdvancedFilters
): DeferredItem[] {
  return items.filter((item) => {
    // Check each filter field
    for (const [field, operator] of Object.entries(filters)) {
      if (!operator) continue;

      // Special handling for tags
      if (field === 'tags') {
        if (!matchesFilter(null, operator, item)) {
          return false;
        }
        continue;
      }

      // Get field value
      const value = (item as any)[field];

      if (!matchesFilter(value, operator)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Priority order for sorting
 */
const PRIORITY_ORDER: Record<DeferredItem['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Status order for sorting
 */
const STATUS_ORDER: Record<DeferredItem['status'], number> = {
  'in-progress': 4,
  pending: 3,
  done: 2,
  archived: 1,
};

/**
 * Apply sorting to items
 */
export function applySorting(
  items: DeferredItem[],
  sortOptions: SortOptions[]
): DeferredItem[] {
  // Create a copy to avoid mutating original
  const sorted = [...items];

  sorted.sort((a, b) => {
    for (const option of sortOptions) {
      let comparison = 0;

      // Handle priority sorting with custom order
      if (option.field === 'priority') {
        const aPriority = PRIORITY_ORDER[a.priority];
        const bPriority = PRIORITY_ORDER[b.priority];
        comparison = aPriority - bPriority;
      }
      // Handle status sorting with custom order
      else if (option.field === 'status') {
        const aStatus = STATUS_ORDER[a.status];
        const bStatus = STATUS_ORDER[b.status];
        comparison = aStatus - bStatus;
      }
      // Handle date/timestamp sorting
      else if (option.field === 'created_at' || option.field === 'updated_at') {
        const aTime = new Date(a[option.field]).getTime();
        const bTime = new Date(b[option.field]).getTime();
        comparison = aTime - bTime;
      }
      // Handle numeric sorting (like id)
      else {
        const aValue = (a as any)[option.field];
        const bValue = (b as any)[option.field];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          // Fallback to string comparison
          comparison = String(aValue).localeCompare(String(bValue));
        }
      }

      // Apply direction
      if (option.direction === 'DESC') {
        comparison = -comparison;
      }

      // If not equal, return this comparison
      if (comparison !== 0) {
        return comparison;
      }

      // If equal, continue to next sort option
    }

    return 0;
  });

  return sorted;
}

/**
 * Paginate results with cursor-based pagination
 */
export function paginateResults(
  items: DeferredItem[],
  args: PaginationArgs
): PaginatedResult<DeferredItem> {
  const totalCount = items.length;

  // Handle empty results
  if (totalCount === 0) {
    return {
      items: [],
      pageInfo: {
        hasNextPage: false,
        hasPrevPage: false,
        startCursor: null,
        endCursor: null,
        totalCount: 0,
      },
    };
  }

  let startIndex = 0;
  let endIndex = totalCount;

  // Forward pagination (first + after)
  if (args.first !== undefined) {
    if (args.after) {
      const afterId = decodeCursor(args.after);
      if (afterId !== null) {
        // Find index of item with this ID
        const afterIndex = items.findIndex((item) => item.id === afterId);
        if (afterIndex !== -1) {
          startIndex = afterIndex + 1;
        }
      }
    }

    endIndex = Math.min(startIndex + args.first, totalCount);
  }
  // Backward pagination (last + before)
  else if (args.last !== undefined) {
    if (args.before) {
      const beforeId = decodeCursor(args.before);
      if (beforeId !== null) {
        // Find index of item with this ID
        const beforeIndex = items.findIndex((item) => item.id === beforeId);
        if (beforeIndex !== -1) {
          endIndex = beforeIndex;
        }
      }
    }

    startIndex = Math.max(endIndex - args.last, 0);
  }

  const pageItems = items.slice(startIndex, endIndex);

  // Build page info
  const pageInfo: PageInfo = {
    hasNextPage: endIndex < totalCount,
    hasPrevPage: startIndex > 0,
    startCursor:
      pageItems.length > 0 ? encodeCursor(pageItems[0].id) : null,
    endCursor:
      pageItems.length > 0
        ? encodeCursor(pageItems[pageItems.length - 1].id)
        : null,
    totalCount,
  };

  return {
    items: pageItems,
    pageInfo,
  };
}
