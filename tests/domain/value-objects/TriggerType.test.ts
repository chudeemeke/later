import { describe, it, expect } from '@jest/globals';
import { TriggerType, VALID_TRIGGER_TYPES } from '../../../src/domain/value-objects/TriggerType.js';

describe('TriggerType Value Object', () => {
  describe('creation', () => {
    it('should create trigger type from valid string', () => {
      const triggerType = TriggerType.create('time');
      expect(triggerType.value).toBe('time');
    });

    it('should throw on invalid trigger type', () => {
      expect(() => TriggerType.create('cron')).toThrow('Invalid trigger type: cron');
    });

    it('should throw on empty string', () => {
      expect(() => TriggerType.create('')).toThrow('Invalid trigger type:');
    });

    it('should create all valid trigger types', () => {
      for (const value of VALID_TRIGGER_TYPES) {
        const triggerType = TriggerType.create(value);
        expect(triggerType.value).toBe(value);
      }
    });
  });

  describe('factory methods', () => {
    it('should create time trigger type', () => {
      expect(TriggerType.time().value).toBe('time');
    });

    it('should create dependency trigger type', () => {
      expect(TriggerType.dependency().value).toBe('dependency');
    });

    it('should create file_change trigger type', () => {
      expect(TriggerType.fileChange().value).toBe('file_change');
    });

    it('should create activity trigger type', () => {
      expect(TriggerType.activity().value).toBe('activity');
    });
  });

  describe('validation', () => {
    it('should validate time as valid', () => {
      expect(TriggerType.isValid('time')).toBe(true);
    });

    it('should validate dependency as valid', () => {
      expect(TriggerType.isValid('dependency')).toBe(true);
    });

    it('should validate file_change as valid', () => {
      expect(TriggerType.isValid('file_change')).toBe(true);
    });

    it('should validate activity as valid', () => {
      expect(TriggerType.isValid('activity')).toBe(true);
    });

    it('should validate invalid string as invalid', () => {
      expect(TriggerType.isValid('schedule')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(TriggerType.isValid('Time')).toBe(false);
      expect(TriggerType.isValid('FILE_CHANGE')).toBe(false);
    });
  });

  describe('predicates', () => {
    it('should identify time-based trigger', () => {
      const trigger = TriggerType.time();
      expect(trigger.isTimeBased()).toBe(true);
      expect(trigger.isDependencyBased()).toBe(false);
      expect(trigger.isFileChangeBased()).toBe(false);
      expect(trigger.isActivityBased()).toBe(false);
    });

    it('should identify dependency-based trigger', () => {
      const trigger = TriggerType.dependency();
      expect(trigger.isTimeBased()).toBe(false);
      expect(trigger.isDependencyBased()).toBe(true);
      expect(trigger.isFileChangeBased()).toBe(false);
      expect(trigger.isActivityBased()).toBe(false);
    });

    it('should identify file-change-based trigger', () => {
      const trigger = TriggerType.fileChange();
      expect(trigger.isTimeBased()).toBe(false);
      expect(trigger.isDependencyBased()).toBe(false);
      expect(trigger.isFileChangeBased()).toBe(true);
      expect(trigger.isActivityBased()).toBe(false);
    });

    it('should identify activity-based trigger', () => {
      const trigger = TriggerType.activity();
      expect(trigger.isTimeBased()).toBe(false);
      expect(trigger.isDependencyBased()).toBe(false);
      expect(trigger.isFileChangeBased()).toBe(false);
      expect(trigger.isActivityBased()).toBe(true);
    });
  });

  describe('requiresMonitoring', () => {
    it('should return false for time', () => {
      expect(TriggerType.time().requiresMonitoring()).toBe(false);
    });

    it('should return false for dependency', () => {
      expect(TriggerType.dependency().requiresMonitoring()).toBe(false);
    });

    it('should return false for file_change', () => {
      expect(TriggerType.fileChange().requiresMonitoring()).toBe(false);
    });

    it('should return true for activity', () => {
      expect(TriggerType.activity().requiresMonitoring()).toBe(true);
    });
  });

  describe('isOnDemandCheckable', () => {
    it('should return true for time', () => {
      expect(TriggerType.time().isOnDemandCheckable()).toBe(true);
    });

    it('should return true for dependency', () => {
      expect(TriggerType.dependency().isOnDemandCheckable()).toBe(true);
    });

    it('should return true for file_change', () => {
      expect(TriggerType.fileChange().isOnDemandCheckable()).toBe(true);
    });

    it('should return false for activity', () => {
      expect(TriggerType.activity().isOnDemandCheckable()).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      expect(TriggerType.time().equals(TriggerType.time())).toBe(true);
    });

    it('should not be equal for different values', () => {
      expect(TriggerType.time().equals(TriggerType.dependency())).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(TriggerType.time().toString()).toBe('time');
      expect(TriggerType.fileChange().toString()).toBe('file_change');
    });

    it('should convert to JSON', () => {
      expect(TriggerType.time().toJSON()).toBe('time');
      expect(JSON.stringify({ trigger: TriggerType.time() })).toBe('{"trigger":"time"}');
    });
  });
});
