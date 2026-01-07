import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyResolver } from '../../../src/domain/services/DependencyResolver.js';
import { Item } from '../../../src/domain/entities/Item.js';
import { Dependency } from '../../../src/domain/entities/Dependency.js';

describe('DependencyResolver Service', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  // Helper to create items
  const createItem = (id: number, status: 'pending' | 'in-progress' | 'done' | 'archived' = 'pending') => {
    const item = Item.create(id, { decision: `Decision ${id}` });
    if (status === 'in-progress') item.start();
    if (status === 'done') item.complete();
    if (status === 'archived') {
      item.complete();
      item.archive();
    }
    return item;
  };

  // Helper to create dependency
  const createDep = (itemId: number, dependsOnId: number, type: 'blocks' | 'relates-to' = 'blocks') => {
    return Dependency.create({ itemId, dependsOnId, type });
  };

  describe('graph building', () => {
    it('should build graph from items and dependencies', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];

      resolver.buildGraph(items, deps);

      expect(resolver.getDependencies(2)).toEqual([1]);
      expect(resolver.getDependencies(3)).toEqual([2]);
      expect(resolver.getDependents(1)).toEqual([2]);
      expect(resolver.getDependents(2)).toEqual([3]);
    });

    it('should only include blocking dependencies', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1, 'relates-to')]; // Non-blocking

      resolver.buildGraph(items, deps);

      expect(resolver.getDependencies(2)).toEqual([]);
    });

    it('should handle items without dependencies', () => {
      const items = [createItem(1), createItem(2)];
      const deps: Dependency[] = [];

      resolver.buildGraph(items, deps);

      expect(resolver.getDependencies(1)).toEqual([]);
      expect(resolver.getDependencies(2)).toEqual([]);
    });
  });

  describe('cycle detection', () => {
    it('should detect self-dependency cycle', () => {
      const items = [createItem(1)];
      resolver.buildGraph(items, []);

      const result = resolver.wouldCreateCycle(1, 1);

      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toContain(1);
    });

    it('should detect direct cycle (A -> B -> A)', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1)]; // 2 depends on 1
      resolver.buildGraph(items, deps);

      // Adding 1 depends on 2 would create cycle
      const result = resolver.wouldCreateCycle(1, 2);

      expect(result.hasCycle).toBe(true);
    });

    it('should detect transitive cycle (A -> B -> C -> A)', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [
        createDep(2, 1), // 2 depends on 1
        createDep(3, 2), // 3 depends on 2
      ];
      resolver.buildGraph(items, deps);

      // Adding 1 depends on 3 would create cycle
      const result = resolver.wouldCreateCycle(1, 3);

      expect(result.hasCycle).toBe(true);
    });

    it('should allow valid dependency', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      // 3 depending on 2 is fine
      const result = resolver.wouldCreateCycle(3, 2);

      expect(result.hasCycle).toBe(false);
    });

    it('should return cycle path when cycle detected', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const result = resolver.wouldCreateCycle(1, 3);

      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();
      expect(result.cyclePath!.length).toBeGreaterThan(2);
    });
  });

  describe('blocked items', () => {
    it('should identify blocked items', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const blocked = resolver.getBlockedItems();

      expect(blocked.length).toBe(2);
      expect(blocked.map((b) => b.itemId)).toContain(2);
      expect(blocked.map((b) => b.itemId)).toContain(3);
    });

    it('should not include items blocked by completed dependencies', () => {
      const items = [createItem(1, 'done'), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      const blocked = resolver.getBlockedItems();

      expect(blocked.length).toBe(0);
    });

    it('should include transitive blockers', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const blocked = resolver.getBlockedItems();
      const item3Block = blocked.find((b) => b.itemId === 3);

      expect(item3Block?.transitiveBlockers).toContain(1);
      expect(item3Block?.transitiveBlockers).toContain(2);
    });

    it('should identify if item can be unblocked directly', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      const blocked = resolver.getBlockedItems();
      const item2Block = blocked.find((b) => b.itemId === 2);

      expect(item2Block?.canUnblock).toBe(true);
    });

    it('should identify if item cannot be unblocked directly', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const blocked = resolver.getBlockedItems();
      const item3Block = blocked.find((b) => b.itemId === 3);

      // Item 3 can't be unblocked directly because item 2 is also blocked
      expect(item3Block?.canUnblock).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should return true for blocked item', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      expect(resolver.isBlocked(2)).toBe(true);
    });

    it('should return false for unblocked item', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      expect(resolver.isBlocked(1)).toBe(false);
    });

    it('should return false when blocker is completed', () => {
      const items = [createItem(1, 'done'), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      expect(resolver.isBlocked(2)).toBe(false);
    });
  });

  describe('dependency chain', () => {
    it('should calculate chain depth', () => {
      const items = [createItem(1), createItem(2), createItem(3), createItem(4)];
      const deps = [createDep(2, 1), createDep(3, 2), createDep(4, 3)];
      resolver.buildGraph(items, deps);

      const chain = resolver.getDependencyChain(4);

      expect(chain.depth).toBe(3);
      expect(chain.totalBlockers).toBe(3);
    });

    it('should return chain path', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const chain = resolver.getDependencyChain(3);

      expect(chain.chain).toEqual([3, 2, 1]);
    });

    it('should handle item with no dependencies', () => {
      const items = [createItem(1)];
      resolver.buildGraph(items, []);

      const chain = resolver.getDependencyChain(1);

      expect(chain.depth).toBe(0);
      expect(chain.chain).toEqual([1]);
    });
  });

  describe('items unblocked by', () => {
    it('should identify items that would be unblocked', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 1)];
      resolver.buildGraph(items, deps);

      const unblocked = resolver.getItemsUnblockedBy(1);

      expect(unblocked).toContain(2);
      expect(unblocked).toContain(3);
    });

    it('should not include items with other blockers', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(3, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const unblockedBy1 = resolver.getItemsUnblockedBy(1);
      const unblockedBy2 = resolver.getItemsUnblockedBy(2);

      // Item 3 won't be unblocked by either alone
      expect(unblockedBy1).not.toContain(3);
      expect(unblockedBy2).not.toContain(3);
    });
  });

  describe('resolution order', () => {
    it('should return topological order', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const order = resolver.getResolutionOrder();

      // 1 should come before 2, 2 should come before 3
      expect(order.indexOf(1)).toBeLessThan(order.indexOf(2));
      expect(order.indexOf(2)).toBeLessThan(order.indexOf(3));
    });

    it('should exclude completed items', () => {
      const items = [createItem(1, 'done'), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      const order = resolver.getResolutionOrder();

      expect(order).not.toContain(1);
      expect(order).toContain(2);
    });
  });

  describe('statistics', () => {
    it('should calculate graph statistics', () => {
      const items = [createItem(1), createItem(2), createItem(3)];
      const deps = [createDep(2, 1), createDep(3, 2)];
      resolver.buildGraph(items, deps);

      const stats = resolver.getStats();

      expect(stats.totalItems).toBe(3);
      expect(stats.itemsWithDependencies).toBe(2);
      expect(stats.blockedItems).toBe(2);
      expect(stats.maxDepth).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear the graph', () => {
      const items = [createItem(1), createItem(2)];
      const deps = [createDep(2, 1)];
      resolver.buildGraph(items, deps);

      resolver.clear();

      expect(resolver.getDependencies(1)).toEqual([]);
      expect(resolver.getDependents(1)).toEqual([]);
    });
  });
});
