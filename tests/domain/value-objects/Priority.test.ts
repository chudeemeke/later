import { describe, it, expect } from '@jest/globals';
import { Priority, VALID_PRIORITIES } from '../../../src/domain/value-objects/Priority.js';

describe('Priority Value Object', () => {
  describe('creation', () => {
    it('should create priority from valid string', () => {
      const priority = Priority.create('high');
      expect(priority.value).toBe('high');
    });

    it('should throw on invalid priority', () => {
      expect(() => Priority.create('critical')).toThrow('Invalid priority: critical');
    });

    it('should throw on empty string', () => {
      expect(() => Priority.create('')).toThrow('Invalid priority:');
    });

    it('should create all valid priorities', () => {
      for (const value of VALID_PRIORITIES) {
        const priority = Priority.create(value);
        expect(priority.value).toBe(value);
      }
    });
  });

  describe('factory methods', () => {
    it('should create low priority', () => {
      expect(Priority.low().value).toBe('low');
    });

    it('should create medium priority', () => {
      expect(Priority.medium().value).toBe('medium');
    });

    it('should create high priority', () => {
      expect(Priority.high().value).toBe('high');
    });

    it('should create default as medium', () => {
      expect(Priority.default().value).toBe('medium');
    });
  });

  describe('validation', () => {
    it('should validate low as valid', () => {
      expect(Priority.isValid('low')).toBe(true);
    });

    it('should validate medium as valid', () => {
      expect(Priority.isValid('medium')).toBe(true);
    });

    it('should validate high as valid', () => {
      expect(Priority.isValid('high')).toBe(true);
    });

    it('should validate invalid string as invalid', () => {
      expect(Priority.isValid('urgent')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(Priority.isValid('High')).toBe(false);
      expect(Priority.isValid('HIGH')).toBe(false);
    });
  });

  describe('predicates', () => {
    it('should identify low priority', () => {
      const priority = Priority.low();
      expect(priority.isLow()).toBe(true);
      expect(priority.isMedium()).toBe(false);
      expect(priority.isHigh()).toBe(false);
    });

    it('should identify medium priority', () => {
      const priority = Priority.medium();
      expect(priority.isLow()).toBe(false);
      expect(priority.isMedium()).toBe(true);
      expect(priority.isHigh()).toBe(false);
    });

    it('should identify high priority', () => {
      const priority = Priority.high();
      expect(priority.isLow()).toBe(false);
      expect(priority.isMedium()).toBe(false);
      expect(priority.isHigh()).toBe(true);
    });
  });

  describe('weight', () => {
    it('should have weight 1 for low', () => {
      expect(Priority.low().weight).toBe(1);
    });

    it('should have weight 2 for medium', () => {
      expect(Priority.medium().weight).toBe(2);
    });

    it('should have weight 3 for high', () => {
      expect(Priority.high().weight).toBe(3);
    });
  });

  describe('comparison', () => {
    it('should compare high > medium', () => {
      expect(Priority.high().isHigherThan(Priority.medium())).toBe(true);
      expect(Priority.high().isLowerThan(Priority.medium())).toBe(false);
    });

    it('should compare medium > low', () => {
      expect(Priority.medium().isHigherThan(Priority.low())).toBe(true);
      expect(Priority.medium().isLowerThan(Priority.low())).toBe(false);
    });

    it('should compare low < medium', () => {
      expect(Priority.low().isLowerThan(Priority.medium())).toBe(true);
      expect(Priority.low().isHigherThan(Priority.medium())).toBe(false);
    });

    it('should return 0 for equal priorities', () => {
      expect(Priority.medium().compare(Priority.medium())).toBe(0);
    });

    it('should return positive for higher priority', () => {
      expect(Priority.high().compare(Priority.low())).toBeGreaterThan(0);
    });

    it('should return negative for lower priority', () => {
      expect(Priority.low().compare(Priority.high())).toBeLessThan(0);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      expect(Priority.high().equals(Priority.high())).toBe(true);
    });

    it('should not be equal for different values', () => {
      expect(Priority.high().equals(Priority.low())).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(Priority.high().toString()).toBe('high');
    });

    it('should convert to JSON', () => {
      expect(Priority.high().toJSON()).toBe('high');
      expect(JSON.stringify({ priority: Priority.high() })).toBe('{"priority":"high"}');
    });
  });
});
