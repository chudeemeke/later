import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleBulkUpdate, handleBulkDelete } from '../../src/tools/bulk.js';
import type { Storage } from '../../src/storage/interface.js';
import type { DeferredItem } from '../../src/types.js';

describe('Bulk Operations', () => {
  let mockStorage: Storage;
  let testItems: DeferredItem[];

  beforeEach(() => {
    testItems = [
      {
        id: 1,
        decision: 'Item 1',
        context: 'Context 1',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        dependencies: [],
      },
      {
        id: 2,
        decision: 'Item 2',
        context: 'Context 2',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        dependencies: [],
      },
      {
        id: 3,
        decision: 'Item 3',
        context: 'Context 3',
        status: 'in-progress',
        tags: [],
        priority: 'low',
        created_at: '2025-01-03T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
        dependencies: [],
      },
    ];

    mockStorage = {
      append: async () => testItems.length + 1,
      readAll: async () => testItems,
      findById: async (id: number) => testItems.find(i => i.id === id) || null,
      update: async (item: DeferredItem) => {
        const index = testItems.findIndex(i => i.id === item.id);
        if (index !== -1) {
          testItems[index] = item;
        }
      },
      delete: async (id: number) => {
        testItems = testItems.filter(i => i.id !== id);
      },
      getNextId: async () => testItems.length + 1,
    };
  });

  describe('handleBulkUpdate', () => {
    it('should update multiple items successfully', async () => {
      const result = await handleBulkUpdate({
        ids: [1, 2],
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.processed).toEqual([1, 2]);
    });

    it('should update all specified fields', async () => {
      await handleBulkUpdate({
        ids: [1, 2],
        changes: {
          priority: 'high',
          tags: ['urgent', 'review'],
        },
      }, mockStorage);

      const item1 = testItems.find(i => i.id === 1);
      const item2 = testItems.find(i => i.id === 2);

      expect(item1?.priority).toBe('high');
      expect(item1?.tags).toEqual(['urgent', 'review']);
      expect(item2?.priority).toBe('high');
      expect(item2?.tags).toEqual(['urgent', 'review']);
    });

    it('should handle partial failures gracefully', async () => {
      const result = await handleBulkUpdate({
        ids: [1, 999, 2],  // 999 doesn't exist
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.succeeded).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.processed).toEqual([1, 2]);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].id).toBe(999);
    });

    it('should report errors for each failed item', async () => {
      const result = await handleBulkUpdate({
        ids: [998, 999],
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.failed.length).toBe(2);
      expect(result.failed[0].id).toBe(998);
      expect(result.failed[1].id).toBe(999);
      expect(result.failed[0].error).toBeTruthy();
      expect(result.failed[1].error).toBeTruthy();
    });

    it('should handle empty ID list', async () => {
      const result = await handleBulkUpdate({
        ids: [],
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
    });

    it('should update status transitions correctly', async () => {
      const result = await handleBulkUpdate({
        ids: [1, 2],
        changes: { status: 'in-progress' },
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(testItems.find(i => i.id === 1)?.status).toBe('in-progress');
      expect(testItems.find(i => i.id === 2)?.status).toBe('in-progress');
    });

    it('should handle invalid status transitions', async () => {
      // First set item to done
      await handleBulkUpdate({
        ids: [3],
        changes: { status: 'done' },
      }, mockStorage);

      // Try to move done item to pending (invalid)
      const result = await handleBulkUpdate({
        ids: [3],
        changes: { status: 'pending' },
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.failed.length).toBe(1);
    });

    it('should return correct summary statistics', async () => {
      const result = await handleBulkUpdate({
        ids: [1, 2, 3, 999],
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(3);
      expect(result.failedCount).toBe(1);
      expect(result.processed.length).toBe(3);
      expect(result.failed.length).toBe(1);
    });
  });

  describe('handleBulkDelete', () => {
    it('should delete multiple items (soft delete)', async () => {
      const result = await handleBulkDelete({
        ids: [1, 2],
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.processed).toEqual([1, 2]);
    });

    it('should perform hard delete when specified', async () => {
      const result = await handleBulkDelete({
        ids: [1, 2],
        hard: true,
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(2);
      // Verify items are actually gone
      expect(testItems.find(i => i.id === 1)).toBeUndefined();
      expect(testItems.find(i => i.id === 2)).toBeUndefined();
    });

    it('should handle partial failures gracefully', async () => {
      const result = await handleBulkDelete({
        ids: [1, 999, 2],
        hard: true,
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.succeeded).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0].id).toBe(999);
    });

    it('should handle non-existent items', async () => {
      const result = await handleBulkDelete({
        ids: [998, 999],
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.failed.length).toBe(2);
    });

    it('should handle empty ID list', async () => {
      const result = await handleBulkDelete({
        ids: [],
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
    });

    it('should delete all items in large batch', async () => {
      // Add more items
      for (let i = 4; i <= 20; i++) {
        testItems.push({
          id: i,
          decision: `Item ${i}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          dependencies: [],
        });
      }

      const ids = Array.from({ length: 20 }, (_, i) => i + 1);
      const result = await handleBulkDelete({
        ids,
        hard: true,
      }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.succeeded).toBe(20);
      expect(testItems.length).toBe(0);
    });

    it('should return correct summary statistics', async () => {
      const result = await handleBulkDelete({
        ids: [1, 2, 3, 999],
      }, mockStorage);

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(3);
      expect(result.failedCount).toBe(1);
      expect(result.processed.length).toBe(3);
      expect(result.failed.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors in bulk update', async () => {
      mockStorage.update = async () => {
        throw new Error('Storage error');
      };

      const result = await handleBulkUpdate({
        ids: [1, 2],
        changes: { priority: 'high' },
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.failed.length).toBe(2);
      expect(result.failed[0].error).toContain('Storage error');
    });

    it('should handle storage errors in bulk delete', async () => {
      mockStorage.delete = async () => {
        throw new Error('Storage error');
      };

      const result = await handleBulkDelete({
        ids: [1, 2],
        hard: true,
      }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.failed.length).toBe(2);
    });
  });
});
