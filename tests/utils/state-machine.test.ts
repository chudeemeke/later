import { describe, it, expect } from '@jest/globals';
import {
  validateTransition,
  getValidTransitions,
  getTransitionError,
  STATE_MACHINE,
  type ItemStatus,
} from '../../src/utils/state-machine.js';

describe('State Machine Utility', () => {
  describe('STATE_MACHINE', () => {
    it('should define valid transitions for all statuses', () => {
      expect(STATE_MACHINE.pending).toBeDefined();
      expect(STATE_MACHINE['in-progress']).toBeDefined();
      expect(STATE_MACHINE.done).toBeDefined();
      expect(STATE_MACHINE.archived).toBeDefined();
    });

    it('should have transitions as arrays', () => {
      expect(Array.isArray(STATE_MACHINE.pending)).toBe(true);
      expect(Array.isArray(STATE_MACHINE['in-progress'])).toBe(true);
      expect(Array.isArray(STATE_MACHINE.done)).toBe(true);
      expect(Array.isArray(STATE_MACHINE.archived)).toBe(true);
    });
  });

  describe('validateTransition', () => {
    describe('from pending', () => {
      it('should allow pending → in-progress', () => {
        expect(validateTransition('pending', 'in-progress')).toBe(true);
      });

      it('should allow pending → archived', () => {
        expect(validateTransition('pending', 'archived')).toBe(true);
      });

      it('should not allow pending → done', () => {
        expect(validateTransition('pending', 'done')).toBe(false);
      });

      it('should allow pending → pending (no-op)', () => {
        expect(validateTransition('pending', 'pending')).toBe(true);
      });
    });

    describe('from in-progress', () => {
      it('should allow in-progress → done', () => {
        expect(validateTransition('in-progress', 'done')).toBe(true);
      });

      it('should allow in-progress → pending (rollback)', () => {
        expect(validateTransition('in-progress', 'pending')).toBe(true);
      });

      it('should allow in-progress → archived', () => {
        expect(validateTransition('in-progress', 'archived')).toBe(true);
      });

      it('should allow in-progress → in-progress (no-op)', () => {
        expect(validateTransition('in-progress', 'in-progress')).toBe(true);
      });
    });

    describe('from done', () => {
      it('should allow done → archived', () => {
        expect(validateTransition('done', 'archived')).toBe(true);
      });

      it('should not allow done → pending', () => {
        expect(validateTransition('done', 'pending')).toBe(false);
      });

      it('should not allow done → in-progress', () => {
        expect(validateTransition('done', 'in-progress')).toBe(false);
      });

      it('should allow done → done (no-op)', () => {
        expect(validateTransition('done', 'done')).toBe(true);
      });
    });

    describe('from archived', () => {
      it('should allow archived → pending (restore)', () => {
        expect(validateTransition('archived', 'pending')).toBe(true);
      });

      it('should not allow archived → in-progress', () => {
        expect(validateTransition('archived', 'in-progress')).toBe(false);
      });

      it('should not allow archived → done', () => {
        expect(validateTransition('archived', 'done')).toBe(false);
      });

      it('should allow archived → archived (no-op)', () => {
        expect(validateTransition('archived', 'archived')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle invalid from status', () => {
        expect(validateTransition('invalid' as ItemStatus, 'pending')).toBe(false);
      });

      it('should handle invalid to status', () => {
        expect(validateTransition('pending', 'invalid' as ItemStatus)).toBe(false);
      });

      it('should handle both invalid statuses', () => {
        expect(validateTransition('invalid' as ItemStatus, 'also-invalid' as ItemStatus)).toBe(
          false
        );
      });

      it('should be case-sensitive', () => {
        expect(validateTransition('Pending' as ItemStatus, 'in-progress')).toBe(false);
        expect(validateTransition('pending', 'In-Progress' as ItemStatus)).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for pending', () => {
      const transitions = getValidTransitions('pending');
      expect(transitions).toContain('in-progress');
      expect(transitions).toContain('archived');
      expect(transitions).toContain('pending');
      expect(transitions).not.toContain('done');
    });

    it('should return valid transitions for in-progress', () => {
      const transitions = getValidTransitions('in-progress');
      expect(transitions).toContain('done');
      expect(transitions).toContain('pending');
      expect(transitions).toContain('archived');
      expect(transitions).toContain('in-progress');
    });

    it('should return valid transitions for done', () => {
      const transitions = getValidTransitions('done');
      expect(transitions).toContain('archived');
      expect(transitions).toContain('done');
      expect(transitions.length).toBe(2);
    });

    it('should return valid transitions for archived', () => {
      const transitions = getValidTransitions('archived');
      expect(transitions).toContain('pending');
      expect(transitions).toContain('archived');
      expect(transitions.length).toBe(2);
    });

    it('should return empty array for invalid status', () => {
      const transitions = getValidTransitions('invalid' as ItemStatus);
      expect(transitions).toEqual([]);
    });
  });

  describe('workflow scenarios', () => {
    it('should support typical workflow: pending → in-progress → done → archived', () => {
      expect(validateTransition('pending', 'in-progress')).toBe(true);
      expect(validateTransition('in-progress', 'done')).toBe(true);
      expect(validateTransition('done', 'archived')).toBe(true);
    });

    it('should support quick archive: pending → archived', () => {
      expect(validateTransition('pending', 'archived')).toBe(true);
    });

    it('should support rollback: in-progress → pending', () => {
      expect(validateTransition('in-progress', 'pending')).toBe(true);
    });

    it('should support restore: archived → pending', () => {
      expect(validateTransition('archived', 'pending')).toBe(true);
    });

    it('should prevent skipping work: pending → done', () => {
      expect(validateTransition('pending', 'done')).toBe(false);
    });

    it('should prevent reopening done items: done → in-progress', () => {
      expect(validateTransition('done', 'in-progress')).toBe(false);
    });
  });

  describe('state machine properties', () => {
    it('should allow all states to stay in same state (idempotency)', () => {
      const statuses: ItemStatus[] = ['pending', 'in-progress', 'done', 'archived'];

      for (const status of statuses) {
        expect(validateTransition(status, status)).toBe(true);
      }
    });

    it('should have at least one valid transition from each state', () => {
      const statuses: ItemStatus[] = ['pending', 'in-progress', 'done', 'archived'];

      for (const status of statuses) {
        const transitions = getValidTransitions(status);
        expect(transitions.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should only allow archived to transition to pending or archived', () => {
      const transitions = getValidTransitions('archived');
      expect(transitions).toEqual(expect.arrayContaining(['pending', 'archived']));
      expect(transitions).not.toContain('in-progress');
      expect(transitions).not.toContain('done');
    });

    it('should only allow done to transition to archived or done', () => {
      const transitions = getValidTransitions('done');
      expect(transitions).toEqual(expect.arrayContaining(['archived', 'done']));
      expect(transitions).not.toContain('pending');
      expect(transitions).not.toContain('in-progress');
    });
  });

  describe('documentation examples', () => {
    it('example: user captures item, works on it, completes it', () => {
      let status: ItemStatus = 'pending';

      // Start working
      expect(validateTransition(status, 'in-progress')).toBe(true);
      status = 'in-progress';

      // Complete work
      expect(validateTransition(status, 'done')).toBe(true);
      status = 'done';

      // Archive after some time
      expect(validateTransition(status, 'archived')).toBe(true);
    });

    it('example: user captures item but decides to archive immediately', () => {
      const status: ItemStatus = 'pending';
      expect(validateTransition(status, 'archived')).toBe(true);
    });

    it('example: user starts work but decides to defer again', () => {
      let status: ItemStatus = 'in-progress';
      expect(validateTransition(status, 'pending')).toBe(true);
    });

    it('example: user tries to mark pending as done without working on it', () => {
      const status: ItemStatus = 'pending';
      expect(validateTransition(status, 'done')).toBe(false);
    });
  });

  describe('getTransitionError', () => {
    it('should return error message for invalid transition', () => {
      const error = getTransitionError('pending', 'done');
      expect(error).toContain('Cannot transition');
      expect(error).toContain('pending');
      expect(error).toContain('done');
    });

    it('should return empty string for valid transition', () => {
      const error = getTransitionError('pending', 'in-progress');
      expect(error).toBe('');
    });

    it('should return error for invalid from status', () => {
      const error = getTransitionError('invalid' as ItemStatus, 'pending');
      expect(error).toContain('Invalid status');
    });
  });
});
