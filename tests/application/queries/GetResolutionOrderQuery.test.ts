/**
 * Get Resolution Order Query Tests
 *
 * TDD tests for retrieving the optimal order to resolve/complete items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GetResolutionOrderQuery,
} from '../../../src/application/queries/GetResolutionOrderQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';
import { DependencyProps } from '../../../src/domain/entities/Dependency.js';

describe('GetResolutionOrderQuery', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let query: GetResolutionOrderQuery;

  const createMockItem = (overrides: Partial<ItemProps> = {}): ItemProps => ({
    id: 1,
    decision: 'Test decision',
    context: 'Test context',
    status: 'pending',
    priority: 'medium',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockDependency = (overrides: Partial<DependencyProps> = {}): DependencyProps => ({
    itemId: 1,
    dependsOnId: 2,
    type: 'blocks',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockStorage = {
      initialize: jest.fn(),
      close: jest.fn(),
      getItem: jest.fn(),
      createItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      listItems: jest.fn(),
      countItems: jest.fn(),
      searchItems: jest.fn(),
      getDependencies: jest.fn(),
      createDependency: jest.fn(),
      deleteDependency: jest.fn(),
      getDependents: jest.fn(),
      wouldCreateCycle: jest.fn(),
      getRetrospective: jest.fn(),
      createRetrospective: jest.fn(),
      updateRetrospective: jest.fn(),
      listRetrospectives: jest.fn(),
      getReminder: jest.fn(),
      createReminder: jest.fn(),
      updateReminder: jest.fn(),
      deleteReminder: jest.fn(),
      listReminders: jest.fn(),
      getRemindersForItem: jest.fn(),
      getDueReminders: jest.fn(),
      getGitLink: jest.fn(),
      createGitLink: jest.fn(),
      deleteGitLink: jest.fn(),
      listGitLinks: jest.fn(),
      getGitLinksForItem: jest.fn(),
      exportToJsonl: jest.fn(),
      importFromJsonl: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    query = new GetResolutionOrderQuery(mockStorage);
  });

  describe('basic resolution order', () => {
    it('should return all pending items in order when no dependencies', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });

      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.length).toBe(2);
    });

    it('should return dependencies before dependents', async () => {
      // Item 1 depends on Item 2, so Item 2 should come first
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({});

      expect(result.success).toBe(true);
      const idx1 = result.order!.findIndex((i) => i.id === 1);
      const idx2 = result.order!.findIndex((i) => i.id === 2);
      expect(idx2).toBeLessThan(idx1); // Item 2 comes before Item 1
    });

    it('should handle complex dependency chains', async () => {
      // Item 1 -> Item 2 -> Item 3
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const item3 = createMockItem({ id: 3, decision: 'Item 3' });
      const dep1to2 = createMockDependency({ itemId: 1, dependsOnId: 2 });
      const dep2to3 = createMockDependency({ itemId: 2, dependsOnId: 3 });

      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep1to2];
        if (id === 2) return [dep2to3];
        return [];
      });

      const result = await query.execute({});

      expect(result.success).toBe(true);
      const idx1 = result.order!.findIndex((i) => i.id === 1);
      const idx2 = result.order!.findIndex((i) => i.id === 2);
      const idx3 = result.order!.findIndex((i) => i.id === 3);
      // Order should be: 3, 2, 1
      expect(idx3).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx1);
    });
  });

  describe('filtering options', () => {
    it('should exclude completed items', async () => {
      const pending = createMockItem({ id: 1, status: 'pending' });
      const done = createMockItem({ id: 2, status: 'done' });

      mockStorage.listItems.mockResolvedValue([pending, done]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(1);
      expect(result.order![0].id).toBe(1);
    });

    it('should include completed items when requested', async () => {
      const pending = createMockItem({ id: 1, status: 'pending' });
      const done = createMockItem({ id: 2, status: 'done' });

      mockStorage.listItems.mockResolvedValue([pending, done]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ includeCompleted: true });

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(2);
    });

    it('should filter by priority', async () => {
      const high = createMockItem({ id: 1, priority: 'high' });
      const low = createMockItem({ id: 2, priority: 'low' });

      mockStorage.listItems.mockResolvedValue([high, low]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ priorityFilter: ['high'] });

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(1);
      expect(result.order![0].id).toBe(1);
    });

    it('should filter by tags', async () => {
      const item1 = createMockItem({ id: 1, tags: ['feature'] });
      const item2 = createMockItem({ id: 2, tags: ['bug'] });

      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ tagFilter: ['feature'] });

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(1);
      expect(result.order![0].id).toBe(1);
    });

    it('should limit results', async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createMockItem({ id: i + 1 })
      );

      mockStorage.listItems.mockResolvedValue(items);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ limit: 5 });

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(5);
    });
  });

  describe('statistics', () => {
    it('should include statistics when requested', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({ includeStats: true });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats!.totalItems).toBe(2);
      expect(result.stats!.itemsWithDependencies).toBe(1);
    });
  });

  describe('next action suggestion', () => {
    it('should identify unblocked items that can be started immediately', async () => {
      // Item 1 is blocked by Item 2, Item 2 is not blocked
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({ includeNextActions: true });

      expect(result.success).toBe(true);
      expect(result.nextActions).toBeDefined();
      // Item 2 should be in next actions (not blocked)
      expect(result.nextActions!.some((a) => a.id === 2)).toBe(true);
    });

    it('should prioritize high priority unblocked items', async () => {
      const highPriority = createMockItem({ id: 1, priority: 'high' });
      const lowPriority = createMockItem({ id: 2, priority: 'low' });

      mockStorage.listItems.mockResolvedValue([highPriority, lowPriority]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ includeNextActions: true });

      expect(result.success).toBe(true);
      expect(result.nextActions![0].id).toBe(1); // High priority first
    });
  });

  describe('error handling', () => {
    it('should handle empty item list', async () => {
      mockStorage.listItems.mockResolvedValue([]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.order!.length).toBe(0);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.listItems.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('ordering heuristics', () => {
    it('should use priority as secondary sort when depths are equal', async () => {
      // Both items have no dependencies, so priority should determine order
      const high = createMockItem({ id: 1, priority: 'high' });
      const low = createMockItem({ id: 2, priority: 'low' });

      mockStorage.listItems.mockResolvedValue([low, high]); // Intentionally reversed
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      // High priority should come first regardless of input order
      const idxHigh = result.order!.findIndex((i) => i.id === 1);
      const idxLow = result.order!.findIndex((i) => i.id === 2);
      expect(idxHigh).toBeLessThan(idxLow);
    });
  });
});
