/**
 * Dependency Resolver Service
 *
 * Domain service for resolving dependency relationships.
 * Handles cycle detection, blocked item identification, and dependency graph analysis.
 */

import { Item } from '../entities/Item.js';
import { Dependency } from '../entities/Dependency.js';

/**
 * Result of cycle detection
 */
export interface CycleCheckResult {
  hasCycle: boolean;
  cyclePath?: number[]; // IDs forming the cycle
}

/**
 * Dependency graph node
 */
interface GraphNode {
  id: number;
  dependencies: number[];
  dependents: number[];
  status: string;
}

/**
 * Resolution result for blocked items
 */
export interface BlockedItemInfo {
  itemId: number;
  blockedBy: number[];
  transitiveBlockers: number[];
  canUnblock: boolean;
}

/**
 * Dependency chain analysis
 */
export interface DependencyChain {
  itemId: number;
  depth: number;
  chain: number[];
  totalBlockers: number;
}

/**
 * Dependency Resolver Service
 */
export class DependencyResolver {
  private graph: Map<number, GraphNode> = new Map();

  /**
   * Build dependency graph from items and dependencies
   */
  buildGraph(items: Item[], dependencies: Dependency[]): void {
    this.graph.clear();

    // Initialize nodes for all items
    for (const item of items) {
      this.graph.set(item.id.value, {
        id: item.id.value,
        dependencies: [],
        dependents: [],
        status: item.status.value,
      });
    }

    // Add dependency relationships (only blocking types)
    for (const dep of dependencies) {
      if (!dep.isBlocking()) continue;

      const node = this.graph.get(dep.itemId.value);
      const dependsOnNode = this.graph.get(dep.dependsOnId.value);

      if (node && dependsOnNode) {
        node.dependencies.push(dep.dependsOnId.value);
        dependsOnNode.dependents.push(dep.itemId.value);
      }
    }
  }

  /**
   * Check if adding a dependency would create a cycle
   * Uses DFS to detect cycles
   */
  wouldCreateCycle(fromId: number, toId: number): CycleCheckResult {
    // Self-dependency is always a cycle
    if (fromId === toId) {
      return { hasCycle: true, cyclePath: [fromId, toId] };
    }

    // Check if toId can reach fromId (would create cycle)
    const visited = new Set<number>();
    const path: number[] = [];

    const hasCycle = this.dfs(toId, fromId, visited, path);

    if (hasCycle) {
      return {
        hasCycle: true,
        cyclePath: [fromId, ...path.reverse(), fromId],
      };
    }

    return { hasCycle: false };
  }

