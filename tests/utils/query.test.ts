import { describe, it, expect } from '@jest/globals';
import {
  applyFilters,
  applySorting,
  paginateResults,
  encodeCursor,
  decodeCursor,
} from '../../src/utils/query.js';
import type { DeferredItem, AdvancedFilters, SortOptions, PaginationArgs } from '../../src/types.js';

describe('Query Utils', () => {
  const createItem = (overrides: Partial<DeferredItem> = {}): DeferredItem => ({
    id: 1,
    decision: 'Test decision',
    context: 'Test context',
    status: 'pending',
    tags: [],
    priority: 'medium',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  describe('applyFilters', () => {
    describe('equality filters', () => {
      it('should filter by status equals', () => {
        const items = [
          createItem({ id: 1, status: 'pending' }),
          createItem({ id: 2, status: 'done' }),
          createItem({ id: 3, status: 'pending' }),
        ];

        const filters: AdvancedFilters = {
          status: { eq: 'pending' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe(1);
        expect(result[1].id).toBe(3);
      });

      it('should filter by priority equals', () => {
        const items = [
          createItem({ id: 1, priority: 'high' }),
          createItem({ id: 2, priority: 'low' }),
          createItem({ id: 3, priority: 'high' }),
        ];

        const filters: AdvancedFilters = {
          priority: { eq: 'high' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 3]);
      });
    });

    describe('inequality filters', () => {
      it('should filter by status not equals', () => {
        const items = [
          createItem({ id: 1, status: 'pending' }),
          createItem({ id: 2, status: 'done' }),
          createItem({ id: 3, status: 'archived' }),
        ];

        const filters: AdvancedFilters = {
          status: { ne: 'done' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.status)).toEqual(['pending', 'archived']);
      });
    });

    describe('in filter', () => {
      it('should filter by status in array', () => {
        const items = [
          createItem({ id: 1, status: 'pending' }),
          createItem({ id: 2, status: 'done' }),
          createItem({ id: 3, status: 'in-progress' }),
          createItem({ id: 4, status: 'archived' }),
        ];

        const filters: AdvancedFilters = {
          status: { in: ['pending', 'done'] },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 2]);
      });
    });

    describe('string filters', () => {
      it('should filter by contains (case-insensitive)', () => {
        const items = [
          createItem({ id: 1, decision: 'Optimize database' }),
          createItem({ id: 2, decision: 'Fix UI bug' }),
          createItem({ id: 3, decision: 'Database migration' }),
        ];

        const filters: AdvancedFilters = {
          decision: { contains: 'database' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 3]);
      });

      it('should filter by startsWith', () => {
        const items = [
          createItem({ id: 1, decision: 'Optimize database' }),
          createItem({ id: 2, decision: 'Fix UI bug' }),
          createItem({ id: 3, decision: 'Optimize performance' }),
        ];

        const filters: AdvancedFilters = {
          decision: { startsWith: 'Optimize' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 3]);
      });

      it('should filter by endsWith', () => {
        const items = [
          createItem({ id: 1, decision: 'Fix the bug' }),
          createItem({ id: 2, decision: 'Resolve issue' }),
          createItem({ id: 3, decision: 'Another bug' }),
        ];

        const filters: AdvancedFilters = {
          decision: { endsWith: 'bug' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 3]);
      });
    });

    describe('range filters', () => {
      it('should filter by id greater than or equal', () => {
        const items = [
          createItem({ id: 1 }),
          createItem({ id: 5 }),
          createItem({ id: 10 }),
        ];

        const filters: AdvancedFilters = {
          // @ts-expect-error - id filtering not in type but supported
          id: { gte: 5 },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([5, 10]);
      });

      it('should filter by id less than or equal', () => {
        const items = [
          createItem({ id: 1 }),
          createItem({ id: 5 }),
          createItem({ id: 10 }),
        ];

        const filters: AdvancedFilters = {
          // @ts-expect-error - id filtering not in type but supported
          id: { lte: 5 },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 5]);
      });

      it('should filter by range (gte and lte)', () => {
        const items = [
          createItem({ id: 1 }),
          createItem({ id: 5 }),
          createItem({ id: 10 }),
          createItem({ id: 15 }),
        ];

        const filters: AdvancedFilters = {
          // @ts-expect-error - id filtering not in type but supported
          id: { gte: 5, lte: 10 },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([5, 10]);
      });
    });

    describe('tag filters', () => {
      it('should filter by hasTag', () => {
        const items = [
          createItem({ id: 1, tags: ['urgent', 'bug'] }),
          createItem({ id: 2, tags: ['feature'] }),
          createItem({ id: 3, tags: ['urgent', 'refactor'] }),
        ];

        const filters: AdvancedFilters = {
          tags: { hasTag: 'urgent' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(2);
        expect(result.map(i => i.id)).toEqual([1, 3]);
      });
    });

    describe('multiple filters', () => {
      it('should apply AND logic across multiple filters', () => {
        const items = [
          createItem({ id: 1, status: 'pending', priority: 'high' }),
          createItem({ id: 2, status: 'pending', priority: 'low' }),
          createItem({ id: 3, status: 'done', priority: 'high' }),
        ];

        const filters: AdvancedFilters = {
          status: { eq: 'pending' },
          priority: { eq: 'high' },
        };

        const result = applyFilters(items, filters);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe(1);
      });
    });
  });

  describe('applySorting', () => {
    it('should sort by created_at ascending', () => {
      const items = [
        createItem({ id: 1, created_at: '2025-01-03T00:00:00Z' }),
        createItem({ id: 2, created_at: '2025-01-01T00:00:00Z' }),
        createItem({ id: 3, created_at: '2025-01-02T00:00:00Z' }),
      ];

      const sort: SortOptions[] = [{ field: 'created_at', direction: 'ASC' }];

      const result = applySorting(items, sort);

      expect(result.map(i => i.id)).toEqual([2, 3, 1]);
    });

    it('should sort by created_at descending', () => {
      const items = [
        createItem({ id: 1, created_at: '2025-01-01T00:00:00Z' }),
        createItem({ id: 2, created_at: '2025-01-03T00:00:00Z' }),
        createItem({ id: 3, created_at: '2025-01-02T00:00:00Z' }),
      ];

      const sort: SortOptions[] = [{ field: 'created_at', direction: 'DESC' }];

      const result = applySorting(items, sort);

      expect(result.map(i => i.id)).toEqual([2, 3, 1]);
    });

    it('should sort by priority with custom order', () => {
      const items = [
        createItem({ id: 1, priority: 'low' }),
        createItem({ id: 2, priority: 'high' }),
        createItem({ id: 3, priority: 'medium' }),
      ];

      const sort: SortOptions[] = [{ field: 'priority', direction: 'DESC' }];

      const result = applySorting(items, sort);

      // high > medium > low
      expect(result.map(i => i.priority)).toEqual(['high', 'medium', 'low']);
    });

    it('should support multi-field sorting', () => {
      const items = [
        createItem({ id: 1, priority: 'high', created_at: '2025-01-02T00:00:00Z' }),
        createItem({ id: 2, priority: 'high', created_at: '2025-01-01T00:00:00Z' }),
        createItem({ id: 3, priority: 'low', created_at: '2025-01-03T00:00:00Z' }),
      ];

      const sort: SortOptions[] = [
        { field: 'priority', direction: 'DESC' },
        { field: 'created_at', direction: 'ASC' },
      ];

      const result = applySorting(items, sort);

      // Sort by priority (high first), then by created_at ascending
      expect(result.map(i => i.id)).toEqual([2, 1, 3]);
    });
  });

  describe('paginateResults', () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      createItem({ id: i + 1 })
    );

    describe('forward pagination', () => {
      it('should return first N items', () => {
        const args: PaginationArgs = { first: 10 };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(10);
        expect(result.items[0].id).toBe(1);
        expect(result.items[9].id).toBe(10);
        expect(result.pageInfo.hasNextPage).toBe(true);
        expect(result.pageInfo.hasPrevPage).toBe(false);
      });

      it('should handle after cursor', () => {
        const cursor = encodeCursor(5);
        const args: PaginationArgs = { first: 10, after: cursor };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(10);
        expect(result.items[0].id).toBe(6);
        expect(result.items[9].id).toBe(15);
      });

      it('should set hasNextPage correctly at end', () => {
        const cursor = encodeCursor(45);
        const args: PaginationArgs = { first: 10, after: cursor };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(5); // Items 46-50
        expect(result.pageInfo.hasNextPage).toBe(false);
      });
    });

    describe('backward pagination', () => {
      it('should return last N items', () => {
        const args: PaginationArgs = { last: 10 };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(10);
        expect(result.items[0].id).toBe(41);
        expect(result.items[9].id).toBe(50);
        expect(result.pageInfo.hasPrevPage).toBe(true);
        expect(result.pageInfo.hasNextPage).toBe(false);
      });

      it('should handle before cursor', () => {
        const cursor = encodeCursor(25);
        const args: PaginationArgs = { last: 10, before: cursor };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(10);
        expect(result.items[0].id).toBe(15);
        expect(result.items[9].id).toBe(24);
      });

      it('should set hasPrevPage correctly at start', () => {
        const cursor = encodeCursor(5);
        const args: PaginationArgs = { last: 10, before: cursor };

        const result = paginateResults(items, args);

        expect(result.items.length).toBe(4);
        expect(result.pageInfo.hasPrevPage).toBe(false);
      });
    });

    describe('cursors', () => {
      it('should encode and decode cursors correctly', () => {
        const id = 42;
        const cursor = encodeCursor(id);
        const decoded = decodeCursor(cursor);

        expect(decoded).toBe(id);
      });

      it('should return null for invalid cursor', () => {
        const decoded = decodeCursor('invalid');

        expect(decoded).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle empty results', () => {
        const result = paginateResults([], { first: 10 });

        expect(result.items.length).toBe(0);
        expect(result.pageInfo.hasNextPage).toBe(false);
        expect(result.pageInfo.hasPrevPage).toBe(false);
        expect(result.pageInfo.startCursor).toBeNull();
        expect(result.pageInfo.endCursor).toBeNull();
      });

      it('should handle first exceeding total', () => {
        const result = paginateResults(items, { first: 100 });

        expect(result.items.length).toBe(50);
        expect(result.pageInfo.hasNextPage).toBe(false);
      });
    });
  });

  describe('decodeCursor edge cases', () => {
    it('should return null for invalid base64', () => {
      const result = decodeCursor('invalid!!!base64');

      expect(result).toBeNull();
    });

    it('should return null for non-numeric decoded value', () => {
      const encoded = Buffer.from('not-a-number').toString('base64');
      const result = decodeCursor(encoded);

      expect(result).toBeNull();
    });
  });

  describe('matchesFilter edge cases', () => {
    it('should return true for empty filter operator', () => {
      const items = [
        createItem({ id: 1, decision: 'Test' }),
      ];

      const filters: AdvancedFilters = {
        decision: {}, // Empty operator should match everything
      };

      const result = applyFilters(items, filters);

      expect(result.length).toBe(1);
    });
  });

  describe('applySorting with string fields', () => {
    it('should sort by string field (decision)', () => {
      const items = [
        createItem({ id: 1, decision: 'Zebra decision' }),
        createItem({ id: 2, decision: 'Apple decision' }),
        createItem({ id: 3, decision: 'Banana decision' }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'decision' as any, direction: 'ASC' },
      ];

      const result = applySorting(items, sortOptions);

      expect(result[0].decision).toBe('Apple decision');
      expect(result[1].decision).toBe('Banana decision');
      expect(result[2].decision).toBe('Zebra decision');
    });

    it('should sort by string field descending', () => {
      const items = [
        createItem({ id: 1, decision: 'Zebra decision' }),
        createItem({ id: 2, decision: 'Apple decision' }),
        createItem({ id: 3, decision: 'Banana decision' }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'decision' as any, direction: 'DESC' },
      ];

      const result = applySorting(items, sortOptions);

      expect(result[0].decision).toBe('Zebra decision');
      expect(result[1].decision).toBe('Banana decision');
      expect(result[2].decision).toBe('Apple decision');
    });
  });

  describe('applySorting with numeric fields', () => {
    it('should sort by id field ascending', () => {
      const items = [
        createItem({ id: 30 }),
        createItem({ id: 10 }),
        createItem({ id: 20 }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'id' as any, direction: 'ASC' },
      ];

      const result = applySorting(items, sortOptions);

      expect(result[0].id).toBe(10);
      expect(result[1].id).toBe(20);
      expect(result[2].id).toBe(30);
    });

    it('should sort by id field descending', () => {
      const items = [
        createItem({ id: 10 }),
        createItem({ id: 30 }),
        createItem({ id: 20 }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'id' as any, direction: 'DESC' },
      ];

      const result = applySorting(items, sortOptions);

      expect(result[0].id).toBe(30);
      expect(result[1].id).toBe(20);
      expect(result[2].id).toBe(10);
    });
  });

  describe('applySorting with status field', () => {
    it('should sort by status with custom order', () => {
      const items = [
        createItem({ id: 1, status: 'done' }),
        createItem({ id: 2, status: 'in-progress' }),
        createItem({ id: 3, status: 'pending' }),
        createItem({ id: 4, status: 'archived' }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'status', direction: 'DESC' },
      ];

      const result = applySorting(items, sortOptions);

      // in-progress > pending > done > archived
      expect(result[0].status).toBe('in-progress');
      expect(result[1].status).toBe('pending');
      expect(result[2].status).toBe('done');
      expect(result[3].status).toBe('archived');
    });
  });

  describe('applySorting with updated_at field', () => {
    it('should sort by updated_at ascending', () => {
      const items = [
        createItem({ id: 1, updated_at: '2025-01-03T00:00:00Z' }),
        createItem({ id: 2, updated_at: '2025-01-01T00:00:00Z' }),
        createItem({ id: 3, updated_at: '2025-01-02T00:00:00Z' }),
      ];

      const sortOptions: SortOptions[] = [
        { field: 'updated_at', direction: 'ASC' },
      ];

      const result = applySorting(items, sortOptions);

      expect(result.map(i => i.id)).toEqual([2, 3, 1]);
    });
  });

  describe('paginateResults with invalid cursors', () => {
    it('should handle invalid after cursor gracefully', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createItem({ id: i + 1 })
      );

      // Use an encoded cursor for ID that doesn't exist
      const invalidCursor = encodeCursor(999);
      const args: PaginationArgs = { first: 5, after: invalidCursor };

      const result = paginateResults(items, args);

      // Should return first 5 items since cursor not found
      expect(result.items.length).toBe(5);
      expect(result.items[0].id).toBe(1);
    });

    it('should handle invalid before cursor gracefully', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createItem({ id: i + 1 })
      );

      const invalidCursor = encodeCursor(999);
      const args: PaginationArgs = { last: 5, before: invalidCursor };

      const result = paginateResults(items, args);

      // Should return last 5 items since cursor not found
      expect(result.items.length).toBe(5);
    });
  });
});
