/**
 * Get Stale Items Query
 *
 * Retrieves items that may need attention based on staleness scoring.
 * Uses StalenessChecker for analysis.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import { IStoragePort, ItemFilter } from '../../domain/ports/IStoragePort.js';
import {
  StalenessChecker,
  StalenessConfig,
  StalenessResult,
} from '../../domain/services/StalenessChecker.js';

/**
 * Query input
 */
export interface GetStaleItemsInput {
  minScore?: number; // Minimum staleness score (0-1, default 0.3)
  includeUrgent?: boolean; // Include only urgent items
  priorityFilter?: ('low' | 'medium' | 'high')[];
  excludeArchived?: boolean; // Exclude archived items (default true)
  stalenessConfig?: Partial<StalenessConfig>; // Custom staleness config
}

/**
 * Stale item with analysis
 */
export interface StaleItemResult {
  item: ItemProps;
  stalenessScore: number;
  daysSinceUpdate: number;
  recommendation: 'none' | 'review' | 'refresh' | 'archive';
  factors: {
    timeFactor: number;
    priorityFactor: number;
    activityFactor: number;
  };
}

/**
 * Query result
 */
export interface GetStaleItemsResult {
  success: boolean;
  staleItems?: StaleItemResult[];
  total?: number;
  summary?: {
    refresh: number;
    review: number;
    archive: number;
  };
  error?: string;
}

/**
 * Get Stale Items Query Handler
 */
export class GetStaleItemsQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetStaleItemsInput = {}): Promise<GetStaleItemsResult> {
    try {
      // Build filter
      const filter: ItemFilter = {};

      if (input.excludeArchived !== false) {
        filter.status = ['pending', 'in-progress'];
      }

      if (input.priorityFilter && input.priorityFilter.length > 0) {
        filter.priority = input.priorityFilter;
      }

      // Get items from storage
      const allItems = await this.storage.listItems(filter);

      // Convert to domain entities
      const items = allItems.map((p) => Item.fromProps(p));

      // Create staleness checker with optional config
      const checker = new StalenessChecker(input.stalenessConfig);

      // Get stale items
      const minScore = input.minScore ?? 0.3;
      let stalenessResults: StalenessResult[];

      if (input.includeUrgent) {
        stalenessResults = checker.getUrgentItems(items);
      } else {
        stalenessResults = checker.getStaleItems(items, minScore);
      }

      // Build results
      const itemMap = new Map(allItems.map((i) => [i.id, i]));
      const staleItems: StaleItemResult[] = [];

      for (const result of stalenessResults) {
        const itemProps = itemMap.get(result.itemId);
        if (!itemProps) continue;

        staleItems.push({
          item: itemProps,
          stalenessScore: result.stalenessScore,
          daysSinceUpdate: result.daysSinceUpdate,
          recommendation: result.recommendation ?? 'none',
          factors: result.factors,
        });
      }

      // Sort by staleness score (highest first)
      staleItems.sort((a, b) => b.stalenessScore - a.stalenessScore);

      // Calculate summary
      const summary = {
        refresh: staleItems.filter((i) => i.recommendation === 'refresh').length,
        review: staleItems.filter((i) => i.recommendation === 'review').length,
        archive: staleItems.filter((i) => i.recommendation === 'archive').length,
      };

      return {
        success: true,
        staleItems,
        total: staleItems.length,
        summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