  /**
   * DFS helper for cycle detection
   */
  private dfs(
    current: number,
    target: number,
    visited: Set<number>,
    path: number[]
  ): boolean {
    if (current === target) {
      path.push(current);
      return true;
    }

    if (visited.has(current)) {
      return false;
    }

    visited.add(current);
    path.push(current);

    const node = this.graph.get(current);
    if (!node) {
      path.pop();
      return false;
    }

    for (const depId of node.dependencies) {
      if (this.dfs(depId, target, visited, path)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  /**
   * Get all items that are blocked (have unresolved blocking dependencies)
   */
  getBlockedItems(): BlockedItemInfo[] {
    const blocked: BlockedItemInfo[] = [];

    for (const [id, node] of this.graph.entries()) {
      // Skip items that are already complete
      if (node.status === 'done' || node.status === 'archived') {
        continue;
      }

      const unresolvedBlockers = this.getUnresolvedBlockers(id);

      if (unresolvedBlockers.length > 0) {
        const transitiveBlockers = this.getTransitiveBlockers(id);
        blocked.push({
          itemId: id,
          blockedBy: unresolvedBlockers,
          transitiveBlockers,
          canUnblock: this.canBeUnblocked(id),
        });
      }
    }

    return blocked;
  }

  /**
   * Get direct unresolved blockers for an item
   */
  private getUnresolvedBlockers(itemId: number): number[] {
    const node = this.graph.get(itemId);
    if (!node) return [];

    return node.dependencies.filter((depId) => {
      const depNode = this.graph.get(depId);
      return depNode && depNode.status !== 'done' && depNode.status !== 'archived';
    });
  }

  /**
   * Get all transitive blockers (blockers of blockers)
   */
  private getTransitiveBlockers(itemId: number): number[] {
    const allBlockers = new Set<number>();
    const visited = new Set<number>();

    const traverse = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.graph.get(id);
      if (!node) return;

      for (const depId of node.dependencies) {
        const depNode = this.graph.get(depId);
        if (depNode && depNode.status !== 'done' && depNode.status !== 'archived') {
          allBlockers.add(depId);
          traverse(depId);
        }
      }
    };

    traverse(itemId);
    return Array.from(allBlockers);
  }

  /**
   * Check if an item can be unblocked by completing only its direct dependencies
   */
  private canBeUnblocked(itemId: number): boolean {
    const directBlockers = this.getUnresolvedBlockers(itemId);

    // Check if any direct blocker is itself blocked
    for (const blockerId of directBlockers) {
      const blockerBlockers = this.getUnresolvedBlockers(blockerId);
      if (blockerBlockers.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the dependency chain for an item (longest path to root)
   */
  getDependencyChain(itemId: number): DependencyChain {
    const visited = new Set<number>();
    const memo = new Map<number, { depth: number; chain: number[] }>();

    const findLongestChain = (id: number): { depth: number; chain: number[] } => {
      if (memo.has(id)) {
        return memo.get(id)!;
      }

      if (visited.has(id)) {
        return { depth: 0, chain: [] };
      }

      visited.add(id);

      const node = this.graph.get(id);
      if (!node || node.dependencies.length === 0) {
        return { depth: 0, chain: [id] };
      }

      let maxDepth = 0;
      let longestChain: number[] = [];

      for (const depId of node.dependencies) {
        const result = findLongestChain(depId);
        if (result.depth >= maxDepth) {
          maxDepth = result.depth + 1;
          longestChain = [id, ...result.chain];
        }
      }

      visited.delete(id);

      const result = { depth: maxDepth, chain: longestChain };
      memo.set(id, result);
      return result;
    };

    const result = findLongestChain(itemId);
    return {
      itemId,
      depth: result.depth,
      chain: result.chain,
      totalBlockers: this.getTransitiveBlockers(itemId).length,
    };
  }

  /**
   * Get items that would be unblocked if specified item is completed
   */
  getItemsUnblockedBy(itemId: number): number[] {
    const node = this.graph.get(itemId);
    if (!node) return [];

    const wouldUnblock: number[] = [];

    for (const dependentId of node.dependents) {
      const dependentNode = this.graph.get(dependentId);
      if (!dependentNode) continue;

      // Skip already completed items
      if (dependentNode.status === 'done' || dependentNode.status === 'archived') {
        continue;
      }

      // Check if this is the only unresolved blocker
      const unresolvedBlockers = this.getUnresolvedBlockers(dependentId);
      if (unresolvedBlockers.length === 1 && unresolvedBlockers[0] === itemId) {
        wouldUnblock.push(dependentId);
      }
    }

    return wouldUnblock;
  }

  /**
   * Get topological order for resolving dependencies
   * Returns items in order they should be completed
   */
  getResolutionOrder(): number[] {
    const visited = new Set<number>();
    const order: number[] = [];

    const visit = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.graph.get(id);
      if (!node) return;

      // Visit dependencies first
      for (const depId of node.dependencies) {
        visit(depId);
      }

      // Only include non-complete items
      if (node.status !== 'done' && node.status !== 'archived') {
        order.push(id);
      }
    };

    for (const id of this.graph.keys()) {
      visit(id);
    }

    return order;
  }

  /**
   * Check if an item is directly blocked
   */
  isBlocked(itemId: number): boolean {
    return this.getUnresolvedBlockers(itemId).length > 0;
  }

  /**
   * Get all dependencies for an item (direct only)
   */
  getDependencies(itemId: number): number[] {
    const node = this.graph.get(itemId);
    return node ? [...node.dependencies] : [];
  }

  /**
   * Get all dependents for an item (direct only)
   */
  getDependents(itemId: number): number[] {
    const node = this.graph.get(itemId);
    return node ? [...node.dependents] : [];
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalItems: number;
    itemsWithDependencies: number;
    blockedItems: number;
    maxDepth: number;
    hasCycles: boolean;
  } {
    let itemsWithDeps = 0;
    let blockedCount = 0;
    let maxDepth = 0;

    for (const [id, node] of this.graph.entries()) {
      if (node.dependencies.length > 0) {
        itemsWithDeps++;
      }

      if (node.status !== 'done' && node.status !== 'archived') {
        const unresolvedBlockers = this.getUnresolvedBlockers(id);
        if (unresolvedBlockers.length > 0) {
          blockedCount++;
        }

        const chain = this.getDependencyChain(id);
        maxDepth = Math.max(maxDepth, chain.depth);
      }
    }

    return {
      totalItems: this.graph.size,
      itemsWithDependencies: itemsWithDeps,
      blockedItems: blockedCount,
      maxDepth,
      hasCycles: false, // Would have been caught during graph building
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.graph.clear();
  }
}
