import { describe, it, expect } from '@jest/globals';
import { Outcome, VALID_OUTCOMES } from '../../../src/domain/value-objects/Outcome.js';

describe('Outcome Value Object', () => {
  describe('creation', () => {
    it('should create outcome from valid string', () => {
      const outcome = Outcome.create('success');
      expect(outcome.value).toBe('success');
    });

    it('should throw on invalid outcome', () => {
      expect(() => Outcome.create('unknown')).toThrow('Invalid outcome: unknown');
    });

    it('should throw on empty string', () => {
      expect(() => Outcome.create('')).toThrow('Invalid outcome:');
    });

    it('should create all valid outcomes', () => {
      for (const value of VALID_OUTCOMES) {
        const outcome = Outcome.create(value);
        expect(outcome.value).toBe(value);
      }
    });
  });

  describe('factory methods', () => {
    it('should create success outcome', () => {
      expect(Outcome.success().value).toBe('success');
    });

    it('should create failure outcome', () => {
      expect(Outcome.failure().value).toBe('failure');
    });

    it('should create partial outcome', () => {
      expect(Outcome.partial().value).toBe('partial');
    });
  });

  describe('validation', () => {
    it('should validate success as valid', () => {
      expect(Outcome.isValid('success')).toBe(true);
    });

    it('should validate failure as valid', () => {
      expect(Outcome.isValid('failure')).toBe(true);
    });

    it('should validate partial as valid', () => {
      expect(Outcome.isValid('partial')).toBe(true);
    });

    it('should validate invalid string as invalid', () => {
      expect(Outcome.isValid('incomplete')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(Outcome.isValid('Success')).toBe(false);
      expect(Outcome.isValid('SUCCESS')).toBe(false);
    });
  });

  describe('predicates', () => {
    it('should identify success outcome', () => {
      const outcome = Outcome.success();
      expect(outcome.isSuccess()).toBe(true);
      expect(outcome.isFailure()).toBe(false);
      expect(outcome.isPartial()).toBe(false);
    });

    it('should identify failure outcome', () => {
      const outcome = Outcome.failure();
      expect(outcome.isSuccess()).toBe(false);
      expect(outcome.isFailure()).toBe(true);
      expect(outcome.isPartial()).toBe(false);
    });

    it('should identify partial outcome', () => {
      const outcome = Outcome.partial();
      expect(outcome.isSuccess()).toBe(false);
      expect(outcome.isFailure()).toBe(false);
      expect(outcome.isPartial()).toBe(true);
    });
  });

  describe('isPositive', () => {
    it('should return true for success', () => {
      expect(Outcome.success().isPositive()).toBe(true);
    });

    it('should return true for partial', () => {
      expect(Outcome.partial().isPositive()).toBe(true);
    });

    it('should return false for failure', () => {
      expect(Outcome.failure().isPositive()).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      expect(Outcome.success().equals(Outcome.success())).toBe(true);
    });

    it('should not be equal for different values', () => {
      expect(Outcome.success().equals(Outcome.failure())).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(Outcome.success().toString()).toBe('success');
    });

    it('should convert to JSON', () => {
      expect(Outcome.success().toJSON()).toBe('success');
      expect(JSON.stringify({ outcome: Outcome.success() })).toBe('{"outcome":"success"}');
    });
  });
});
