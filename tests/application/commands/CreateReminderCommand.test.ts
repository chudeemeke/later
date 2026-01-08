// @ts-nocheck - Jest mock typing incompatibility with @jest/globals
/**
 * CreateReminderCommand Tests
 *
 * TDD tests for creating reminders on items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateReminderCommand, CreateReminderInput } from '../../../src/application/commands/CreateReminderCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';

describe('CreateReminderCommand', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let command: CreateReminderCommand;

  beforeEach(() => {
    mockStorage = {
      getItem: jest.fn(),
      createReminder: jest.fn(),
      getRemindersForItem: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    command = new CreateReminderCommand(mockStorage);
  });

  describe('execute', () => {
    it('should create a time-based reminder', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStorage.createReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
        createdAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      };

      const result = await command.execute(input);

      expect(result.success).toBe(true);
      expect(result.reminder).toBeDefined();
      expect(result.reminder!.itemId).toBe(1);
      expect(result.reminder!.triggerType).toBe('time');
    });

    it('should create a dependency-based reminder', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockStorage.createReminder.mockResolvedValue({
        id: 2,
        itemId: 1,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [2, 3] },
        createdAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [2, 3] },
      };

      const result = await command.execute(input);

      expect(result.success).toBe(true);
      expect(result.reminder!.triggerType).toBe('dependency');
      expect(result.reminder!.triggerConfig).toEqual({ dependencyIds: [2, 3] });
    });

    it('should fail if item does not exist', async () => {
      mockStorage.getItem.mockResolvedValue(null);

      const input: CreateReminderInput = {
        itemId: 999,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if item is already completed', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'done',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('completed');
    });

    it('should fail for invalid trigger type', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'invalid' as any,
        triggerConfig: {},
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid trigger type');
    });

    it('should require thresholdDays for time-based reminder', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'time',
        triggerConfig: {}, // Missing thresholdDays
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('thresholdDays');
    });

    it('should require dependencyIds for dependency-based reminder', async () => {
      mockStorage.getItem.mockResolvedValue({
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'medium',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'dependency',
        triggerConfig: {}, // Missing dependencyIds
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('dependencyIds');
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Database error'));

      const input: CreateReminderInput = {
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      };

      const result = await command.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
