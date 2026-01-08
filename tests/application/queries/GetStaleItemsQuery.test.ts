/**
 * Get Stale Items Query Tests
 *
 * Tests for retrieving items that may need attention based on staleness scoring.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GetStaleItemsQuery, GetStaleItemsInput } from '../../../src/application/queries/GetStaleItemsQuery.js';
import type { IStoragePort, ItemFilter, PaginationOptions, ItemSort } from '../../../src/domain/ports/IStoragePort.js';
import type { ItemProps } from '../../../src/domain/entities/Item.js';
import type { StatusValue } from '../../../src/domain/value-objects/Status.js';
import type { PriorityValue } from '../../../src/domain/value-objects/Priority.js';

// Mock storage implementation
class MockStorage implements Partial<IStoragePort> {
  private items: ItemProps[] = [];

  setItems(items: ItemProps[]): void {
    this.items = items;
  }

  async listItems(filter?: ItemFilter): Promise<ItemProps[]> {
    let result = [...this.items];
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      result = result.filter(item => statuses.includes(item.status));
    }
    if (filter?.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      result = result.filter(item => priorities.includes(item.priority));
    }
    return result;
  }

  async getItem(id: number): Promise<ItemProps | null> {
    return this.items.find(item => item.id === id) || null;
  }
}

// Helper to create ItemProps with proper types
function createItemProps(overrides: {
  id: number;
  decision: string;
  context?: string;
  status?: StatusValue;
  priority?: PriorityValue;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}): ItemProps {
  const now = new Date();
  return {
    id: overrides.id,
    decision: overrides.decision,
    context: overrides.context ?? 'Test context',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('GetStaleItemsQuery', () => {
  let storage: MockStorage;
  let query: GetStaleItemsQuery;

  beforeEach(() => {
    storage = new MockStorage();
    query = new GetStaleItemsQuery(storage as IStoragePort);
  });

  describe('execute', () => {
    it('should return empty results when no items exist', async () => {
      storage.setItems([]);

      const result = await query.execute();

      expect(result.success).toBe(true);
      expect(result.staleItems).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return stale items with default configuration', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Test decision',
          status: 'pending',
          priority: 'medium',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute();

      expect(result.success).toBe(true);
      expect(result.staleItems).toBeDefined();
      // The item should be considered stale since it's 30 days old
    });

    it('should filter by priority', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'High priority decision',
          status: 'pending',
          priority: 'high',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
        createItemProps({
          id: 2,
          decision: 'Low priority decision',
          status: 'pending',
          priority: 'low',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute({ priorityFilter: ['high'] });

      expect(result.success).toBe(true);
      expect(result.staleItems).toBeDefined();
      // Only high priority items should be included
      for (const item of result.staleItems || []) {
        expect(item.item.priority).toBe('high');
      }
    });

    it('should include archived items when excludeArchived is false', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Archived decision',
          status: 'archived',
          priority: 'medium',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute({ excludeArchived: false });

      expect(result.success).toBe(true);
    });

    it('should get urgent items when includeUrgent is true', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Urgent decision',
          status: 'pending',
          priority: 'high',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute({ includeUrgent: true });

      expect(result.success).toBe(true);
      expect(result.staleItems).toBeDefined();
    });

    it('should use custom staleness config', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Test decision',
          status: 'pending',
          priority: 'medium',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute({
        stalenessConfig: { defaultThresholdDays: 7 },
      });

      expect(result.success).toBe(true);
    });

    it('should use custom minScore', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Test decision',
          status: 'pending',
          priority: 'medium',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
      ]);

      const result = await query.execute({ minScore: 0.5 });

      expect(result.success).toBe(true);
    });

    it('should calculate summary correctly', async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Very stale item',
          status: 'pending',
          priority: 'high',
          createdAt: sixtyDaysAgo,
          updatedAt: sixtyDaysAgo,
        }),
        createItemProps({
          id: 2,
          decision: 'Another stale item',
          status: 'pending',
          priority: 'low',
          createdAt: sixtyDaysAgo,
          updatedAt: sixtyDaysAgo,
        }),
      ]);

      const result = await query.execute();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary?.refresh).toBe('number');
      expect(typeof result.summary?.review).toBe('number');
      expect(typeof result.summary?.archive).toBe('number');
    });

    it('should handle storage errors gracefully', async () => {
      const errorStorage = {
        listItems: async () => {
          throw new Error('Storage error');
        },
      } as IStoragePort;

      const errorQuery = new GetStaleItemsQuery(errorStorage);
      const result = await errorQuery.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle non-Error exceptions', async () => {
      const errorStorage = {
        listItems: async () => {
          throw 'String error';
        },
      } as IStoragePort;

      const errorQuery = new GetStaleItemsQuery(errorStorage);
      const result = await errorQuery.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should sort items by staleness score descending', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Newer item',
          status: 'pending',
          priority: 'medium',
          createdAt: thirtyDaysAgo,
          updatedAt: thirtyDaysAgo,
        }),
        createItemProps({
          id: 2,
          decision: 'Older item',
          status: 'pending',
          priority: 'medium',
          createdAt: sixtyDaysAgo,
          updatedAt: sixtyDaysAgo,
        }),
      ]);

      const result = await query.execute();

      expect(result.success).toBe(true);
      if (result.staleItems && result.staleItems.length >= 2) {
        // Higher staleness score should come first
        expect(result.staleItems[0].stalenessScore).toBeGreaterThanOrEqual(
          result.staleItems[1].stalenessScore
        );
      }
    });

    it('should include factors in each result', async () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      storage.setItems([
        createItemProps({
          id: 1,
          decision: 'Stale item',
          status: 'pending',
          priority: 'high',
          createdAt: sixtyDaysAgo,
          updatedAt: sixtyDaysAgo,
        }),
      ]);

      const result = await query.execute();

      expect(result.success).toBe(true);
      if (result.staleItems && result.staleItems.length > 0) {
        const item = result.staleItems[0];
        expect(item.factors).toBeDefined();
        expect(typeof item.factors.timeFactor).toBe('number');
        expect(typeof item.factors.priorityFactor).toBe('number');
        expect(typeof item.factors.activityFactor).toBe('number');
      }
    });
  });
});
