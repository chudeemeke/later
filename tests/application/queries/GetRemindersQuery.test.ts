/**
 * GetRemindersQuery Tests
 *
 * TDD tests for retrieving reminders.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetRemindersQuery, GetRemindersInput } from '../../../src/application/queries/GetRemindersQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';

describe('GetRemindersQuery', () => {
  let mockStorage: jest.Mocked<IStoragePort>;
  let query: GetRemindersQuery;

  beforeEach(() => {
    mockStorage = {
      getRemindersForItem: jest.fn(),
      getActiveReminders: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    query = new GetRemindersQuery(mockStorage);
  });

  describe('execute', () => {
    it('should get reminders for a specific item', async () => {
      const now = new Date();
      mockStorage.getRemindersForItem.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          triggerType: 'time',
          triggerConfig: { thresholdDays: 7 },
          createdAt: now,
        },
        {
          id: 2,
          itemId: 1,
          triggerType: 'dependency',
          triggerConfig: { dependencyIds: [2] },
          createdAt: now,
        },
      ]);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.reminders).toHaveLength(2);
      expect(mockStorage.getRemindersForItem).toHaveBeenCalledWith(1);
    });

    it('should get all active reminders when no itemId specified', async () => {
      const now = new Date();
      mockStorage.getActiveReminders.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          triggerType: 'time',
          createdAt: now,
        },
        {
          id: 2,
          itemId: 2,
          triggerType: 'time',
          createdAt: now,
        },
      ]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.reminders).toHaveLength(2);
      expect(mockStorage.getActiveReminders).toHaveBeenCalled();
    });

    it('should filter by trigger type', async () => {
      const now = new Date();
      mockStorage.getActiveReminders.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          triggerType: 'time',
          createdAt: now,
        },
        {
          id: 2,
          itemId: 2,
          triggerType: 'dependency',
          createdAt: now,
        },
      ]);

      const result = await query.execute({ triggerType: 'time' });

      expect(result.success).toBe(true);
      expect(result.reminders).toHaveLength(1);
      expect(result.reminders![0].triggerType).toBe('time');
    });

    it('should include only active reminders by default', async () => {
      const now = new Date();
      mockStorage.getActiveReminders.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          triggerType: 'time',
          createdAt: now,
        },
      ]);

      const result = await query.execute({ includeInactive: false });

      expect(result.success).toBe(true);
      expect(mockStorage.getActiveReminders).toHaveBeenCalled();
    });

    it('should return empty array when no reminders found', async () => {
      mockStorage.getActiveReminders.mockResolvedValue([]);

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.reminders).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should include counts by trigger type', async () => {
      const now = new Date();
      mockStorage.getActiveReminders.mockResolvedValue([
        { id: 1, itemId: 1, triggerType: 'time', createdAt: now },
        { id: 2, itemId: 2, triggerType: 'time', createdAt: now },
        { id: 3, itemId: 3, triggerType: 'dependency', createdAt: now },
      ]);

      const result = await query.execute({ includeCounts: true });

      expect(result.success).toBe(true);
      expect(result.countsByType).toEqual({
        time: 2,
        dependency: 1,
        file_change: 0,
        activity: 0,
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getActiveReminders.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
