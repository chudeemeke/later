// @ts-nocheck - Jest mock typing incompatibility with @jest/globals
/**
 * ListItemsQuery Tests
 *
 * Tests the list items query handler with filtering, sorting, and pagination.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListItemsQuery, ListItemsInput } from '../../../src/application/queries/ListItemsQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';
import { DependencyProps } from '../../../src/domain/entities/Dependency.js';
import { RetrospectiveProps } from '../../../src/domain/entities/Retrospective.js';
import { ReminderProps } from '../../../src/domain/entities/Reminder.js';
import { GitLinkProps } from '../../../src/domain/entities/GitLink.js';

function createTestItems(count: number): ItemProps[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    decision: `Decision ${i + 1}`,
    context: `Context for item ${i + 1}`,
    status: i % 3 === 0 ? 'done' : i % 2 === 0 ? 'in-progress' : 'pending',
    tags: i % 2 === 0 ? ['even'] : ['odd'],
    priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
    createdAt: new Date(Date.now() - (count - i) * 86400000),
    updatedAt: new Date(Date.now() - (count - i) * 43200000),
  } as ItemProps));
}

function createMockStorage(items: ItemProps[] = []): IStoragePort {
  return {
    createItem: jest.fn().mockResolvedValue(items[0]),
    getItem: jest.fn().mockImplementation(async (id: number) => items.find(i => i.id === id) || null),
    getItems: jest.fn().mockImplementation(async (ids: number[]) => items.filter(i => ids.includes(i.id))),
    updateItem: jest.fn().mockResolvedValue(items[0]),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    listItems: jest.fn().mockImplementation(async (filter, sort, pagination) => {
      let result = [...items];

      // Apply filters
      if (filter?.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        result = result.filter(i => statuses.includes(i.status));
      }
      if (filter?.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        result = result.filter(i => priorities.includes(i.priority));
      }
      if (filter?.tags) {
        result = result.filter(i => filter.tags!.some(t => i.tags.includes(t)));
      }

      // Apply pagination
      if (pagination?.offset) {
        result = result.slice(pagination.offset);
      }
      if (pagination?.limit) {
        result = result.slice(0, pagination.limit);
      }

      return result;
    }),
    countItems: jest.fn().mockResolvedValue(items.length),
    searchItems: jest.fn().mockResolvedValue([]),
    bulkUpdateItems: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
    bulkDeleteItems: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
    createDependency: jest.fn().mockResolvedValue({} as DependencyProps),
    getDependencies: jest.fn().mockResolvedValue([]),
    getDependents: jest.fn().mockResolvedValue([]),
    wouldCreateCycle: jest.fn().mockResolvedValue(false),
    deleteDependency: jest.fn().mockResolvedValue(undefined),
    getBlockedItems: jest.fn().mockResolvedValue([]),
    saveRetrospective: jest.fn().mockResolvedValue({} as RetrospectiveProps),
    getRetrospective: jest.fn().mockResolvedValue(null),
    listRetrospectives: jest.fn().mockResolvedValue([]),
    getRetrospectiveStats: jest.fn().mockResolvedValue({ total: 0, byOutcome: {}, avgAccuracy: null, avgVariance: null }),
    createReminder: jest.fn().mockResolvedValue({} as ReminderProps),
    getReminder: jest.fn().mockResolvedValue(null),
    getRemindersForItem: jest.fn().mockResolvedValue([]),
    getActiveReminders: jest.fn().mockResolvedValue([]),
    updateReminder: jest.fn().mockResolvedValue({} as ReminderProps),
    deleteReminder: jest.fn().mockResolvedValue(undefined),
    createGitLink: jest.fn().mockResolvedValue({} as GitLinkProps),
    getGitLinksForItem: jest.fn().mockResolvedValue([]),
    getGitLinkByCommit: jest.fn().mockResolvedValue(null),
    isCommitLinked: jest.fn().mockResolvedValue(false),
    deleteGitLink: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    beginTransaction: jest.fn().mockResolvedValue('tx-1'),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn().mockImplementation((fn) => fn()),
    exportToJsonl: jest.fn().mockResolvedValue(''),
    importFromJsonl: jest.fn().mockResolvedValue({ success: 0, failed: 0, errors: [] }),
    getMetadata: jest.fn().mockResolvedValue({ version: '1.0.0', itemCount: 0, lastUpdated: null, storageType: 'jsonl' }),
  } as unknown as IStoragePort;
}

describe('ListItemsQuery', () => {
  describe('execute', () => {
    describe('basic listing', () => {
      it('should return all items when no filters', async () => {
        const items = createTestItems(5);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({});

        expect(result.success).toBe(true);
        expect(result.items).toHaveLength(5);
        expect(result.total).toBe(5);
      });

      it('should return empty list when no items', async () => {
        const storage = createMockStorage([]);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({});

        expect(result.success).toBe(true);
        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('status filtering', () => {
      it('should filter by single status', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ status: 'pending' });

        expect(result.success).toBe(true);
        expect(result.items?.every(i => i.status === 'pending')).toBe(true);
      });

      it('should filter by multiple statuses', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ status: ['pending', 'in-progress'] });

        expect(result.success).toBe(true);
        expect(result.items?.every(i => ['pending', 'in-progress'].includes(i.status))).toBe(true);
      });
    });

    describe('priority filtering', () => {
      it('should filter by single priority', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ priority: 'high' });

        expect(result.success).toBe(true);
        expect(result.items?.every(i => i.priority === 'high')).toBe(true);
      });

      it('should filter by multiple priorities', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ priority: ['high', 'medium'] });

        expect(result.success).toBe(true);
        expect(result.items?.every(i => ['high', 'medium'].includes(i.priority))).toBe(true);
      });
    });

    describe('tag filtering', () => {
      it('should filter by tags', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ tags: ['even'] });

        expect(result.success).toBe(true);
        expect(result.items?.every(i => i.tags.includes('even'))).toBe(true);
      });
    });

    describe('pagination', () => {
      it('should limit results', async () => {
        const items = createTestItems(20);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ limit: 5 });

        expect(result.success).toBe(true);
        expect(result.items).toHaveLength(5);
        expect(result.total).toBe(20);
        expect(result.hasMore).toBe(true);
      });

      it('should offset results', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ offset: 5, limit: 10 });

        expect(result.success).toBe(true);
        expect(result.items).toHaveLength(5);
        expect(result.hasMore).toBe(false);
      });

      it('should handle hasMore correctly at boundary', async () => {
        const items = createTestItems(10);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        const result = await query.execute({ limit: 10 });

        expect(result.hasMore).toBe(false);
      });
    });

    describe('sorting', () => {
      it('should pass sort options to storage', async () => {
        const items = createTestItems(5);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        await query.execute({ sortBy: 'priority', sortOrder: 'asc' });

        // First call is for paginated results with sort
        const calls = (storage.listItems as jest.Mock).mock.calls;
        expect(calls[0][1]).toEqual({ field: 'priority', direction: 'asc' });
      });

      it('should default sort direction to desc', async () => {
        const items = createTestItems(5);
        const storage = createMockStorage(items);
        const query = new ListItemsQuery(storage);

        await query.execute({ sortBy: 'createdAt' });

        // First call is for paginated results with sort
        const calls = (storage.listItems as jest.Mock).mock.calls;
        expect(calls[0][1]).toEqual({ field: 'createdAt', direction: 'desc' });
      });
    });

    describe('error handling', () => {
      it('should handle storage errors', async () => {
        const storage = createMockStorage([]);
        (storage.listItems as jest.Mock).mockRejectedValue(new Error('Storage error'));
        const query = new ListItemsQuery(storage);

        const result = await query.execute({});

        expect(result.success).toBe(false);
        expect(result.error).toBe('Storage error');
      });
    });
  });
});
