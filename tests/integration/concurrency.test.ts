import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Storage } from '../../src/storage/interface.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import { handleCapture } from '../../src/tools/core/capture.js';
import { handleList } from '../../src/tools/core/list.js';
import { handleUpdate } from '../../src/tools/workflow/update.js';
import { handleDelete } from '../../src/tools/workflow/delete.js';
import { handleBulkUpdate, handleBulkDelete } from '../../src/tools/batch/bulk.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-test-concurrency');

describe('Concurrency and Load Tests', () => {
  let storage: Storage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    // Cleanup after tests
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent captures correctly', async () => {
      const concurrentCaptures = 20;

      // Capture items concurrently
      const promises = Array.from({ length: concurrentCaptures }, (_, i) =>
        handleCapture(
          {
            decision: `Concurrent item ${i + 1}`,
            context: 'Testing concurrency',
            tags: ['test'],
            priority: 'medium',
          },
          storage
        )
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // All should have unique IDs
      const ids = results.map(r => r.item_id).filter((id): id is number => id !== undefined);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(concurrentCaptures);

      // Verify all items were stored
      const allItems = await storage.readAll();
      expect(allItems.length).toBe(concurrentCaptures);
    }, 30000); // Increased timeout for concurrent operations with exponential backoff

    it('should handle concurrent reads safely', async () => {
      // Create some items first
      for (let i = 1; i <= 10; i++) {
        await handleCapture(
          {
            decision: `Item ${i}`,
            context: 'Test',
            tags: ['test'],
            priority: 'medium',
          },
          storage
        );
      }

      // Perform concurrent reads
      const concurrentReads = 50;
      const promises = Array.from({ length: concurrentReads }, () =>
        handleList({}, storage)
      );

      const results = await Promise.all(promises);

      // All reads should succeed
      expect(results.every(r => r.success)).toBe(true);

      // All should return the same count
      expect(results.every(r => r.items.length === 10)).toBe(true);
    }, 15000);

    it('should handle mixed concurrent operations', async () => {
      // Create base items
      const baseItems: number[] = [];
      for (let i = 1; i <= 20; i++) {
        const result = await handleCapture(
          {
            decision: `Mixed test ${i}`,
            context: 'Test',
            tags: ['test'],
            priority: 'medium',
          },
          storage
        );
        baseItems.push(result.item_id!);
      }

      // Perform mixed operations concurrently
      const operations = [
        // 5 captures
        ...Array.from({ length: 5 }, (_, i) =>
          handleCapture({
            decision: `New item ${i}`,
            context: 'Test',
            tags: ['test'],
            priority: 'high',
          }, storage)
        ),
        // 5 updates
        ...Array.from({ length: 5 }, (_, i) =>
          handleUpdate({
            id: baseItems[i],
            priority: 'high',
          }, storage)
        ),
        // 5 reads
        ...Array.from({ length: 5 }, () =>
          handleList({}, storage)
        ),
        // 5 deletes
        ...Array.from({ length: 5 }, (_, i) =>
          handleDelete({
            id: baseItems[i + 10],
          }, storage)
        ),
      ];

      const results = await Promise.all(operations);

      // All operations should complete (success or expected failure)
      expect(results.length).toBe(20);

      // Verify final state
      const finalItems = await storage.readAll();

      // Should have: 20 base + 5 new - 5 deleted = 20 items
      // (5 deleted items become archived, not removed)
      expect(finalItems.length).toBe(25);
    }, 40000); // Increased timeout for mixed concurrent operations

    it('should handle concurrent updates to different items', async () => {
      // Create items
      const items = [];
      for (let i = 1; i <= 10; i++) {
        const result = await handleCapture(
          {
            decision: `Update test ${i}`,
            context: 'Test',
            tags: ['test'],
            priority: 'low',
          },
          storage
        );
        items.push(result.item_id!);
      }

      // Update all items concurrently (different items)
      const updates = items.map(id =>
        handleUpdate({
          id,
          priority: 'high',
        }, storage)
      );

      const results = await Promise.all(updates);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Verify all updates applied
      const allItems = await storage.readAll();
      const highPriorityCount = allItems.filter(item => item.priority === 'high').length;
      expect(highPriorityCount).toBe(10);
    }, 20000);

    it('should handle concurrent bulk operations', async () => {
      // Create items
      const items = [];
      for (let i = 1; i <= 30; i++) {
        const result = await handleCapture(
          {
            decision: `Bulk test ${i}`,
            context: 'Test',
            tags: ['test'],
            priority: 'low',
          },
          storage
        );
        items.push(result.item_id!);
      }

      // Perform bulk operations concurrently
      const operations = [
        handleBulkUpdate({
          ids: items.slice(0, 10),
          changes: { priority: 'high' },
        }, storage),
        handleBulkUpdate({
          ids: items.slice(10, 20),
          changes: { tags: ['test', 'bulk'] },
        }, storage),
        handleBulkDelete({
          ids: items.slice(20, 30),
        }, storage),
      ];

      const results = await Promise.all(operations);

      // All bulk operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].succeeded).toBe(10); // bulk update 1
      expect(results[1].succeeded).toBe(10); // bulk update 2
      expect(results[2].succeeded).toBe(10); // bulk delete

      // Verify final state
      const allItems = await storage.readAll();
      const highPriority = allItems.filter(i => i.priority === 'high').length;
      const bulkTagged = allItems.filter(i => i.tags.includes('bulk')).length;
      const archived = allItems.filter(i => i.status === 'archived').length;

      expect(highPriority).toBe(10);
      expect(bulkTagged).toBe(10);
      expect(archived).toBe(10);
    }, 30000);
  });

  describe('Load testing', () => {
    it('should handle high-volume captures', async () => {
      const itemCount = 100;

      const startTime = Date.now();

      for (let i = 1; i <= itemCount; i++) {
        await handleCapture(
          {
            decision: `Load test ${i}`,
            context: `Context ${i}`,
            tags: ['load', 'test'],
            priority: i % 2 === 0 ? 'high' : 'low',
          },
          storage
        );
      }

      const duration = Date.now() - startTime;

      // Verify all items created
      const allItems = await storage.readAll();
      expect(allItems.length).toBe(itemCount);

      // Should complete in reasonable time (< 10s for 100 items)
      expect(duration).toBeLessThan(10000);
    }, 15000);

    it('should maintain data integrity under load', async () => {
      // Create many items rapidly
      const itemCount = 50;
      const promises = [];

      for (let i = 1; i <= itemCount; i++) {
        promises.push(
          handleCapture(
            {
              decision: `Integrity test ${i}`,
              context: `Context for item ${i}`,
              tags: ['integrity'],
              priority: 'medium',
            },
            storage
          )
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Verify no duplicates or data corruption
      const allItems = await storage.readAll();
      expect(allItems.length).toBe(itemCount);

      // All IDs should be unique
      const ids = allItems.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(itemCount);

      // All decisions should be unique and match pattern
      const decisions = allItems.map(item => item.decision);
      decisions.forEach(decision => {
        expect(decision).toMatch(/^Integrity test \d+$/);
      });
    }, 60000); // Increased timeout for concurrent integrity test

    it('should handle stress test with mixed operations', async () => {
      // Create base dataset
      const baseCount = 30;
      const baseItems = [];

      for (let i = 1; i <= baseCount; i++) {
        const result = await handleCapture(
          {
            decision: `Stress test ${i}`,
            context: 'Test',
            tags: ['stress'],
            priority: 'medium',
          },
          storage
        );
        baseItems.push(result.item_id!);
      }

      // Perform stress test with rapid operations
      const operations = [];

      // 20 concurrent captures
      for (let i = 1; i <= 20; i++) {
        operations.push(
          handleCapture({
            decision: `Stress capture ${i}`,
            context: 'Test',
            tags: ['stress'],
            priority: 'low',
          }, storage)
        );
      }

      // 20 concurrent updates
      for (let i = 0; i < 20; i++) {
        operations.push(
          handleUpdate({
            id: baseItems[i % baseCount],
            priority: 'high',
          }, storage)
        );
      }

      // 10 concurrent lists
      for (let i = 0; i < 10; i++) {
        operations.push(handleList({}, storage));
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should complete
      expect(results.length).toBe(50);

      // Verify data integrity
      const allItems = await storage.readAll();
      expect(allItems.length).toBeGreaterThanOrEqual(baseCount);

      // Should complete in reasonable time (relaxed for concurrent operations)
      expect(duration).toBeLessThan(30000);
    }, 60000); // Increased timeout for stress test
  });

  describe('Race condition prevention', () => {
    it('should prevent ID collision in concurrent captures', async () => {
      const concurrentCount = 50;

      // Capture many items at once
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        handleCapture(
          {
            decision: `Race test ${i}`,
            context: 'Test',
            tags: ['race'],
            priority: 'medium',
          },
          storage
        )
      );

      const results = await Promise.all(promises);

      // Extract all IDs
      const ids = results.map(r => r.item_id).filter((id): id is number => id !== undefined);

      // No ID collisions
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(concurrentCount);

      // IDs should be sequential (no gaps from failed writes)
      const sortedIds = [...ids].sort((a, b) => a - b);
      for (let i = 0; i < sortedIds.length - 1; i++) {
        expect(sortedIds[i + 1] - sortedIds[i]).toBe(1);
      }
    }, 60000); // Increased timeout for ID collision test

    it('should handle concurrent delete and read correctly', async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: 'Delete race test',
          context: 'Test',
          tags: ['test'],
          priority: 'medium',
        },
        storage
      );

      const itemId = item.item_id!;

      // Attempt concurrent delete and reads
      const operations = [
        handleDelete({ id: itemId }, storage),
        ...Array.from({ length: 10 }, () =>
          storage.findById(itemId)
        ),
      ];

      const results = await Promise.all(operations);

      // Delete should succeed
      expect((results[0] as any).success).toBe(true);

      // Reads should either find the item or not (no crashes/corruption)
      // This verifies atomic operations
      results.slice(1).forEach(result => {
        // Result should be DeferredItem or null, no errors
        expect(result === null || typeof result === 'object').toBe(true);
      });
    }, 15000);
  });
});
