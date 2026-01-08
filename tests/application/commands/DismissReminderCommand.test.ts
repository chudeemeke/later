/**
 * DismissReminderCommand Tests
 *
 * TDD tests for dismissing reminders.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DismissReminderCommand, DismissReminderInput } from '../../../src/application/commands/DismissReminderCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';

describe('DismissReminderCommand', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let command: DismissReminderCommand;

  beforeEach(() => {
    mockStorage = {
      getReminder: jest.fn(),
      updateReminder: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    command = new DismissReminderCommand(mockStorage);
  });

  describe('execute', () => {
    it('should dismiss an active reminder', async () => {
      const now = new Date();
      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
        createdAt: now,
      });

      mockStorage.updateReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
        dismissedAt: now,
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1 });

      expect(result.success).toBe(true);
      expect(result.reminder!.dismissedAt).toBeDefined();
      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ dismissedAt: expect.any(Date) })
      );
    });

    it('should fail if reminder does not exist', async () => {
      mockStorage.getReminder.mockResolvedValue(null);

      const result = await command.execute({ reminderId: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail if reminder is already dismissed', async () => {
      const now = new Date();
      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        dismissedAt: now,
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already dismissed');
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getReminder.mockRejectedValue(new Error('Database error'));

      const result = await command.execute({ reminderId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should clear snooze when dismissing', async () => {
      const now = new Date();
      const snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        snoozedUntil,
        createdAt: now,
      });

      mockStorage.updateReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        dismissedAt: now,
        snoozedUntil: undefined,
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1 });

      expect(result.success).toBe(true);
      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          dismissedAt: expect.any(Date),
          snoozedUntil: undefined
        })
      );
    });
  });
});
