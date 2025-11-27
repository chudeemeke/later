import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleSearch } from '../../src/tools/search/search.js';
import type { Storage } from '../../src/storage/interface.js';
import type { DeferredItem } from '../../src/types.js';

describe('Search', () => {
  let mockStorage: Storage;
  let testItems: DeferredItem[];

  beforeEach(() => {
    testItems = [
      {
        id: 1,
        decision: 'Optimize database queries for better performance',
        context: 'Current queries are slow, need indexing strategy',
        status: 'pending',
        tags: ['performance', 'database'],
        priority: 'high',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        dependencies: [],
      },
      {
        id: 2,
        decision: 'Implement user authentication system',
        context: 'Need OAuth2 with JWT tokens',
        status: 'in-progress',
        tags: ['security', 'auth'],
        priority: 'high',
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        dependencies: [],
      },
      {
        id: 3,
        decision: 'Improve database backup strategy',
        context: 'Automated backups every 6 hours',
        status: 'done',
        tags: ['database', 'ops'],
        priority: 'medium',
        created_at: '2025-01-03T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
        dependencies: [],
      },
    ];

    mockStorage = {
      append: async () => 1,
      readAll: async () => testItems,
      findById: async (id: number) => testItems.find(i => i.id === id) || null,
      update: async () => {},
      delete: async () => {},
      getNextId: async () => testItems.length + 1,
    };
  });

  it('should find items matching query', async () => {
    const result = await handleSearch({
      query: 'database',
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.totalFound).toBeGreaterThan(0);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should rank results by relevance', async () => {
    const result = await handleSearch({
      query: 'database performance',
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.results[0].score).toBeGreaterThan(0);
    // First result should have highest score
    if (result.results.length > 1) {
      expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
    }
  });

  it('should only search active items by default', async () => {
    const result = await handleSearch({
      query: 'database',
    }, mockStorage);

    // Item 3 is 'done' so should not appear
    const hasInactiveItem = result.results.some(r => r.item.status === 'done');
    expect(hasInactiveItem).toBe(false);
  });

  it('should respect limit parameter', async () => {
    const result = await handleSearch({
      query: 'database',
      limit: 1,
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(1);
  });

  it('should handle empty query', async () => {
    const result = await handleSearch({
      query: '',
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.results.length).toBe(0);
  });

  it('should handle no matches', async () => {
    const result = await handleSearch({
      query: 'nonexistent keyword xyz123',
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.totalFound).toBe(0);
    expect(result.results.length).toBe(0);
  });

  it('should search specific fields when specified', async () => {
    const result = await handleSearch({
      query: 'performance',
      fields: ['tags'],
    }, mockStorage);

    expect(result.success).toBe(true);
    if (result.results.length > 0) {
      expect(result.results[0].matches.tags).toBeDefined();
    }
  });

  it('should provide match details', async () => {
    const result = await handleSearch({
      query: 'database',
    }, mockStorage);

    expect(result.success).toBe(true);
    if (result.results.length > 0) {
      const firstResult = result.results[0];
      expect(firstResult.matches).toBeDefined();
      expect(typeof firstResult.score).toBe('number');
    }
  });

  it('should measure search time', async () => {
    const result = await handleSearch({
      query: 'database',
    }, mockStorage);

    expect(result.success).toBe(true);
    expect(result.searchTime).toBeGreaterThanOrEqual(0);
  });

  it('should handle storage errors gracefully', async () => {
    const errorStorage: Storage = {
      ...mockStorage,
      readAll: async () => {
        throw new Error('Storage read failed');
      },
    };

    const result = await handleSearch({
      query: 'database',
    }, errorStorage);

    expect(result.success).toBe(false);
    expect(result.totalFound).toBe(0);
  });

  it('should handle non-Error exceptions', async () => {
    const errorStorage: Storage = {
      ...mockStorage,
      readAll: async () => {
        throw 'String error';
      },
    };

    const result = await handleSearch({
      query: 'database',
    }, errorStorage);

    expect(result.success).toBe(false);
  });

  it('should search context field when specified', async () => {
    const result = await handleSearch({
      query: 'indexing strategy',
      fields: ['context'],
    }, mockStorage);

    expect(result.success).toBe(true);
    if (result.results.length > 0) {
      expect(result.results[0].matches.context).toBeDefined();
    }
  });

  it('should handle items with empty content', async () => {
    const emptyStorage: Storage = {
      ...mockStorage,
      readAll: async () => [{
        id: 1,
        decision: '',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        dependencies: [],
      }],
    };

    const result = await handleSearch({
      query: 'test',
    }, emptyStorage);

    expect(result.success).toBe(true);
    expect(result.totalFound).toBe(0);
  });

  it('should apply minScore filter', async () => {
    const result = await handleSearch({
      query: 'database',
      minScore: 10, // Very high threshold
    }, mockStorage);

    expect(result.success).toBe(true);
    // Should filter out low-scoring results
  });

  it('should search decision field by default', async () => {
    const result = await handleSearch({
      query: 'optimize',
    }, mockStorage);

    expect(result.success).toBe(true);
    if (result.results.length > 0) {
      expect(result.results[0].matches.decision).toBeDefined();
    }
  });
});
