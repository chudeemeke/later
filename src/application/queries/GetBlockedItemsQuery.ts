/**
 * Get Blocked Items Query
 *
 * Retrieves items that are blocked by unresolved dependencies.
 * Uses DependencyResolver for analysis.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import { Dependency, DependencyProps } from '../../domain/entities/Dependency.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import {
  DependencyResolver,
  BlockedItemInfo,
} from '../../domain/services/DependencyResolver.js';

/**
 * Query input
 */
export interface GetBlockedItemsInput {
  includeBlockers?: boolean; // Include details of blocking items
  priorityFilter?: ('low' | 'medium' | 'high')[]; // Filter by priority
}

/**
 * Blocked item with resolution info
 */
export interface BlockedItemResult {
  item: ItemProps;
  blockedBy: Array<{
    id: number;
    decision: string;
    status: string;
  }>;
  canForceComplete: boolean;
}

/**
 * Query result
 */
export interface GetBlockedItemsResult {
  success: boolean;
  blockedItems?: BlockedItemResult[];
  total?: number;
  error?: string;
}

/**
 * Get Blocked Items Query Handler
 */
export class GetBlockedItemsQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetBlockedItemsInput = {}): Promise<GetBlockedItemsResult> {
    try {
      // Get all items and dependencies
      const allItems = await this.storage.listItems();
      const allDeps: DependencyProps[] = [];

      // Collect all dependencies
      for (const item of allItems) {
        const deps = await this.storage.getDependencies(item.id);
        allDeps.push(...deps);
      }

      // Build dependency graph
      const resolver = new DependencyResolver();
      const items = allItems.map((p) => Item.fromProps(p));
      const dependencies = allDeps.map((p) =>
        Dependency.fromProps({
          ...p,
          createdAt: p.createdAt || new Date(),
        })
      );

      resolver.buildGraph(items, dependencies);

      // Get blocked items
      const blockedInfos = resolver.getBlockedItems();

      // Filter by priority if requested
      let filteredInfos = blockedInfos;
      if (input.priorityFilter && input.priorityFilter.length > 0) {
        const itemMap = new Map(allItems.map((i) => [i.id, i]));
        filteredInfos = blockedInfos.filter((info) => {
          const item = itemMap.get(info.itemId);
          return item && input.priorityFilter!.includes(item.priority);
        });
      }

      // Build results
      const blockedItems: BlockedItemResult[] = [];
      const itemMap = new Map(allItems.map((i) => [i.id, i]));

      for (const info of filteredInfos) {
        const item = itemMap.get(info.itemId);
        if (!item) continue;

        const blockers: BlockedItemResult['blockedBy'] = [];

        if (input.includeBlockers !== false) {
          for (const blockerId of info.blockedBy) {
            const blocker = itemMap.get(blockerId);
            if (blocker) {
              blockers.push({
                id: blocker.id,
                decision: blocker.decision,
                status: blocker.status,
              });
            }
          }
        }

        blockedItems.push({
          item,
          blockedBy: blockers,
          canForceComplete: true, // Soft blocking - can always force
        });
      }

      return {
        success: true,
        blockedItems,
        total: blockedItems.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
