import { handleList } from '../../src/tools/core/list.js';
import type { ListArgs, DeferredItem } from '../../src/types.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-list-test');

describe('later_list Tool', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    // Clean test directory with retry logic for Windows file handle release
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
        break;
      } catch (error: unknown) {
        const isRetryable =
          error instanceof Error &&
          'code' in error &&
          (error.code === 'ENOTEMPTY' || error.code === 'EBUSY');
        if (isRetryable && attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        // Ignore cleanup errors on final attempt
      }
    }
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new JSONLStorage(TEST_DIR);
  }, 30000); // Increased timeout for Windows/WSL I/O

  afterEach(async () => {
    // Cleanup with retry logic for Windows
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
        break;
      } catch (error: unknown) {
        const isRetryable =
          error instanceof Error &&
          'code' in error &&
          (error.code === 'ENOTEMPTY' || error.code === 'EBUSY');
        if (isRetryable && attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
      }
    }
  }, 30000); // Increased timeout for Windows/WSL cleanup

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
    }, 30000); // Increased timeout for Windows/WSL I/O

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
    }, 30000); // Increased timeout for Windows/WSL I/O

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
    }, 30000); // Increased timeout for Windows/WSL I/O

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
    }, 30000); // Increased timeout for Windows/WSL I/O

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
    }, 30000); // Increased timeout for Windows/WSL I/O

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

    test('handles non-Error exceptions', async () => {
      const brokenStorage = {
        readAll: async () => {
          throw 'String error'; // Non-Error exception
        },
      } as any;

      const result = await handleList({}, brokenStorage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
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

    test('shows relative time in hours for items created hours ago', async () => {
      // Create item 3 hours ago
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      await storage.append({
        id: 1,
        decision: 'Hours ago item',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: threeHoursAgo,
        updated_at: threeHoursAgo,
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toContain('3h ago');
    });

    test('shows relative time in minutes for items created minutes ago', async () => {
      // Create item 15 minutes ago
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await storage.append({
        id: 1,
        decision: 'Minutes ago item',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: fifteenMinutesAgo,
        updated_at: fifteenMinutesAgo,
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toContain('m ago');
    });

    test('shows "just now" for items created seconds ago', async () => {
      // Create item just now (current time)
      const justNow = new Date().toISOString();
      await storage.append({
        id: 1,
        decision: 'Just now item',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: justNow,
        updated_at: justNow,
      });

      const result = await handleList({}, storage);

      expect(result.formatted_output).toContain('just now');
    });
  });

  describe('Phase 2: Advanced Features', () => {
    describe('advanced filtering', () => {
      beforeEach(async () => {
        await storage.append({
          id: 1,
          decision: 'Optimize database queries',
          context: '',
          status: 'pending',
          tags: ['performance'],
          priority: 'high',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        });

        await storage.append({
          id: 2,
          decision: 'Fix UI bug in dashboard',
          context: '',
          status: 'in-progress',
          tags: ['bug'],
          priority: 'medium',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        });

        await storage.append({
          id: 3,
          decision: 'Database migration script',
          context: '',
          status: 'done',
          tags: ['database'],
          priority: 'low',
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-03T00:00:00Z',
        });
      }, 30000); // Increased timeout for Windows/WSL I/O

      test('filters by equality operator', async () => {
        const result = await handleList({
          filters: {
            status: { eq: 'pending' },
          },
        }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });

      test('filters by contains operator', async () => {
        const result = await handleList({
          filters: {
            decision: { contains: 'database' },
          },
        }, storage);

        expect(result.items.length).toBe(2);
        expect(result.items.map(i => i.id)).toEqual([3, 1]); // DESC by created_at
      });

      test('filters by in operator', async () => {
        const result = await handleList({
          filters: {
            status: { in: ['pending', 'done'] },
          },
        }, storage);

        expect(result.items.length).toBe(2);
      });

      test('filters by hasTag operator', async () => {
        const result = await handleList({
          filters: {
            tags: { hasTag: 'bug' },
          },
        }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(2);
      });

      test('combines multiple filters with AND logic', async () => {
        const result = await handleList({
          filters: {
            priority: { ne: 'low' },
            decision: { contains: 'database' },
          },
        }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });
    });

    describe('sorting', () => {
      beforeEach(async () => {
        await storage.append({
          id: 1,
          decision: 'Item 1',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'low',
          created_at: '2025-01-03T00:00:00Z',
          updated_at: '2025-01-03T00:00:00Z',
        });

        await storage.append({
          id: 2,
          decision: 'Item 2',
          context: '',
          status: 'done',
          tags: [],
          priority: 'high',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        });

        await storage.append({
          id: 3,
          decision: 'Item 3',
          context: '',
          status: 'in-progress',
          tags: [],
          priority: 'medium',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        });
      }, 30000); // Increased timeout for Windows/WSL I/O

      test('sorts by created_at ascending', async () => {
        const result = await handleList({
          orderBy: [{ field: 'created_at', direction: 'ASC' }],
        }, storage);

        expect(result.items.map(i => i.id)).toEqual([2, 3, 1]);
      });

      test('sorts by priority descending', async () => {
        const result = await handleList({
          orderBy: [{ field: 'priority', direction: 'DESC' }],
        }, storage);

        expect(result.items[0].priority).toBe('high');
        expect(result.items[1].priority).toBe('medium');
        expect(result.items[2].priority).toBe('low');
      });

      test('sorts by multiple fields', async () => {
        const result = await handleList({
          orderBy: [
            { field: 'status', direction: 'DESC' },
            { field: 'created_at', direction: 'ASC' },
          ],
        }, storage);

        // Status order: in-progress > pending > done > archived
        expect(result.items[0].status).toBe('in-progress');
      });
    });

    describe('pagination', () => {
      beforeEach(async () => {
        // Create 20 items
        for (let i = 1; i <= 20; i++) {
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
      }, 30000); // Increased timeout for creating 20 items on Windows/WSL

      test('paginates with first parameter', async () => {
        const result = await handleList({
          pagination: { first: 5 },
        }, storage);

        expect(result.items.length).toBe(5);
        expect(result.pageInfo?.hasNextPage).toBe(true);
        expect(result.pageInfo?.hasPrevPage).toBe(false);
        expect(result.pageInfo?.totalCount).toBe(20);
      });

      test('paginates with after cursor', async () => {
        // Get first page
        const firstPage = await handleList({
          pagination: { first: 5 },
        }, storage);

        // Get second page using cursor
        const secondPage = await handleList({
          pagination: { first: 5, after: firstPage.pageInfo!.endCursor! },
        }, storage);

        expect(secondPage.items.length).toBe(5);
        expect(secondPage.pageInfo?.hasPrevPage).toBe(true);
        expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
      });

      test('paginates with last parameter', async () => {
        const result = await handleList({
          pagination: { last: 5 },
        }, storage);

        expect(result.items.length).toBe(5);
        expect(result.pageInfo?.hasNextPage).toBe(false);
        expect(result.pageInfo?.hasPrevPage).toBe(true);
      });

      test('includes pagination info in formatted output', async () => {
        const result = await handleList({
          pagination: { first: 5 },
        }, storage);

        expect(result.formatted_output).toContain('Showing 5 of 20 items');
        expect(result.formatted_output).toContain('(more available)');
      });
    });

    describe('backward compatibility', () => {
      beforeEach(async () => {
        await storage.append({
          id: 1,
          decision: 'Item 1',
          context: '',
          status: 'pending',
          tags: ['tag1'],
          priority: 'high',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        });

        await storage.append({
          id: 2,
          decision: 'Item 2',
          context: '',
          status: 'done',
          tags: ['tag2'],
          priority: 'low',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        });
      }, 30000); // Increased timeout for Windows/WSL I/O

      test('legacy status filter still works', async () => {
        const result = await handleList({ status: 'pending' }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });

      test('legacy priority filter still works', async () => {
        const result = await handleList({ priority: 'high' }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });

      test('legacy tags filter still works', async () => {
        const result = await handleList({ tags: ['tag1'] }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });

      test('legacy limit still works', async () => {
        const result = await handleList({ limit: 1 }, storage);

        expect(result.items.length).toBe(1);
      });

      test('can mix legacy and advanced filters', async () => {
        const result = await handleList({
          status: 'pending',
          filters: {
            priority: { eq: 'high' },
          },
        }, storage);

        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe(1);
      });
    });
  });
});
