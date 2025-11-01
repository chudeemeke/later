import { handleList } from '../../src/tools/list.js';
import type { ListArgs, DeferredItem } from '../../src/types.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-list-test');

describe('later_list Tool', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic listing', () => {
    test('returns empty list when no items exist', async () => {
      const result = await handleList({}, storage);

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.message).toContain('No items');
    });

    test('lists all items when no filters provided', async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'First item',
          context: 'Context 1',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: '2025-01-01T10:00:00Z',
          updated_at: '2025-01-01T10:00:00Z',
        },
        {
          id: 2,
          decision: 'Second item',
          context: 'Context 2',
          status: 'in-progress',
          tags: [],
          priority: 'high',
          created_at: '2025-01-02T10:00:00Z',
          updated_at: '2025-01-02T10:00:00Z',
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }

      const result = await handleList({}, storage);

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.total_count).toBe(2);
    });

    test('sorts items by created_at descending (newest first)', async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'Oldest',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: '2025-01-01T10:00:00Z',
          updated_at: '2025-01-01T10:00:00Z',
        },
        {
          id: 2,
          decision: 'Newest',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: '2025-01-03T10:00:00Z',
          updated_at: '2025-01-03T10:00:00Z',
        },
        {
          id: 3,
          decision: 'Middle',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: '2025-01-02T10:00:00Z',
          updated_at: '2025-01-02T10:00:00Z',
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }

      const result = await handleList({}, storage);

      expect(result.items[0].id).toBe(2); // Newest
      expect(result.items[1].id).toBe(3); // Middle
      expect(result.items[2].id).toBe(1); // Oldest
    });

    test('includes formatted output', async () => {
      await storage.append({
        id: 1,
        decision: 'Test item',
        context: 'Test context',
        status: 'pending',
        tags: ['test'],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toBeDefined();
      expect(result.formatted_output).toContain('Test item');
      expect(result.formatted_output).toContain('high');
    });
  });

  describe('filtering by status', () => {
    beforeEach(async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'Pending item',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'In progress item',
          context: '',
          status: 'in-progress',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          decision: 'Done item',
          context: '',
          status: 'done',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }
    });

    test('filters by pending status', async () => {
      const result = await handleList({ status: 'pending' }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('pending');
    });

    test('filters by in-progress status', async () => {
      const result = await handleList({ status: 'in-progress' }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('in-progress');
    });

    test('filters by done status', async () => {
      const result = await handleList({ status: 'done' }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('done');
    });
  });

  describe('filtering by tags', () => {
    beforeEach(async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'Item 1',
          context: '',
          status: 'pending',
          tags: ['refactoring', 'typescript'],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'Item 2',
          context: '',
          status: 'pending',
          tags: ['optimization'],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          decision: 'Item 3',
          context: '',
          status: 'pending',
          tags: ['refactoring', 'optimization'],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }
    });

    test('filters by single tag', async () => {
      const result = await handleList({ tags: ['typescript'] }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(1);
    });

    test('filters by multiple tags (OR logic)', async () => {
      const result = await handleList({ tags: ['refactoring', 'optimization'] }, storage);

      // Should return items with ANY of the tags
      expect(result.items.length).toBe(3);
    });

    test('returns empty when no items match tags', async () => {
      const result = await handleList({ tags: ['nonexistent'] }, storage);

      expect(result.items.length).toBe(0);
    });
  });

  describe('filtering by priority', () => {
    beforeEach(async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'Low priority',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'low',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'Medium priority',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          decision: 'High priority',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }
    });

    test('filters by low priority', async () => {
      const result = await handleList({ priority: 'low' }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].priority).toBe('low');
    });

    test('filters by high priority', async () => {
      const result = await handleList({ priority: 'high' }, storage);

      expect(result.items.length).toBe(1);
      expect(result.items[0].priority).toBe('high');
    });
  });

  describe('combined filters', () => {
    beforeEach(async () => {
      const items: DeferredItem[] = [
        {
          id: 1,
          decision: 'Item 1',
          context: '',
          status: 'pending',
          tags: ['refactoring'],
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'Item 2',
          context: '',
          status: 'pending',
          tags: ['refactoring'],
          priority: 'low',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          decision: 'Item 3',
          context: '',
          status: 'in-progress',
          tags: ['refactoring'],
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const item of items) {
        await storage.append(item);
      }
    });

    test('filters by status AND priority', async () => {
      const result = await handleList(
        { status: 'pending', priority: 'high' },
        storage
      );

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(1);
    });

    test('filters by status AND tags AND priority', async () => {
      const result = await handleList(
        { status: 'in-progress', tags: ['refactoring'], priority: 'high' },
        storage
      );

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(3);
    });
  });

  describe('limit parameter', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 10; i++) {
        await storage.append({
          id: i,
          decision: `Item ${i}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date(2025, 0, i).toISOString(),
          updated_at: new Date(2025, 0, i).toISOString(),
        });
      }
    });

    test('limits results when specified', async () => {
      const result = await handleList({ limit: 5 }, storage);

      expect(result.items.length).toBe(5);
      expect(result.total_count).toBe(10);
      expect(result.showing_count).toBe(5);
    });

    test('returns all items when limit exceeds count', async () => {
      const result = await handleList({ limit: 20 }, storage);

      expect(result.items.length).toBe(10);
      expect(result.total_count).toBe(10);
    });

    test('returns newest items when limited', async () => {
      const result = await handleList({ limit: 3 }, storage);

      // Should return items 10, 9, 8 (newest)
      expect(result.items[0].id).toBe(10);
      expect(result.items[1].id).toBe(9);
      expect(result.items[2].id).toBe(8);
    });
  });

  describe('error handling', () => {
    test('handles invalid status gracefully', async () => {
      const result = await handleList({ status: 'invalid-status' as any }, storage);

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    test('handles storage errors', async () => {
      const brokenStorage = {
        readAll: async () => {
          throw new Error('Storage error');
        },
      } as any;

      const result = await handleList({}, brokenStorage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('formatted output', () => {
    test('includes status icons', async () => {
      await storage.append({
        id: 1,
        decision: 'Pending',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toMatch(/⏸|📋|⏳/);
    });

    test('includes priority indicators', async () => {
      await storage.append({
        id: 1,
        decision: 'High priority',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toContain('high');
    });

    test('includes tags when present', async () => {
      await storage.append({
        id: 1,
        decision: 'Tagged item',
        context: '',
        status: 'pending',
        tags: ['tag1', 'tag2'],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toContain('tag1');
      expect(result.formatted_output).toContain('tag2');
    });
  });
});
