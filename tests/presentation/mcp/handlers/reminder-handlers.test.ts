/**
 * MCP Reminder Handlers Tests
 *
 * Tests for MCP handlers wrapping reminder commands and queries.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import handlers
import { createCreateReminderHandler } from '../../../../src/presentation/mcp/handlers/create-reminder.js';
import { createDismissReminderHandler } from '../../../../src/presentation/mcp/handlers/dismiss-reminder.js';
import { createSnoozeReminderHandler } from '../../../../src/presentation/mcp/handlers/snooze-reminder.js';
import { createGetRemindersHandler } from '../../../../src/presentation/mcp/handlers/get-reminders.js';
import { createGetStaleItemsHandler } from '../../../../src/presentation/mcp/handlers/get-stale-items.js';

describe('MCP Reminder Handlers', () => {
  // Mock execute functions
  const mockCreateReminderExecute = jest.fn<() => Promise<unknown>>();
  const mockDismissReminderExecute = jest.fn<() => Promise<unknown>>();
  const mockSnoozeReminderExecute = jest.fn<() => Promise<unknown>>();
  const mockGetRemindersExecute = jest.fn<() => Promise<unknown>>();
  const mockGetStaleItemsExecute = jest.fn<() => Promise<unknown>>();

  // Mock container
  const mockContainer = {
    storage: {},
    commands: {
      capture: { execute: jest.fn() },
      update: { execute: jest.fn() },
      complete: { execute: jest.fn() },
      delete: { execute: jest.fn() },
      addDependency: { execute: jest.fn() },
      removeDependency: { execute: jest.fn() },
      updateRetrospective: { execute: jest.fn() },
      createReminder: { execute: mockCreateReminderExecute },
      dismissReminder: { execute: mockDismissReminderExecute },
      snoozeReminder: { execute: mockSnoozeReminderExecute },
    },
    queries: {
      getItem: { execute: jest.fn() },
      listItems: { execute: jest.fn() },
      searchItems: { execute: jest.fn() },
      getBlockedItems: { execute: jest.fn() },
      getStaleItems: { execute: mockGetStaleItemsExecute },
      getDependencyChain: { execute: jest.fn() },
      getResolutionOrder: { execute: jest.fn() },
      suggestDependencies: { execute: jest.fn() },
      getRetrospective: { execute: jest.fn() },
      getRetrospectiveStats: { execute: jest.fn() },
      getReminders: { execute: mockGetRemindersExecute },
    },
    services: {
      dependencyResolver: {},
      stalenessChecker: {},
    },
    close: jest.fn<() => Promise<void>>(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCreateReminderHandler', () => {
    it('should create a time-based reminder', async () => {
      const handler = createCreateReminderHandler(mockContainer);

      mockCreateReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 1,
          itemId: 5,
          triggerType: 'time',
          triggerConfig: { thresholdDays: 7 },
          createdAt: new Date('2025-01-15'),
        },
        message: 'Reminder created',
      });

      const result = await handler({
        item_id: 5,
        trigger_type: 'time',
        threshold_days: 7,
      });

      expect(result.success).toBe(true);
      expect(result.reminder).toBeDefined();
      expect(result.reminder!.id).toBe(1);
      expect(result.reminder!.item_id).toBe(5);
      expect(result.reminder!.trigger_type).toBe('time');
      expect(result.message).toBe('Reminder created for item #5');
    });

    it('should create a dependency-based reminder', async () => {
      const handler = createCreateReminderHandler(mockContainer);

      mockCreateReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 2,
          itemId: 5,
          triggerType: 'dependency',
          triggerConfig: { dependencyIds: [1, 2, 3] },
          createdAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 5,
        trigger_type: 'dependency',
        dependency_ids: [1, 2, 3],
      });

      expect(result.success).toBe(true);
      expect(result.reminder!.trigger_type).toBe('dependency');
    });

    it('should create a file_change reminder', async () => {
      const handler = createCreateReminderHandler(mockContainer);

      mockCreateReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 3,
          itemId: 5,
          triggerType: 'file_change',
          triggerConfig: { filePaths: ['/src/app.ts'] },
          createdAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 5,
        trigger_type: 'file_change',
        file_paths: ['/src/app.ts'],
      });

      expect(result.success).toBe(true);
      expect(result.reminder!.trigger_type).toBe('file_change');
    });

    it('should handle item not found error', async () => {
      const handler = createCreateReminderHandler(mockContainer);

      mockCreateReminderExecute.mockResolvedValue({
        success: false,
        error: 'Item not found',
      });

      const result = await handler({
        item_id: 999,
        trigger_type: 'time',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createDismissReminderHandler', () => {
    it('should dismiss a reminder', async () => {
      const handler = createDismissReminderHandler(mockContainer);

      mockDismissReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 1,
          itemId: 5,
          triggerType: 'time',
          dismissedAt: new Date('2025-01-15'),
          createdAt: new Date('2025-01-10'),
        },
      });

      const result = await handler({ reminder_id: 1 });

      expect(result.success).toBe(true);
      expect(result.reminder).toBeDefined();
      expect(result.reminder!.dismissed_at).toBeDefined();
      expect(result.message).toBe('Reminder #1 dismissed');
    });

    it('should handle reminder not found', async () => {
      const handler = createDismissReminderHandler(mockContainer);

      mockDismissReminderExecute.mockResolvedValue({
        success: false,
        error: 'Reminder not found',
      });

      const result = await handler({ reminder_id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createSnoozeReminderHandler', () => {
    it('should snooze a reminder for default days', async () => {
      const handler = createSnoozeReminderHandler(mockContainer);

      const snoozedUntil = new Date('2025-01-16');
      mockSnoozeReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 1,
          itemId: 5,
          triggerType: 'time',
          snoozedUntil,
          createdAt: new Date('2025-01-10'),
        },
        message: 'Reminder snoozed',
      });

      const result = await handler({ reminder_id: 1 });

      expect(result.success).toBe(true);
      expect(result.reminder).toBeDefined();
      expect(result.snoozed_until).toBeDefined();
    });

    it('should snooze for specified days', async () => {
      const handler = createSnoozeReminderHandler(mockContainer);

      const snoozedUntil = new Date('2025-01-22');
      mockSnoozeReminderExecute.mockResolvedValue({
        success: true,
        reminder: {
          id: 1,
          itemId: 5,
          triggerType: 'time',
          snoozedUntil,
          createdAt: new Date('2025-01-10'),
        },
        message: 'Reminder snoozed for 7 days',
      });

      const result = await handler({ reminder_id: 1, days: 7 });

      expect(result.success).toBe(true);
      expect(mockSnoozeReminderExecute).toHaveBeenCalledWith({
        reminderId: 1,
        days: 7,
      });
    });

    it('should handle reminder not found', async () => {
      const handler = createSnoozeReminderHandler(mockContainer);

      mockSnoozeReminderExecute.mockResolvedValue({
        success: false,
        error: 'Reminder not found',
      });

      const result = await handler({ reminder_id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createGetRemindersHandler', () => {
    it('should get all reminders', async () => {
      const handler = createGetRemindersHandler(mockContainer);

      mockGetRemindersExecute.mockResolvedValue({
        success: true,
        reminders: [
          {
            id: 1,
            itemId: 5,
            triggerType: 'time',
            createdAt: new Date('2025-01-10'),
          },
          {
            id: 2,
            itemId: 6,
            triggerType: 'dependency',
            createdAt: new Date('2025-01-11'),
          },
        ],
        total: 2,
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.reminders).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by item_id', async () => {
      const handler = createGetRemindersHandler(mockContainer);

      mockGetRemindersExecute.mockResolvedValue({
        success: true,
        reminders: [
          {
            id: 1,
            itemId: 5,
            triggerType: 'time',
            createdAt: new Date('2025-01-10'),
          },
        ],
        total: 1,
      });

      await handler({ item_id: 5 });

      expect(mockGetRemindersExecute).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 5 })
      );
    });

    it('should filter by trigger_type', async () => {
      const handler = createGetRemindersHandler(mockContainer);

      mockGetRemindersExecute.mockResolvedValue({
        success: true,
        reminders: [],
        total: 0,
      });

      await handler({ trigger_type: 'dependency' });

      expect(mockGetRemindersExecute).toHaveBeenCalledWith(
        expect.objectContaining({ triggerType: 'dependency' })
      );
    });

    it('should include counts by type when requested', async () => {
      const handler = createGetRemindersHandler(mockContainer);

      mockGetRemindersExecute.mockResolvedValue({
        success: true,
        reminders: [],
        total: 4,
        countsByType: {
          time: 2,
          dependency: 1,
          file_change: 1,
          activity: 0,
        },
      });

      const result = await handler({ include_counts: true });

      expect(result.success).toBe(true);
      expect(result.counts_by_type).toBeDefined();
      expect(result.counts_by_type!.time).toBe(2);
      expect(result.counts_by_type!.dependency).toBe(1);
    });

    it('should transform reminder dates to ISO strings', async () => {
      const handler = createGetRemindersHandler(mockContainer);

      mockGetRemindersExecute.mockResolvedValue({
        success: true,
        reminders: [
          {
            id: 1,
            itemId: 5,
            triggerType: 'time',
            triggeredAt: new Date('2025-01-14'),
            snoozedUntil: new Date('2025-01-16'),
            createdAt: new Date('2025-01-10'),
          },
        ],
        total: 1,
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.reminders![0].triggered_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(result.reminders![0].snoozed_until).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(result.reminders![0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('createGetStaleItemsHandler', () => {
    it('should get stale items', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [
          {
            item: {
              id: 1,
              decision: 'Stale decision',
              status: 'pending',
              priority: 'high',
            },
            stalenessScore: 0.75,
            daysSinceUpdate: 30,
            recommendation: 'refresh',
            factors: {
              timeFactor: 0.8,
              priorityFactor: 0.7,
              activityFactor: 0.6,
            },
          },
        ],
        total: 1,
        summary: {
          refresh: 1,
          review: 0,
          archive: 0,
        },
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.stale_items).toHaveLength(1);
      expect(result.stale_items![0].staleness_score).toBe(0.75);
      expect(result.stale_items![0].days_since_update).toBe(30);
      expect(result.stale_items![0].recommendation).toBe('refresh');
    });

    it('should filter by minimum score', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [],
        total: 0,
        summary: { refresh: 0, review: 0, archive: 0 },
      });

      await handler({ min_score: 0.5 });

      expect(mockGetStaleItemsExecute).toHaveBeenCalledWith(
        expect.objectContaining({ minScore: 0.5 })
      );
    });

    it('should include urgent items only when requested', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [],
        total: 0,
        summary: { refresh: 0, review: 0, archive: 0 },
      });

      await handler({ include_urgent: true });

      expect(mockGetStaleItemsExecute).toHaveBeenCalledWith(
        expect.objectContaining({ includeUrgent: true })
      );
    });

    it('should filter by priority', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [],
        total: 0,
        summary: { refresh: 0, review: 0, archive: 0 },
      });

      await handler({ priority_filter: ['high', 'medium'] });

      expect(mockGetStaleItemsExecute).toHaveBeenCalledWith(
        expect.objectContaining({ priorityFilter: ['high', 'medium'] })
      );
    });

    it('should transform staleness factors to snake_case', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [
          {
            item: {
              id: 1,
              decision: 'Test',
              status: 'pending',
              priority: 'low',
            },
            stalenessScore: 0.5,
            daysSinceUpdate: 14,
            recommendation: 'review',
            factors: {
              timeFactor: 0.4,
              priorityFactor: 0.3,
              activityFactor: 0.5,
            },
          },
        ],
        total: 1,
        summary: { refresh: 0, review: 1, archive: 0 },
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.stale_items![0].factors.time_factor).toBe(0.4);
      expect(result.stale_items![0].factors.priority_factor).toBe(0.3);
      expect(result.stale_items![0].factors.activity_factor).toBe(0.5);
    });

    it('should include summary', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: true,
        staleItems: [],
        total: 5,
        summary: {
          refresh: 2,
          review: 2,
          archive: 1,
        },
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary!.refresh).toBe(2);
      expect(result.summary!.review).toBe(2);
      expect(result.summary!.archive).toBe(1);
    });

    it('should handle errors', async () => {
      const handler = createGetStaleItemsHandler(mockContainer);

      mockGetStaleItemsExecute.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const result = await handler({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
