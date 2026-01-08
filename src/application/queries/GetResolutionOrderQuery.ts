/**
 * Get Resolution Order Query
 *
 * Returns items in the optimal order for completion based on dependencies.
 * Uses topological sort to ensure dependencies are resolved first.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import { Dependency, DependencyProps } from '../../domain/entities/Dependency.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { DependencyResolver } from '../../domain/services/DependencyResolver.js';

/**
 * Query input
 */
export interface GetResolutionOrderInput {
  includeCompleted?: boolean; // Include done/archived items
  includeStats?: boolean; // Include dependency statistics
  includeNextActions?: boolean; // Include recommended next actions
  priorityFilter?: ('low' | 'medium' | 'high')[];
  tagFilter?: string[];
  limit?: number;
}

/**
 * Item in resolution order
 */
export interface OrderedItem {
  id: number;
  decision: string;
  status: string;
  priority: string;
  tags: string[];
  isBlocked: boolean;
  blockerCount: number;
  order: number; // Position in resolution order
}

/**
 * Dependency statistics
 */
export interface ResolutionStats {
  totalItems: number;
  itemsWithDependencies: number;
  blockedItems: number;
  maxDepth: number;
}

/**
 * Next action recommendation
 */
export interface NextAction {
  id: number;
  decision: string;
  priority: string;
  reason: string;
  unblocks: number; // Number of items this unblocks
}

/**
 * Query result
 */
export interface GetResolutionOrderResult {
  success: boolean;
  order?: OrderedItem[];
  stats?: ResolutionStats;
  nextActions?: NextAction[];
  error?: string;
}

/**
 * Get Resolution Order Query Handler
 */
export class GetResolutionOrderQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetResolutionOrderInput = {}): Promise<GetResolutionOrderResult> {
    try {
      // Get all items
      const allItems = await this.storage.listItems();

      if (allItems.length === 0) {
        return {
          success: true,
          order: [],
          stats: input.includeStats
            ? {
                totalItems: 0,
                itemsWithDependencies: 0,
                blockedItems: 0,
                maxDepth: 0,
              }
            : undefined,
          nextActions: input.includeNextActions ? [] : undefined,
        };
      }

      // Collect all dependencies
      const allDeps: DependencyProps[] = [];
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

      // Get resolution order from resolver
      const orderIds = resolver.getResolutionOrder();

      // Filter items based on criteria
      let filteredItems = allItems;

      // Exclude completed unless requested
      if (!input.includeCompleted) {
        filteredItems = filteredItems.filter(
          (i) => i.status !== 'done' && i.status !== 'archived'
        );
      }

      // Filter by priority
      if (input.priorityFilter && input.priorityFilter.length > 0) {
        filteredItems = filteredItems.filter((i) =>
          input.priorityFilter!.includes(i.priority as 'low' | 'medium' | 'high')
        );
      }

      // Filter by tags
      if (input.tagFilter && input.tagFilter.length > 0) {
        filteredItems = filteredItems.filter((i) =>
          i.tags.some((t) => input.tagFilter!.includes(t))
        );
      }

      const filteredIds = new Set(filteredItems.map((i) => i.id));

      // Build ordered result respecting resolution order
      const itemMap = new Map(allItems.map((i) => [i.id, i]));
      const orderedItems: OrderedItem[] = [];

      // First add items in resolution order (if they pass filters)
      let orderPosition = 1;
      for (const id of orderIds) {
        if (filteredIds.has(id)) {
          const item = itemMap.get(id)!;
          const blockerCount = resolver.getDependencies(id).filter((depId) => {
            const depNode = itemMap.get(depId);
            return depNode && depNode.status !== 'done' && depNode.status !== 'archived';
          }).length;

          orderedItems.push({
            id: item.id,
            decision: item.decision,
            status: item.status,
            priority: item.priority,
            tags: item.tags,
            isBlocked: blockerCount > 0,
            blockerCount,
            order: orderPosition++,
          });
        }
      }

      // Add any remaining filtered items not in the graph order
      for (const item of filteredItems) {
        if (!orderedItems.some((o) => o.id === item.id)) {
          const blockerCount = resolver.getDependencies(item.id).filter((depId) => {
            const depNode = itemMap.get(depId);
            return depNode && depNode.status !== 'done' && depNode.status !== 'archived';
          }).length;

          orderedItems.push({
            id: item.id,
            decision: item.decision,
            status: item.status,
            priority: item.priority,
            tags: item.tags,
            isBlocked: blockerCount > 0,
            blockerCount,
            order: orderPosition++,
          });
        }
      }

      // Sort by: unblocked first, then by priority, then by order
      orderedItems.sort((a, b) => {
        // Unblocked items first
        if (a.isBlocked !== b.isBlocked) {
          return a.isBlocked ? 1 : -1;
        }
        // Then by priority (high > medium > low)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff =
          (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1);
        if (priorityDiff !== 0) return priorityDiff;
        // Then by resolution order
        return a.order - b.order;
      });

      // Re-assign order after sorting
      orderedItems.forEach((item, idx) => {
        item.order = idx + 1;
      });

      // Apply limit
      let resultOrder = orderedItems;
      if (input.limit && input.limit > 0) {
        resultOrder = orderedItems.slice(0, input.limit);
      }

      // Get stats if requested
      let stats: ResolutionStats | undefined;
      if (input.includeStats) {
        const graphStats = resolver.getStats();
        stats = {
          totalItems: graphStats.totalItems,
          itemsWithDependencies: graphStats.itemsWithDependencies,
          blockedItems: graphStats.blockedItems,
          maxDepth: graphStats.maxDepth,
        };
      }

      // Get next actions if requested
      let nextActions: NextAction[] | undefined;
      if (input.includeNextActions) {
        nextActions = this.getNextActions(
          orderedItems.filter((i) => !i.isBlocked),
          resolver,
          itemMap
        );
      }

      return {
        success: true,
        order: resultOrder,
        stats,
        nextActions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get recommended next actions
   */
  private getNextActions(
    unblockedItems: OrderedItem[],
    resolver: DependencyResolver,
    itemMap: Map<number, ItemProps>
  ): NextAction[] {
    // Sort by priority and impact (unblocks count)
    const withImpact = unblockedItems.map((item) => {
      const unblocks = resolver.getItemsUnblockedBy(item.id).length;
      return {
        id: item.id,
        decision: item.decision,
        priority: item.priority,
        unblocks,
        reason: this.getActionReason(item.priority, unblocks),
      };
    });

    // Sort: high priority first, then by unblocks count
    withImpact.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff =
        (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1);
      if (priorityDiff !== 0) return priorityDiff;
      return b.unblocks - a.unblocks;
    });

    // Return top 5 actions
    return withImpact.slice(0, 5);
  }

  /**
   * Generate reason for action recommendation
   */
  private getActionReason(priority: string, unblocks: number): string {
    const reasons: string[] = [];

    if (priority === 'high') {
      reasons.push('High priority');
    }

    if (unblocks > 0) {
      reasons.push(`Unblocks ${unblocks} item${unblocks > 1 ? 's' : ''}`);
    }

    if (reasons.length === 0) {
      reasons.push('Ready to start');
    }

    return reasons.join(', ');
  }
}
