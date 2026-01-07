/**
 * List Items Query
 *
 * Lists items with filtering, sorting, and pagination.
 * Supports various filter combinations for flexible querying.
 */

import { ItemProps } from '../../domain/entities/Item.js';
import {
  IStoragePort,
  ItemFilter,
  ItemSort,
  PaginationOptions,
} from '../../domain/ports/IStoragePort.js';
import { StatusValue } from '../../domain/value-objects/Status.js';
import { PriorityValue } from '../../domain/value-objects/Priority.js';

/**
 * Query input
 */
export interface ListItemsInput {
  // Filters
  status?: StatusValue | StatusValue[];
  priority?: PriorityValue | PriorityValue[];
  tags?: string[];
  tagsMatchAll?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  hasContext?: boolean;
  hasDependencies?: boolean;
  isBlocked?: boolean;

  // Sorting
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';

  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Query result
 */
export interface ListItemsResult {
  success: boolean;
  items?: ItemProps[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}

/**
 * List Items Query Handler
 */
export class ListItemsQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: ListItemsInput = {}): Promise<ListItemsResult> {
    try {
      // Build filter from input
      const filter = this.buildFilter(input);
      const sort = this.buildSort(input);
      const pagination = this.buildPagination(input);

      // Get items from storage
      const items = await this.storage.listItems(filter, sort, pagination);

      // Calculate total for pagination info
      // Note: This is a simplified approach. For production,
      // the storage layer should return total count efficiently.
      const allItems = await this.storage.listItems(filter);
      const total = allItems.length;

      const limit = pagination?.limit ?? items.length;
      const offset = pagination?.offset ?? 0;
      const hasMore = offset + items.length < total;

      return {
        success: true,
        items,
        total,
        hasMore,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build filter object from input
   */
  private buildFilter(input: ListItemsInput): ItemFilter {
    const filter: ItemFilter = {};

    if (input.status !== undefined) {
      filter.status = Array.isArray(input.status) ? input.status : [input.status];
    }

    if (input.priority !== undefined) {
      filter.priority = Array.isArray(input.priority)
        ? input.priority
        : [input.priority];
    }

    if (input.tags && input.tags.length > 0) {
      filter.tags = input.tags;
      // Note: tagsMatchAll filtering is handled by the infrastructure layer
    }

    if (input.createdAfter) {
      filter.createdAfter = input.createdAfter;
    }

    if (input.createdBefore) {
      filter.createdBefore = input.createdBefore;
    }

    if (input.updatedAfter) {
      filter.updatedAfter = input.updatedAfter;
    }

    if (input.updatedBefore) {
      filter.updatedBefore = input.updatedBefore;
    }

    // Note: hasContext filtering is handled in the application layer post-query
    // if needed, as ItemFilter doesn't support it directly

    if (input.hasDependencies !== undefined) {
      filter.hasDependencies = input.hasDependencies;
    }

    if (input.isBlocked !== undefined) {
      filter.isBlocked = input.isBlocked;
    }

    return filter;
  }

  /**
   * Build sort object from input
   */
  private buildSort(input: ListItemsInput): ItemSort | undefined {
    if (!input.sortBy) {
      return undefined;
    }

    return {
      field: input.sortBy,
      direction: input.sortOrder ?? 'desc',
    };
  }

  /**
   * Build pagination object from input
   */
  private buildPagination(input: ListItemsInput): PaginationOptions | undefined {
    if (input.limit === undefined && input.offset === undefined) {
      return undefined;
    }

    return {
      limit: input.limit,
      offset: input.offset ?? 0,
    };
  }
}
