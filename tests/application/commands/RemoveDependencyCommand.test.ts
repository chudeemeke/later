/**
 * Remove Dependency Command Tests
 *
 * TDD tests for removing dependency relationships between items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  RemoveDependencyCommand,
} from '../../../src/application/commands/RemoveDependencyCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';
import { DependencyProps } from '../../../src/domain/entities/Dependency.js';

describe('RemoveDependencyCommand', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let command: RemoveDependencyCommand;

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

  const createMockDependency = (overrides: Partial<DependencyProps> = {}): DependencyProps => ({
    itemId: 1,
    dependsOnId: 2,
    type: 'blocks',
    createdAt: new Date(),
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

    command = new RemoveDependencyCommand(mockStorage);
  });

  describe('successful removal', () => {
    it('should remove an existing dependency', async () => {
      const item1 = createMockItem({ id: 1 });
      const item2 = createMockItem({ id: 2 });
      const dependency = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.getDependencies.mockResolvedValue([dependency]);
      mockStorage.deleteDependency.mockResolvedValue(undefined);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(true);
      expect(result.removed).toBe(true);
      expect(mockStorage.deleteDependency).toHaveBeenCalledWith(1, 2);
    });

    it('should return success even when items no longer exist if dependency exists', async () => {
      // Edge case: dependency exists but item was deleted
      const dependency = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockResolvedValue(null);
      mockStorage.getDependencies.mockResolvedValue([dependency]);
      mockStorage.deleteDependency.mockResolvedValue(undefined);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      // Should still succeed - we want to clean up orphaned dependencies
      expect(result.success).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid item ID (zero)', async () => {
      const result = await command.execute({
        itemId: 0,
        dependsOnId: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('item ID');
    });

    it('should fail with invalid item ID (negative)', async () => {
      const result = await command.execute({
        itemId: -1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('item ID');
    });

    it('should fail with invalid depends-on ID (zero)', async () => {
      const result = await command.execute({
        itemId: 1,
        dependsOnId: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('depends-on ID');
    });

    it('should fail with invalid depends-on ID (negative)', async () => {
      const result = await command.execute({
        itemId: 1,
        dependsOnId: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('depends-on ID');
    });

    it('should fail when removing self-dependency (edge case)', async () => {
      const result = await command.execute({
        itemId: 1,
        dependsOnId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('itself');
    });
  });

  describe('dependency not found', () => {
    it('should return not found when dependency does not exist', async () => {
      const item1 = createMockItem({ id: 1 });
      const item2 = createMockItem({ id: 2 });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.getDependencies.mockResolvedValue([]); // No dependencies

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.notFound).toBe(true);
    });

    it('should return not found when dependency exists with different items', async () => {
      const dependency = createMockDependency({ itemId: 1, dependsOnId: 3 }); // Different target

      mockStorage.getItem.mockResolvedValue(createMockItem());
      mockStorage.getDependencies.mockResolvedValue([dependency]);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2, // Different from dependency
      });

      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
    });
  });

  describe('cascading effects', () => {
    it('should report items that become unblocked after removal', async () => {
      const item1 = createMockItem({ id: 1, status: 'pending' });
      const item2 = createMockItem({ id: 2, status: 'done' });
      const dependency = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'blocks' });

      mockStorage.getItem.mockImplementation(async (id) => {
        if (id === 1) return item1;
        if (id === 2) return item2;
        return null;
      });
      mockStorage.getDependencies.mockImplementation(async (id) => {
        if (id === 1) return [dependency];
        return [];
      });
      mockStorage.deleteDependency.mockResolvedValue(undefined);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
        reportUnblocked: true,
      });

      expect(result.success).toBe(true);
      // Item 1 should be reported as potentially unblocked
      expect(result.unblockedItems).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.getDependencies.mockRejectedValue(new Error('Database error'));

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle deletion failure (throws)', async () => {
      const dependency = createMockDependency({ itemId: 1, dependsOnId: 2 });

      mockStorage.getItem.mockResolvedValue(createMockItem());
      mockStorage.getDependencies.mockResolvedValue([dependency]);
      mockStorage.deleteDependency.mockRejectedValue(new Error('Delete failed'));

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delete failed');
    });
  });

  describe('removal by type', () => {
    it('should remove dependency matching specific type when provided', async () => {
      const blocksDepn = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const relatesToDep = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'relates-to' });

      mockStorage.getItem.mockResolvedValue(createMockItem());
      mockStorage.getDependencies.mockResolvedValue([blocksDepn, relatesToDep]);
      mockStorage.deleteDependency.mockResolvedValue(undefined);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
        type: 'blocks',
      });

      expect(result.success).toBe(true);
      expect(mockStorage.deleteDependency).toHaveBeenCalledWith(1, 2);
    });

    it('should fail when type filter does not match any dependency', async () => {
      const relatesToDep = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'relates-to' });

      mockStorage.getItem.mockResolvedValue(createMockItem());
      mockStorage.getDependencies.mockResolvedValue([relatesToDep]);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
        type: 'blocks', // Different type
      });

      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
    });

    it('should remove all dependencies between items when no type specified', async () => {
      const blocksDepn = createMockDependency({ itemId: 1, dependsOnId: 2, type: 'blocks' });

      mockStorage.getItem.mockResolvedValue(createMockItem());
      mockStorage.getDependencies.mockResolvedValue([blocksDepn]);
      mockStorage.deleteDependency.mockResolvedValue(undefined);

      const result = await command.execute({
        itemId: 1,
        dependsOnId: 2,
      });

      expect(result.success).toBe(true);
      expect(mockStorage.deleteDependency).toHaveBeenCalledWith(1, 2);
    });
  });
});
