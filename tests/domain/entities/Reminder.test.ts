import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Reminder } from '../../../src/domain/entities/Reminder.js';

describe('Reminder Entity', () => {
  describe('creation', () => {
    it('should create time-based reminder', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.id).toBe(1);
      expect(reminder.itemId.value).toBe(10);
      expect(reminder.triggerType.value).toBe('time');
      expect(reminder.triggerConfig?.thresholdDays).toBe(7);
    });

    it('should create dependency-based reminder', () => {
      const reminder = Reminder.create({
        id: 2,
        itemId: 10,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [5, 6, 7] },
      });

      expect(reminder.triggerType.value).toBe('dependency');
      expect(reminder.triggerConfig?.dependencyIds).toEqual([5, 6, 7]);
    });

    it('should create file-change-based reminder', () => {
      const reminder = Reminder.create({
        id: 3,
        itemId: 10,
        triggerType: 'file_change',
        triggerConfig: {
          filePaths: ['src/config.ts', 'package.json'],
          fileHashes: { 'src/config.ts': 'abc123' },
        },
      });

      expect(reminder.triggerType.value).toBe('file_change');
      expect(reminder.triggerConfig?.filePaths).toContain('src/config.ts');
    });

    it('should create activity-based reminder', () => {
      const reminder = Reminder.create({
        id: 4,
        itemId: 10,
        triggerType: 'activity',
        triggerConfig: {
          codePatterns: ['TODO', 'FIXME'],
          relatedTags: ['refactor', 'optimization'],
        },
      });

      expect(reminder.triggerType.value).toBe('activity');
      expect(reminder.triggerConfig?.codePatterns).toContain('TODO');
    });

    it('should create reminder without trigger config', () => {
      const reminder = Reminder.create({
        id: 5,
        itemId: 10,
        triggerType: 'time',
      });

      expect(reminder.triggerConfig).toBeUndefined();
    });

    it('should set createdAt on creation', () => {
      const before = new Date();
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      const after = new Date();

      expect(reminder.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(reminder.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('trigger lifecycle', () => {
    it('should mark as triggered', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });

      expect(reminder.hasTriggered()).toBe(false);
      reminder.trigger();
      expect(reminder.hasTriggered()).toBe(true);
      expect(reminder.triggeredAt).toBeInstanceOf(Date);
    });

    it('should mark as dismissed', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });

      expect(reminder.isDismissed()).toBe(false);
      reminder.dismiss();
      expect(reminder.isDismissed()).toBe(true);
      expect(reminder.dismissedAt).toBeInstanceOf(Date);
    });
  });

  describe('snooze management', () => {
    it('should snooze for specified days', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      reminder.snooze(3);

      expect(reminder.snoozedUntil).toBeInstanceOf(Date);
      expect(reminder.isSnoozed()).toBe(true);
    });

    it('should throw on zero snooze days', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      expect(() => reminder.snooze(0)).toThrow('Snooze days must be positive');
    });

    it('should throw on negative snooze days', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      expect(() => reminder.snooze(-1)).toThrow('Snooze days must be positive');
    });

    it('should clear snooze', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      reminder.snooze(5);
      expect(reminder.isSnoozed()).toBe(true);

      reminder.clearSnooze();
      expect(reminder.isSnoozed()).toBe(false);
      expect(reminder.snoozedUntil).toBeUndefined();
    });

    it('should calculate days remaining on snooze', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      reminder.snooze(5);

      // Should be 4-5 days remaining (depending on time of day)
      const remaining = reminder.snoozeDaysRemaining();
      expect(remaining).toBeGreaterThanOrEqual(4);
      expect(remaining).toBeLessThanOrEqual(5);
    });

    it('should return zero days remaining when not snoozed', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      expect(reminder.snoozeDaysRemaining()).toBe(0);
    });
  });

  describe('snooze expiration', () => {
    it('should not be expired when not snoozed', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      expect(reminder.snoozeExpired()).toBe(false);
    });

    it('should detect expired snooze', () => {
      // Create reminder and set snoozedUntil to past date via fromProps
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const reminder = Reminder.fromProps({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        snoozedUntil: pastDate,
        createdAt: new Date(),
      });

      expect(reminder.snoozeExpired()).toBe(true);
      expect(reminder.isSnoozed()).toBe(false);
    });
  });

  describe('active state', () => {
    it('should be active by default', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      expect(reminder.isActive()).toBe(true);
    });

    it('should not be active when dismissed', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      reminder.dismiss();
      expect(reminder.isActive()).toBe(false);
    });

    it('should not be active when snoozed', () => {
      const reminder = Reminder.create({ id: 1, itemId: 10, triggerType: 'time' });
      reminder.snooze(5);
      expect(reminder.isActive()).toBe(false);
    });

    it('should be active when snooze expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const reminder = Reminder.fromProps({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        snoozedUntil: pastDate,
        createdAt: new Date(),
      });

      expect(reminder.isActive()).toBe(true);
    });
  });

  describe('time-based trigger check', () => {
    it('should trigger when threshold exceeded', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.shouldTriggerByTime(10)).toBe(true);
    });

    it('should trigger when threshold exactly met', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.shouldTriggerByTime(7)).toBe(true);
    });

    it('should not trigger when below threshold', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.shouldTriggerByTime(5)).toBe(false);
    });

    it('should not trigger for non-time-based reminder', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [5] },
      });

      expect(reminder.shouldTriggerByTime(100)).toBe(false);
    });

    it('should not trigger without threshold config', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
      });

      expect(reminder.shouldTriggerByTime(100)).toBe(false);
    });
  });

  describe('dependency-based trigger check', () => {
    it('should trigger when dependency completed', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [5, 6, 7] },
      });

      expect(reminder.shouldTriggerByDependency(6)).toBe(true);
    });

    it('should not trigger for unrelated dependency', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [5, 6, 7] },
      });

      expect(reminder.shouldTriggerByDependency(99)).toBe(false);
    });

    it('should not trigger for non-dependency-based reminder', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.shouldTriggerByDependency(5)).toBe(false);
    });

    it('should not trigger without dependency config', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'dependency',
      });

      expect(reminder.shouldTriggerByDependency(5)).toBe(false);
    });
  });

  describe('file-change-based trigger check', () => {
    it('should trigger when watched file changes', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'file_change',
        triggerConfig: { filePaths: ['src/config.ts', 'package.json'] },
      });

      expect(reminder.shouldTriggerByFileChange(['src/config.ts'])).toBe(true);
    });

    it('should trigger when one of many files changes', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'file_change',
        triggerConfig: { filePaths: ['src/config.ts', 'package.json'] },
      });

      expect(reminder.shouldTriggerByFileChange(['other.ts', 'package.json'])).toBe(true);
    });

    it('should not trigger for unrelated files', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'file_change',
        triggerConfig: { filePaths: ['src/config.ts', 'package.json'] },
      });

      expect(reminder.shouldTriggerByFileChange(['other.ts', 'readme.md'])).toBe(false);
    });

    it('should not trigger for non-file-change-based reminder', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
      });

      expect(reminder.shouldTriggerByFileChange(['src/config.ts'])).toBe(false);
    });

    it('should not trigger without file paths config', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'file_change',
      });

      expect(reminder.shouldTriggerByFileChange(['src/config.ts'])).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to props', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 14 },
      });
      reminder.trigger();
      reminder.snooze(3);

      const props = reminder.toProps();

      expect(props.id).toBe(1);
      expect(props.itemId).toBe(10);
      expect(props.triggerType).toBe('time');
      expect(props.triggerConfig?.thresholdDays).toBe(14);
      expect(props.triggeredAt).toBeInstanceOf(Date);
      expect(props.snoozedUntil).toBeInstanceOf(Date);
      expect(props.createdAt).toBeInstanceOf(Date);
    });

    it('should convert to JSON', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'dependency',
        triggerConfig: { dependencyIds: [5] },
      });

      const json = reminder.toJSON();

      expect(json.id).toBe(1);
      expect(json.item_id).toBe(10);
      expect(json.trigger_type).toBe('dependency');
      expect(json.trigger_config).toBe(JSON.stringify({ dependencyIds: [5] }));
      expect(typeof json.created_at).toBe('string');
    });

    it('should handle undefined trigger config in JSON', () => {
      const reminder = Reminder.create({
        id: 1,
        itemId: 10,
        triggerType: 'time',
      });

      const json = reminder.toJSON();
      expect(json.trigger_config).toBeUndefined();
    });

    it('should reconstitute from props', () => {
      const createdAt = new Date('2024-01-01');
      const triggeredAt = new Date('2024-01-10');
      const dismissedAt = new Date('2024-01-11');

      const props = {
        id: 5,
        itemId: 20,
        triggerType: 'file_change' as const,
        triggerConfig: { filePaths: ['test.ts'] },
        triggeredAt,
        dismissedAt,
        createdAt,
      };

      const reminder = Reminder.fromProps(props);

      expect(reminder.id).toBe(5);
      expect(reminder.itemId.value).toBe(20);
      expect(reminder.triggerType.value).toBe('file_change');
      expect(reminder.hasTriggered()).toBe(true);
      expect(reminder.isDismissed()).toBe(true);
      expect(reminder.createdAt.getTime()).toBe(createdAt.getTime());
    });
  });
});
