// @ts-nocheck - Jest mock typing incompatibility with @jest/globals
/**
 * UpdateItemCommand Tests
 *
 * Tests the update item command handler.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateItemCommand, UpdateItemInput } from '../../../src/application/commands/UpdateItemCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps, CreateItemInput } from '../../../src/domain/entities/Item.js';
import { DependencyProps, CreateDependencyInput } from '../../../src/domain/entities/Dependency.js';
import { RetrospectiveProps, CreateRetrospectiveInput } from '../../../src/domain/entities/Retrospective.js';
import { ReminderProps, CreateReminderInput } from '../../../src/domain/entities/Reminder.js';
import { GitLinkProps, CreateGitLinkInput } from '../../../src/domain/entities/GitLink.js';

function createMockStorage(overrides: Record<string, unknown> = {}): IStoragePort {
  const defaultItem: ItemProps = {
    id: 1,
    decision: 'Test decision',
    context: 'Test context',
    status: 'pending',
    tags: ['test'],
    priority: 'medium',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  return {
    createItem: jest.fn().mockResolvedValue(defaultItem),
    getItem: jest.fn().mockResolvedValue(defaultItem),
    getItems: jest.fn().mockResolvedValue([defaultItem]),
    updateItem: jest.fn().mockImplementation(async (id: number, updates: Partial<ItemProps>) => ({
      ...defaultItem,
      ...updates,
      id,
      updatedAt: new Date(),
    })),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    listItems: jest.fn().mockResolvedValue([defaultItem]),
    countItems: jest.fn().mockResolvedValue(1),
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
    ...overrides,
  } as unknown as IStoragePort;
}

describe('UpdateItemCommand', () => {
  let storage: IStoragePort;

  beforeEach(() => {
    storage = createMockStorage();
  });

  describe('execute', () => {
    describe('basic updates', () => {
      it('should update decision', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          decision: 'Updated decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item?.decision).toBe('Updated decision');
      });

      it('should update context', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          context: 'Updated context',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(storage.updateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ context: 'Updated context' })
        );
      });

      it('should update priority', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          priority: 'high',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item?.priority).toBe('high');
      });

      it('should update tags', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          tags: ['new-tag', 'another-tag'],
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item?.tags).toEqual(['new-tag', 'another-tag']);
      });

      it('should update multiple fields at once', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          decision: 'New decision',
          priority: 'high',
          tags: ['urgent'],
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(storage.updateItem).toHaveBeenCalled();
      });
    });

    describe('status transitions', () => {
      it('should transition from pending to in-progress', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          status: 'in-progress',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item?.status).toBe('in-progress');
      });

      it('should reject invalid status transition', async () => {
        // done -> in-progress is invalid
        const doneItem: ItemProps = {
          id: 1,
          decision: 'Test decision',
          context: 'Test context',
          status: 'done',
          tags: ['test'],
          priority: 'medium',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        };

        storage = createMockStorage({
          getItem: jest.fn().mockResolvedValue(doneItem),
        });

        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          status: 'in-progress',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot transition');
      });

      it('should allow pending -> done transition', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          status: 'done',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item?.status).toBe('done');
      });
    });

    describe('item not found', () => {
      it('should fail when item does not exist', async () => {
        storage = createMockStorage({
          getItem: jest.fn().mockResolvedValue(null),
        });

        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 999,
          decision: 'Updated',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Item 999 not found');
      });
    });

    describe('no changes provided', () => {
      it('should succeed with no changes', async () => {
        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item).toBeDefined();
      });
    });

    describe('error handling', () => {
      it('should handle storage errors', async () => {
        storage = createMockStorage({
          getItem: jest.fn().mockRejectedValue(new Error('Storage error')),
        });

        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          decision: 'Updated',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Storage error');
      });

      it('should handle update errors', async () => {
        storage = createMockStorage({
          updateItem: jest.fn().mockRejectedValue(new Error('Update failed')),
        });

        const command = new UpdateItemCommand(storage);
        const input: UpdateItemInput = {
          id: 1,
          decision: 'Updated',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Update failed');
      });
    });
  });
});
