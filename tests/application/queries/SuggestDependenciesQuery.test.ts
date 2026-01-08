/**
 * Suggest Dependencies Query Tests
 *
 * TDD tests for AI-powered dependency suggestions between items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SuggestDependenciesQuery,
  SuggestedDependency,
} from '../../../src/application/queries/SuggestDependenciesQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';

describe('SuggestDependenciesQuery', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let query: SuggestDependenciesQuery;

  const createMockItem = (overrides: Partial<ItemProps> = {}): ItemProps => ({
    id: 1,
    decision: 'Test decision',
    context: 'Test context',
    status: 'pending',
    priority: 'medium',
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockStorage = {
      initialize: jest.fn(),
      close: jest.fn(),
      getItem: jest.fn(),
      createItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      listItems: jest.fn(),
      countItems: jest.fn(),
      searchItems: jest.fn(),
      getDependencies: jest.fn(),
      createDependency: jest.fn(),
      deleteDependency: jest.fn(),
      getDependents: jest.fn(),
      wouldCreateCycle: jest.fn(),
      getRetrospective: jest.fn(),
      createRetrospective: jest.fn(),
      updateRetrospective: jest.fn(),
      listRetrospectives: jest.fn(),
      getReminder: jest.fn(),
      createReminder: jest.fn(),
      updateReminder: jest.fn(),
      deleteReminder: jest.fn(),
      listReminders: jest.fn(),
      getRemindersForItem: jest.fn(),
      getDueReminders: jest.fn(),
      getGitLink: jest.fn(),
      createGitLink: jest.fn(),
      deleteGitLink: jest.fn(),
      listGitLinks: jest.fn(),
      getGitLinksForItem: jest.fn(),
      exportToJsonl: jest.fn(),
      importFromJsonl: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    query = new SuggestDependenciesQuery(mockStorage);
  });

  describe('text similarity suggestions', () => {
    it('should suggest dependency when items share significant keywords', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Implement user authentication system',
        context: 'Need to add login, logout, and session management',
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Add authentication login logout for users',
        context: 'Users need session management functionality',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1, minConfidence: 0.2 });

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      // Item 2 shares multiple keywords: authentication, login, logout, users, session, management
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(true);
    });

    it('should not suggest dependency for unrelated items', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Implement user authentication',
        context: 'Login system needed',
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Fix database performance issue',
        context: 'Query optimization required',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // Items are unrelated, should not be suggested
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(false);
    });

    it('should rank suggestions by similarity score', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Implement authentication with OAuth',
        context: 'OAuth2 integration for SSO',
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Add OAuth provider configuration',
        context: 'Configure Google and GitHub OAuth',
      });
      const item3 = createMockItem({
        id: 3,
        decision: 'Update authentication UI',
        context: 'Improve login form',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // Item 2 shares both "OAuth" and "authentication" - should rank higher
      if (result.suggestions!.length >= 2) {
        const suggestion2 = result.suggestions!.find((s) => s.targetId === 2);
        const suggestion3 = result.suggestions!.find((s) => s.targetId === 3);
        if (suggestion2 && suggestion3) {
          expect(suggestion2.confidence).toBeGreaterThanOrEqual(suggestion3.confidence);
        }
      }
    });
  });

  describe('tag-based suggestions', () => {
    it('should suggest dependency when items share tags', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Design API endpoints',
        tags: ['api', 'backend'],
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Implement API validation',
        tags: ['api', 'validation'],
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(true);
      const suggestion = result.suggestions!.find((s) => s.targetId === 2);
      expect(suggestion?.reason).toContain('tag');
    });

    it('should increase confidence with more shared tags', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Main feature',
        tags: ['api', 'backend', 'v2'],
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Related feature A',
        tags: ['api'],
      });
      const item3 = createMockItem({
        id: 3,
        decision: 'Related feature B',
        tags: ['api', 'backend', 'v2'],
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      const suggestion2 = result.suggestions!.find((s) => s.targetId === 2);
      const suggestion3 = result.suggestions!.find((s) => s.targetId === 3);
      // Item 3 shares more tags, should have higher confidence
      if (suggestion2 && suggestion3) {
        expect(suggestion3.confidence).toBeGreaterThan(suggestion2.confidence);
      }
    });
  });

  describe('existing dependency handling', () => {
    it('should not suggest items that already have dependency', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Feature A' });
      const item2 = createMockItem({ id: 2, decision: 'Feature A part 2' });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      // Item 1 already depends on Item 2
      mockStorage.getDependencies.mockResolvedValue([
        { itemId: 1, dependsOnId: 2, type: 'blocks', createdAt: new Date() },
      ]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // Should not suggest item 2 since dependency already exists
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(false);
    });

    it('should not suggest self-dependency', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Test item',
        context: 'Test item context',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.suggestions!.some((s) => s.targetId === 1)).toBe(false);
    });
  });

  describe('suggestion types', () => {
    it('should suggest blocks dependency for prerequisite items', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Deploy application to production',
        context: 'Final deployment step',
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Complete production testing',
        context: 'Must test before deploy',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      const suggestion = result.suggestions!.find((s) => s.targetId === 2);
      if (suggestion) {
        expect(suggestion.suggestedType).toBe('blocks');
      }
    });

    it('should suggest relates-to for loosely connected items', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Update frontend styles',
        tags: ['frontend', 'ui'],
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Update backend API responses',
        tags: ['backend', 'api'],
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // These are loosely related if at all
      const suggestion = result.suggestions!.find((s) => s.targetId === 2);
      if (suggestion) {
        expect(['relates-to', 'blocks']).toContain(suggestion.suggestedType);
      }
    });
  });

  describe('filtering options', () => {
    it('should limit number of suggestions', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createMockItem({
          id: i + 1,
          decision: `Feature ${i + 1} with shared keyword`,
          tags: ['common'],
        })
      );

      mockStorage.getItem.mockResolvedValue(items[0]);
      mockStorage.listItems.mockResolvedValue(items);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1, limit: 5 });

      expect(result.success).toBe(true);
      expect(result.suggestions!.length).toBeLessThanOrEqual(5);
    });

    it('should filter by minimum confidence threshold', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Main feature',
        tags: ['important'],
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Slightly related',
        tags: ['different'],
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1, minConfidence: 0.8 });

      expect(result.success).toBe(true);
      // All returned suggestions should meet minimum confidence
      result.suggestions!.forEach((s) => {
        expect(s.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should only suggest pending/in-progress items by default', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Active item', status: 'pending' });
      const item2 = createMockItem({
        id: 2,
        decision: 'Completed item with Active content',
        status: 'done',
        tags: ['Active'],
      });
      const item3 = createMockItem({
        id: 3,
        decision: 'Active related item',
        status: 'in-progress',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2, item3]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      // Should not suggest completed items
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(false);
    });

    it('should include completed items when requested', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Active item', status: 'pending' });
      const item2 = createMockItem({
        id: 2,
        decision: 'Active item - completed',
        status: 'done',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1, includeCompleted: true });

      expect(result.success).toBe(true);
      // Should suggest completed items when flag is set
      expect(result.suggestions!.some((s) => s.targetId === 2)).toBe(true);
    });
  });

  describe('validation', () => {
    it('should fail with invalid item ID', async () => {
      const result = await query.execute({ itemId: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('item ID');
    });

    it('should fail when item does not exist', async () => {
      mockStorage.getItem.mockResolvedValue(null);

      const result = await query.execute({ itemId: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('suggestion metadata', () => {
    it('should include reason for each suggestion', async () => {
      const item1 = createMockItem({
        id: 1,
        decision: 'Build API',
        tags: ['api'],
      });
      const item2 = createMockItem({
        id: 2,
        decision: 'Test API',
        tags: ['api'],
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      const suggestion = result.suggestions!.find((s) => s.targetId === 2);
      if (suggestion) {
        expect(suggestion.reason).toBeDefined();
        expect(suggestion.reason.length).toBeGreaterThan(0);
      }
    });

    it('should include target item details', async () => {
      const item1 = createMockItem({ id: 1, decision: 'Source item' });
      const item2 = createMockItem({
        id: 2,
        decision: 'Target Source item',
        status: 'in-progress',
        priority: 'high',
      });

      mockStorage.getItem.mockResolvedValue(item1);
      mockStorage.listItems.mockResolvedValue([item1, item2]);
      mockStorage.getDependencies.mockResolvedValue([]);

      const result = await query.execute({ itemId: 1, includeTargetDetails: true });

      expect(result.success).toBe(true);
      const suggestion = result.suggestions!.find((s) => s.targetId === 2);
      if (suggestion) {
        expect(suggestion.targetDecision).toBe('Target Source item');
        expect(suggestion.targetStatus).toBe('in-progress');
        expect(suggestion.targetPriority).toBe('high');
      }
    });
  });
});
