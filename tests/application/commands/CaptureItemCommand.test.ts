// @ts-nocheck - Jest mock typing incompatibility with @jest/globals
/**
 * CaptureItemCommand Tests
 *
 * Tests the capture item command handler with various scenarios.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CaptureItemCommand, CaptureItemInput } from '../../../src/application/commands/CaptureItemCommand.js';
import { IStoragePort, ItemFilter, ItemSort, PaginationOptions, SearchResult, BulkResult } from '../../../src/domain/ports/IStoragePort.js';
import { IAIPort, TagSuggestion, AIRequestOptions } from '../../../src/domain/ports/IAIPort.js';
import { ItemProps, CreateItemInput } from '../../../src/domain/entities/Item.js';
import { DependencyProps, CreateDependencyInput } from '../../../src/domain/entities/Dependency.js';
import { RetrospectiveProps, CreateRetrospectiveInput } from '../../../src/domain/entities/Retrospective.js';
import { ReminderProps, CreateReminderInput } from '../../../src/domain/entities/Reminder.js';
import { GitLinkProps, CreateGitLinkInput } from '../../../src/domain/entities/GitLink.js';

/**
 * Mock Storage Port for testing
 */
function createMockStorage(overrides: Record<string, unknown> = {}): IStoragePort {
  return ({
    createItem: jest.fn().mockResolvedValue({
      id: 1,
      decision: 'Test decision',
      context: '',
      status: 'pending',
      tags: [],
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ItemProps),
    getItem: jest.fn().mockResolvedValue(null),
    getItems: jest.fn().mockResolvedValue([]),
    updateItem: jest.fn().mockResolvedValue({} as ItemProps),
    deleteItem: jest.fn().mockResolvedValue(undefined),
    listItems: jest.fn().mockResolvedValue([]),
    countItems: jest.fn().mockResolvedValue(0),
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
  }) as unknown as IStoragePort;
}

/**
 * Mock AI Port for testing
 */
function createMockAI(overrides: Record<string, unknown> = {}): IAIPort {
  return {
    isAvailable: jest.fn().mockResolvedValue(true),
    suggestTags: jest.fn().mockResolvedValue([]),
    suggestPriority: jest.fn().mockResolvedValue({ priority: 'medium', confidence: 0.5, reasoning: '' }),
    checkDuplicate: jest.fn().mockResolvedValue({ isDuplicate: false }),
    extractContext: jest.fn().mockResolvedValue({ summary: '', relevantMessages: [] }),
    analyzeItem: jest.fn().mockResolvedValue({ tags: [], priority: { priority: 'medium', confidence: 0.5, reasoning: '' } }),
    ...overrides,
  } as unknown as IAIPort;
}

describe('CaptureItemCommand', () => {
  let storage: IStoragePort;
  let ai: IAIPort;

  beforeEach(() => {
    storage = createMockStorage();
    ai = createMockAI();
  });

  describe('execute', () => {
    describe('basic capture', () => {
      it('should capture item with decision only', async () => {
        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: 'Test decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item).toBeDefined();
        expect(storage.createItem).toHaveBeenCalled();
      });

      it('should capture item with all fields', async () => {
        const createdItem: ItemProps = {
          id: 1,
          decision: 'Complete decision',
          context: 'Full context',
          status: 'pending',
          tags: ['test', 'important'],
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date(),
          conversationId: 'conv-123',
          contextFiles: ['file1.ts', 'file2.ts'],
          contextHash: 'abc123',
        };

        storage = createMockStorage({
          createItem: jest.fn().mockResolvedValue(createdItem),
        });

        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: 'Complete decision',
          context: 'Full context',
          tags: ['test', 'important'],
          priority: 'high',
          conversationId: 'conv-123',
          contextFiles: ['file1.ts', 'file2.ts'],
          contextHash: 'abc123',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item).toBeDefined();
        expect(result.item?.decision).toBe('Complete decision');
        expect(result.item?.context).toBe('Full context');
        expect(result.item?.priority).toBe('high');
        expect(result.item?.tags).toEqual(['test', 'important']);
      });

      it('should trim decision text', async () => {
        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: '  Trimmed decision  ',
        };

        await command.execute(input);

        expect(storage.createItem).toHaveBeenCalledWith(
          expect.objectContaining({
            decision: 'Trimmed decision',
          })
        );
      });
    });

    describe('validation', () => {
      it('should reject empty decision', async () => {
        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: '',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Decision cannot be empty');
        expect(storage.createItem).not.toHaveBeenCalled();
      });

      it('should reject whitespace-only decision', async () => {
        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: '   ',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Decision cannot be empty');
      });
    });

    describe('duplicate detection', () => {
      it('should check for duplicates when AI available', async () => {
        const existingItems: ItemProps[] = [
          {
            id: 1,
            decision: 'Existing decision',
            context: '',
            status: 'pending',
            tags: [],
            priority: 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        storage = createMockStorage({
          listItems: jest.fn().mockResolvedValue(existingItems),
        });

        ai = createMockAI({
          checkDuplicate: jest.fn().mockResolvedValue({
            isDuplicate: true,
            similarItem: existingItems[0],
            similarity: 0.95,
          }),
        });

        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'Existing decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.duplicateWarning).toBeDefined();
        expect(result.duplicateWarning?.existingId).toBe(1);
        expect(result.duplicateWarning?.similarity).toBe(0.95);
        expect(storage.createItem).not.toHaveBeenCalled();
      });

      it('should skip duplicate check when disabled', async () => {
        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'New decision',
          checkDuplicates: false,
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(ai.checkDuplicate).not.toHaveBeenCalled();
      });

      it('should continue if duplicate check fails', async () => {
        storage = createMockStorage({
          listItems: jest.fn().mockRejectedValue(new Error('Storage error')),
        });

        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'New decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(result.item).toBeDefined();
      });
    });

    describe('auto-categorization', () => {
      it('should add high-confidence tags automatically', async () => {
        const suggestions: TagSuggestion[] = [
          { tag: 'architecture', confidence: 0.9 },
          { tag: 'refactoring', confidence: 0.85 },
          { tag: 'maybe', confidence: 0.5 },
        ];

        ai = createMockAI({
          isAvailable: jest.fn().mockResolvedValue(true),
          suggestTags: jest.fn().mockResolvedValue(suggestions),
        });

        storage = createMockStorage({
          createItem: jest.fn<(input: CreateItemInput) => Promise<ItemProps>>().mockImplementation(async (input: CreateItemInput) => ({
            id: 1,
            decision: input.decision,
            context: input.context || '',
            status: 'pending',
            tags: input.tags || [],
            priority: input.priority || 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          listItems: jest.fn<() => Promise<ItemProps[]>>().mockResolvedValue([]),
        });

        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'Should we refactor the architecture?',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(storage.createItem).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expect.arrayContaining(['architecture', 'refactoring']),
          })
        );
        // Low confidence tags should be returned as suggestions
        expect(result.suggestedTags).toEqual([{ tag: 'maybe', confidence: 0.5 }]);
      });

      it('should skip auto-categorization when disabled', async () => {
        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'New decision',
          autoCategorize: false,
        };

        await command.execute(input);

        expect(ai.suggestTags).not.toHaveBeenCalled();
      });

      it('should preserve user-provided tags', async () => {
        ai = createMockAI({
          isAvailable: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
          suggestTags: jest.fn<() => Promise<{tag: string; confidence: number}[]>>().mockResolvedValue([
            { tag: 'auto-tag', confidence: 0.9 },
          ]),
        });

        storage = createMockStorage({
          createItem: jest.fn<(input: CreateItemInput) => Promise<ItemProps>>().mockImplementation(async (input: CreateItemInput) => ({
            id: 1,
            decision: input.decision,
            context: input.context || '',
            status: 'pending',
            tags: input.tags || [],
            priority: input.priority || 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          listItems: jest.fn<() => Promise<ItemProps[]>>().mockResolvedValue([]),
        });

        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'New decision',
          tags: ['user-tag'],
        };

        await command.execute(input);

        expect(storage.createItem).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expect.arrayContaining(['user-tag', 'auto-tag']),
          })
        );
      });

      it('should continue without AI when unavailable', async () => {
        ai = createMockAI({
          isAvailable: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
        });

        const command = new CaptureItemCommand(storage, ai);
        const input: CaptureItemInput = {
          decision: 'New decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(true);
        expect(ai.suggestTags).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle storage errors', async () => {
        storage = createMockStorage({
          createItem: jest.fn<() => Promise<ItemProps>>().mockRejectedValue(new Error('Storage failed')),
        });

        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: 'New decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Storage failed');
      });

      it('should handle unknown errors', async () => {
        storage = createMockStorage({
          createItem: jest.fn<() => Promise<ItemProps>>().mockRejectedValue('Unknown error'),
        });

        const command = new CaptureItemCommand(storage);
        const input: CaptureItemInput = {
          decision: 'New decision',
        };

        const result = await command.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
      });
    });
  });
});
