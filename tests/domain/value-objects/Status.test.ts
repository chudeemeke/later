import { describe, it, expect } from '@jest/globals';
import { Status, VALID_STATUSES } from '../../../src/domain/value-objects/Status.js';

describe('Status Value Object', () => {
  describe('creation', () => {
    it('should create status from valid string', () => {
      const status = Status.create('pending');
      expect(status.value).toBe('pending');
    });

    it('should throw on invalid status', () => {
      expect(() => Status.create('invalid')).toThrow('Invalid status: invalid');
    });

    it('should throw on empty string', () => {
      expect(() => Status.create('')).toThrow('Invalid status:');
    });

    it('should create all valid statuses', () => {
      for (const value of VALID_STATUSES) {
        const status = Status.create(value);
        expect(status.value).toBe(value);
      }
    });
  });

  describe('factory methods', () => {
    it('should create pending status', () => {
      expect(Status.pending().value).toBe('pending');
    });

    it('should create in-progress status', () => {
      expect(Status.inProgress().value).toBe('in-progress');
    });

    it('should create done status', () => {
      expect(Status.done().value).toBe('done');
    });

    it('should create archived status', () => {
      expect(Status.archived().value).toBe('archived');
    });
  });

  describe('validation', () => {
    it('should validate pending as valid', () => {
      expect(Status.isValid('pending')).toBe(true);
    });

    it('should validate in-progress as valid', () => {
      expect(Status.isValid('in-progress')).toBe(true);
    });

    it('should validate done as valid', () => {
      expect(Status.isValid('done')).toBe(true);
    });

    it('should validate archived as valid', () => {
      expect(Status.isValid('archived')).toBe(true);
    });

    it('should validate invalid string as invalid', () => {
      expect(Status.isValid('invalid')).toBe(false);
    });

    it('should validate empty string as invalid', () => {
      expect(Status.isValid('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(Status.isValid('Pending')).toBe(false);
      expect(Status.isValid('PENDING')).toBe(false);
    });
  });

  describe('predicates', () => {
    it('should identify pending status', () => {
      const status = Status.pending();
      expect(status.isPending()).toBe(true);
      expect(status.isInProgress()).toBe(false);
      expect(status.isDone()).toBe(false);
      expect(status.isArchived()).toBe(false);
    });

    it('should identify in-progress status', () => {
      const status = Status.inProgress();
      expect(status.isPending()).toBe(false);
      expect(status.isInProgress()).toBe(true);
      expect(status.isDone()).toBe(false);
      expect(status.isArchived()).toBe(false);
    });

    it('should identify done status', () => {
      const status = Status.done();
      expect(status.isPending()).toBe(false);
      expect(status.isInProgress()).toBe(false);
      expect(status.isDone()).toBe(true);
      expect(status.isArchived()).toBe(false);
    });

    it('should identify archived status', () => {
      const status = Status.archived();
      expect(status.isPending()).toBe(false);
      expect(status.isInProgress()).toBe(false);
      expect(status.isDone()).toBe(false);
      expect(status.isArchived()).toBe(true);
    });
  });

  describe('isActive', () => {
    it('should return true for pending', () => {
      expect(Status.pending().isActive()).toBe(true);
    });

    it('should return true for in-progress', () => {
      expect(Status.inProgress().isActive()).toBe(true);
    });

    it('should return false for done', () => {
      expect(Status.done().isActive()).toBe(false);
    });

    it('should return false for archived', () => {
      expect(Status.archived().isActive()).toBe(false);
    });
  });

  describe('isComplete', () => {
    it('should return false for pending', () => {
      expect(Status.pending().isComplete()).toBe(false);
    });

    it('should return false for in-progress', () => {
      expect(Status.inProgress().isComplete()).toBe(false);
    });

    it('should return true for done', () => {
      expect(Status.done().isComplete()).toBe(true);
    });

    it('should return true for archived', () => {
      expect(Status.archived().isComplete()).toBe(true);
    });
  });

  describe('transitions', () => {
    it('should allow pending -> in-progress', () => {
      expect(Status.pending().canTransitionTo(Status.inProgress())).toBe(true);
    });

    it('should allow pending -> done', () => {
      expect(Status.pending().canTransitionTo(Status.done())).toBe(true);
    });

    it('should allow pending -> archived', () => {
      expect(Status.pending().canTransitionTo(Status.archived())).toBe(true);
    });

    it('should allow in-progress -> pending', () => {
      expect(Status.inProgress().canTransitionTo(Status.pending())).toBe(true);
    });

    it('should allow in-progress -> done', () => {
      expect(Status.inProgress().canTransitionTo(Status.done())).toBe(true);
    });

    it('should allow in-progress -> archived', () => {
      expect(Status.inProgress().canTransitionTo(Status.archived())).toBe(true);
    });

    it('should allow done -> archived', () => {
      expect(Status.done().canTransitionTo(Status.archived())).toBe(true);
    });

    it('should not allow done -> pending', () => {
      expect(Status.done().canTransitionTo(Status.pending())).toBe(false);
    });

    it('should not allow done -> in-progress', () => {
      expect(Status.done().canTransitionTo(Status.inProgress())).toBe(false);
    });

    it('should not allow archived -> any', () => {
      expect(Status.archived().canTransitionTo(Status.pending())).toBe(false);
      expect(Status.archived().canTransitionTo(Status.inProgress())).toBe(false);
      expect(Status.archived().canTransitionTo(Status.done())).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      const a = Status.pending();
      const b = Status.pending();
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different values', () => {
      const a = Status.pending();
      const b = Status.done();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(Status.pending().toString()).toBe('pending');
      expect(Status.inProgress().toString()).toBe('in-progress');
    });

    it('should convert to JSON', () => {
      expect(Status.pending().toJSON()).toBe('pending');
      expect(JSON.stringify({ status: Status.pending() })).toBe('{"status":"pending"}');
    });
  });
});
