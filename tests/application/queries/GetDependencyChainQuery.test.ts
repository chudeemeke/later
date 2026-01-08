/**
 * Get Dependency Chain Query Tests
 *
 * TDD tests for retrieving dependency chains for items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GetDependencyChainQuery,
} from '../../../src/application/queries/GetDependencyChainQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';
import { DependencyProps } from '../../../src/domain/entities/Dependency.js';

describe('GetDependencyChainQuery', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let query: GetDependencyChainQuery;

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

    query = new GetDependencyChainQuery(mockStorage);
  });

  describe('basic chain retrieval', () => {
    it('should return empty chain for item with no dependencies', async () => {
      const item = createMockItem({ id: 1 });

      mockStorage.getItem.mockResolvedValue(item);
      mockStorage.listItems.mockResolvedValue([item]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.chain).toBeDefined();
      expect(result.chain!.depth).toBe(0);
      expect(result.chain!.totalBlockers).toBe(0);
    });

    it('should return single-level chain for direct dependency', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.chain!.depth).toBe(1);
      expect(result.chain!.path).toContain(1);
      expect(result.chain!.path).toContain(2);
    });

    it('should return multi-level chain for transitive dependencies', async () => {
      // Item 1 -> Item 2 -> Item 3
      const item1 = createMockItem({ id: 1, decision: 'Item 1' });
      const item2 = createMockItem({ id: 2, decision: 'Item 2' });
      const item3 = createMockItem({ id: 3, decision: 'Item 3' });
      const dep1to2 = createMockDependency({ itemId: 1, dependsOnId: 2 });
      const dep2to3 = createMockDependency({ itemId: 2, dependsOnId: 3 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        if (id === 3) return item3;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep1to2];
        if (id === 2) return [dep2to3];
        return [];
      });

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.chain!.depth).toBe(2);
      expect(result.chain!.path).toEqual([1, 2, 3]);
    });
  });

  describe('chain with item details', () => {
    it('should include item details when requested', async () => {
      const item1 = createMockItem({ id: 1, decision: 'First item' });
      const item2 = createMockItem({ id: 2, decision: 'Second item', status: 'done' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({ itemId: 1, includeItemDetails: true });

      expect(result.success).toBe(true);
      expect(result.chainDetails).toBeDefined();
      expect(result.chainDetails!.length).toBe(2);
      expect(result.chainDetails![0].decision).toBe('First item');
      expect(result.chainDetails![1].decision).toBe('Second item');
      expect(result.chainDetails![1].status).toBe('done');
    });
  });

  describe('validation', () => {
    it('should fail with invalid item ID (zero)', async () => {
      const result = await query.execute({ itemId: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('item ID');
    });

    it('should fail with invalid item ID (negative)', async () => {
      const result = await query.execute({ itemId: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('item ID');
    });

    it('should fail when item does not exist', async () => {
      mockStorage.getItem.mockResolvedValue(null);

      const result = await query.execute({ itemId: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('blocking vs non-blocking dependencies', () => {
    it('should only include blocking dependencies by default', async () => {
      const item1 = createMockItem({ id: 1 });
      const item2 = createMockItem({ id: 2 });
      const item3 = createMockItem({ id: 3 });
      const blocksDep = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const relatesDep = createMockDependency({ itemId: 1, dependsOnId: 3, type: 'relates-to' });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        if (id === 3) return item3;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [blocksDep, relatesDep];
        return [];
      });

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // Should only include blocking dependency (item 2)
      expect(result.chain!.depth).toBe(1);
      expect(result.chain!.path).toContain(2);
      expect(result.chain!.path).not.toContain(3);
    });

    it('should include all dependency types when requested', async () => {
      const item1 = createMockItem({ id: 1 });
      const item2 = createMockItem({ id: 2 });
      const item3 = createMockItem({ id: 3 });
      const blocksDep = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const relatesDep = createMockDependency({ itemId: 1, dependsOnId: 3, type: 'relates-to' });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        if (id === 3) return item3;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [blocksDep, relatesDep];
        return [];
      });

      const result = await query.execute({ itemId: 1, includeAllTypes: true });

      expect(result.success).toBe(true);
      // Should include both dependencies
      expect(result.allDependencies).toBeDefined();
      expect(result.allDependencies!.length).toBe(2);
    });
  });

  describe('items that would be unblocked', () => {
    it('should identify items that would be unblocked if this item completes', async () => {
      const item1 = createMockItem({ id: 1, status: 'pending' }); // Target
      const item2 = createMockItem({ id: 2, status: 'pending' }); // Depends on item 1
      const dep = createMockDependency({ itemId: 2, dependsOnId: 1, type: 'blocks' });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 2) return [dep];
        return [];
      });
      mockStorage.getDependents.mockImplementation(async (id) => {
        if (id === 1) return [{ itemId: 2, dependsOnId: 1, type: 'blocks', createdAt: new Date() }];
        return [];
      });

      const result = await query.execute({ itemId: 1, includeDependents: true });

      expect(result.success).toBe(true);
      expect(result.wouldUnblock).toBeDefined();
      expect(result.wouldUnblock).toContain(2);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('visualization', () => {
    it('should return ASCII visualization when requested', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Task A' });
      const item2 = createMockItem({ id: 2, decision: 'Task B' });
      const dep = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dep];
        return [];
      });

      const result = await query.execute({ itemId: 1, includeVisualization: true });

      expect(result.success).toBe(true);
      expect(result.visualization).toBeDefined();
      expect(result.visualization).toContain('Task A');
      expect(result.visualization).toContain('Task B');
    });
  });
});
