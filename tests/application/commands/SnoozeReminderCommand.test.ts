/**
 * SnoozeReminderCommand Tests
 *
 * TDD tests for snoozing reminders.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SnoozeReminderCommand, SnoozeReminderInput } from '../../../src/application/commands/SnoozeReminderCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';

describe('SnoozeReminderCommand', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let command: SnoozeReminderCommand;

  beforeEach(() => {
    mockStorage = {
      getReminder: jest.fn(),
      updateReminder: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    command = new SnoozeReminderCommand(mockStorage);
  });

  describe('execute', () => {
    it('should snooze a reminder for specified days', async () => {
      const now = new Date();
      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        createdAt: now,
      });

      const expectedSnoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockStorage.updateReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        snoozedUntil: expectedSnoozedUntil,
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1, days: 7 });

      expect(result.success).toBe(true);
      expect(result.reminder!.snoozedUntil).toBeDefined();
      expect(mockStorage.updateReminder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ snoozedUntil: expect.any(Date) })
      );
    });

    it('should fail if reminder does not exist', async () => {
      mockStorage.getReminder.mockResolvedValue(null);

      const result = await command.execute({ reminderId: 999, days: 7 });

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

      const result = await command.execute({ reminderId: 1, days: 7 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('dismissed');
    });

    it('should fail if days is zero or negative', async () => {
      const result = await command.execute({ reminderId: 1, days: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('should fail if days is negative', async () => {
      const result = await command.execute({ reminderId: 1, days: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('should allow re-snoozing an already snoozed reminder', async () => {
      const now = new Date();
      const oldSnoozed = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        snoozedUntil: oldSnoozed,
        createdAt: now,
      });

      mockStorage.updateReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        snoozedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1, days: 14 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('snoozed');
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getReminder.mockRejectedValue(new Error('Database error'));

      const result = await command.execute({ reminderId: 1, days: 7 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should default to 1 day if not specified', async () => {
      const now = new Date();
      mockStorage.getReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        createdAt: now,
      });

      mockStorage.updateReminder.mockResolvedValue({
        id: 1,
        itemId: 1,
        triggerType: 'time',
        snoozedUntil: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        createdAt: now,
      });

      const result = await command.execute({ reminderId: 1 });

      expect(result.success).toBe(true);
    });
  });
});
