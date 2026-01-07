/**
 * Search Items Query
 *
 * Full-text search with relevance ranking.
 * Supports filtering search results.
 */

import { ItemProps } from '../../domain/entities/Item.js';
import {
  IStoragePort,
  ItemFilter,
  PaginationOptions,
  SearchResult,
} from '../../domain/ports/IStoragePort.js';
import { StatusValue } from '../../domain/value-objects/Status.js';
import { PriorityValue } from '../../domain/value-objects/Priority.js';

/**
 * Query input
 */
export interface SearchItemsInput {
  query: string;

  // Optional filters
  status?: StatusValue | StatusValue[];
  priority?: PriorityValue | PriorityValue[];
  tags?: string[];

  // Pagination
  limit?: number;
  offset?: number;

  // Search options
  includeArchived?: boolean;
}

/**
 * Search result with relevance
 */
export interface SearchItemResult {
  item: ItemProps;
  score: number;
  highlights?: string[]; // Matching snippets from decision/context
}

/**
 * Query result
 */
export interface SearchItemsResult {
  success: boolean;
  results?: SearchItemResult[];
  total?: number;
  hasMore?: boolean;
  error?: string;
}

/**
 * Search Items Query Handler
 */
export class SearchItemsQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the search query
   */
  async execute(input: SearchItemsInput): Promise<SearchItemsResult> {
    try {
      // Validate query
      if (!input.query || input.query.trim().length === 0) {
        return {
          success: false,
          error: 'Search query is required',
        };
      }

      const query = input.query.trim();

      // Build filter
      const filter = this.buildFilter(input);

      // Build pagination
      const pagination: PaginationOptions | undefined =
        input.limit !== undefined
          ? {
              limit: input.limit,
              offset: input.offset ?? 0,
            }
          : undefined;

      // Execute search
      const searchResults = await this.storage.searchItems(query, filter, pagination);

      // Transform results
      const results: SearchItemResult[] = searchResults.map((sr) => ({
        item: sr.item,
        score: sr.score,
        highlights: sr.highlights,
      }));

      // Get total count (without pagination) for pagination info
      const allResults = await this.storage.searchItems(query, filter);
      const total = allResults.length;

      const limit = pagination?.limit ?? results.length;
      const offset = pagination?.offset ?? 0;
      const hasMore = offset + results.length < total;

      return {
        success: true,
        results,
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
   * Build filter from input
   */
  private buildFilter(input: SearchItemsInput): ItemFilter {
    const filter: ItemFilter = {};

    // By default, exclude archived items unless explicitly requested
    if (!input.includeArchived) {
      filter.status = ['pending', 'in-progress', 'done'];
    } else if (input.status) {
      filter.status = Array.isArray(input.status) ? input.status : [input.status];
    }

    if (input.priority) {
      filter.priority = Array.isArray(input.priority)
        ? input.priority
        : [input.priority];
    }

    if (input.tags && input.tags.length > 0) {
      filter.tags = input.tags;
    }

    return filter;
  }
}
