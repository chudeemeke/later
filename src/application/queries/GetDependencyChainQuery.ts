/**
 * Get Dependency Chain Query
 *
 * Retrieves the full dependency chain for an item.
 * Shows what needs to be completed first and what would be unblocked.
 */

import { Item, ItemProps } from '../../domain/entities/Item.js';
import { Dependency, DependencyProps } from '../../domain/entities/Dependency.js';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { DependencyResolver } from '../../domain/services/DependencyResolver.js';

/**
 * Query input
 */
export interface GetDependencyChainInput {
  itemId: number;
  includeItemDetails?: boolean; // Include full item details in chain
  includeAllTypes?: boolean; // Include non-blocking dependencies
  includeDependents?: boolean; // Include items that depend on this item
  includeVisualization?: boolean; // Include ASCII visualization
}

/**
 * Chain information
 */
export interface ChainInfo {
  itemId: number;
  depth: number;
  path: number[]; // IDs in order from root to leaf
  totalBlockers: number;
}

/**
 * Item summary for chain display
 */
export interface ChainItemDetail {
  id: number;
  decision: string;
  status: string;
  priority: string;
}

/**
 * Dependency summary
 */
export interface DependencySummary {
  itemId: number;
  dependsOnId: number;
  type: string;
  dependsOnDecision?: string;
  dependsOnStatus?: string;
}

/**
 * Query result
 */
export interface GetDependencyChainResult {
  success: boolean;
  chain?: ChainInfo;
  chainDetails?: ChainItemDetail[];
  allDependencies?: DependencySummary[];
  wouldUnblock?: number[];
  visualization?: string;
  error?: string;
}

/**
 * Get Dependency Chain Query Handler
 */
export class GetDependencyChainQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetDependencyChainInput): Promise<GetDependencyChainResult> {
    try {
      // Validate input
      if (!input.itemId || input.itemId <= 0) {
        return {
          success: false,
          error: 'Valid item ID is required',
        };
      }

      // Get the item
      const item = await this.storage.getItem(input.itemId);
      if (!item) {
        return {
          success: false,
          error: `Item ${input.itemId} not found`,
        };
      }

      // Get all items and dependencies to build graph
      const allItems = await this.storage.listItems();
      const allDeps: DependencyProps[] = [];

      for (const i of allItems) {
        const deps = await this.storage.getDependencies(i.id);
        allDeps.push(...deps);
      }

      // Build dependency graph using resolver
      const resolver = new DependencyResolver();
      const items = allItems.map((p) => Item.fromProps(p));
      const dependencies = allDeps.map((p) =>
        Dependency.fromProps({
          ...p,
          createdAt: p.createdAt || new Date(),
        })
      );

      resolver.buildGraph(items, dependencies);

      // Get dependency chain
      const chainInfo = resolver.getDependencyChain(input.itemId);
      const chain: ChainInfo = {
        itemId: input.itemId,
        depth: chainInfo.depth,
        path: chainInfo.chain,
        totalBlockers: chainInfo.totalBlockers,
      };

      // Get chain details if requested
      let chainDetails: ChainItemDetail[] | undefined;
      if (input.includeItemDetails) {
        const itemMap = new Map(allItems.map((i) => [i.id, i]));
        chainDetails = chain.path.map((id) => {
          const i = itemMap.get(id);
          return {
            id,
            decision: i?.decision || 'Unknown',
            status: i?.status || 'unknown',
            priority: i?.priority || 'medium',
          };
        });
      }

      // Get all dependencies if requested (including non-blocking)
      let allDependencies: DependencySummary[] | undefined;
      if (input.includeAllTypes) {
        const itemDeps = await this.storage.getDependencies(input.itemId);
        const itemMap = new Map(allItems.map((i) => [i.id, i]));

        allDependencies = itemDeps.map((d) => {
          const dependsOn = itemMap.get(d.dependsOnId);
          return {
            itemId: d.itemId,
            dependsOnId: d.dependsOnId,
            type: d.type,
            dependsOnDecision: dependsOn?.decision,
            dependsOnStatus: dependsOn?.status,
          };
        });
      }

      // Get items that would be unblocked if requested
      let wouldUnblock: number[] | undefined;
      if (input.includeDependents) {
        wouldUnblock = resolver.getItemsUnblockedBy(input.itemId);
      }

      // Generate visualization if requested
      let visualization: string | undefined;
      if (input.includeVisualization) {
        visualization = this.generateVisualization(chain.path, allItems);
      }

      return {
        success: true,
        chain,
        chainDetails,
        allDependencies,
        wouldUnblock,
        visualization,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate ASCII visualization of dependency chain
   */
  private generateVisualization(path: number[], items: ItemProps[]): string {
    if (path.length === 0) {
      return 'No dependencies';
    }

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const lines: string[] = [];

    for (let i = 0; i < path.length; i++) {
      const id = path[i];
      const item = itemMap.get(id);
      const decision = item?.decision || `Item #${id}`;
      const status = item?.status || 'unknown';
      const statusIcon = this.getStatusIcon(status);

      const indent = '  '.repeat(i);
      const connector = i === 0 ? '' : '-> ';

      // Truncate decision to 40 chars
      const truncatedDecision =
        decision.length > 40 ? decision.substring(0, 37) + '...' : decision;

      lines.push(`${indent}${connector}[${statusIcon}] #${id}: ${truncatedDecision}`);
    }

    return lines.join('\n');
  }

  /**
   * Get status icon for visualization
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'done':
        return 'x'; // Completed
      case 'in_progress':
        return '~'; // In progress
      case 'pending':
        return ' '; // Pending
      case 'archived':
        return '-'; // Archived
      default:
        return '?';
    }
  }
}
