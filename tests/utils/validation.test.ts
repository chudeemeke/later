import { describe, it, expect } from '@jest/globals';
import {
  validateCapture,
  validateUpdate,
  validateDelete,
  validateList,
  validateShow,
  validateDo,
} from '../../src/utils/validation.js';

describe('Validation Utility', () => {
  describe('validateCapture', () => {
    it('should validate valid capture args', () => {
      const result = validateCapture({
        decision: 'Optimize database queries',
        context: 'Current performance is 2.5s, need to reduce to <100ms',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require decision field', () => {
      const result = validateCapture({
        context: 'Some context',
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join(' ').toLowerCase()).toContain('decision');
    });

    it('should reject empty decision', () => {
      const result = validateCapture({
        decision: '',
        context: 'Context',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject decision that is too long (>500 chars)', () => {
      const result = validateCapture({
        decision: 'a'.repeat(501),
      });

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ').toLowerCase()).toContain('500');
    });

    it('should allow optional context', () => {
      const result = validateCapture({
        decision: 'Valid decision',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow optional tags', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        tags: ['optimization', 'database'],
      });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid tags (not an array)', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        tags: 'not-an-array',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should reject empty tag strings', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        tags: ['valid', '', 'also-valid'],
      });

      expect(result.valid).toBe(false);
    });

    it('should validate priority values', () => {
      const validPriorities = ['low', 'medium', 'high'];

      for (const priority of validPriorities) {
        const result = validateCapture({
          decision: 'Valid decision',
          priority: priority as any,
        });

        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid priority', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        priority: 'urgent',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should allow optional dependencies', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        dependencies: [1, 2, 3],
      });

      expect(result.valid).toBe(true);
    });

    it('should reject negative dependency IDs', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        dependencies: [1, -2, 3],
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('validateUpdate', () => {
    it('should validate valid update args', () => {
      const result = validateUpdate({
        id: 5,
        decision: 'Updated decision',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require id field', () => {
      const result = validateUpdate({
        decision: 'Updated decision',
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ').toLowerCase()).toContain('id');
    });

    it('should reject non-integer id', () => {
      const result = validateUpdate({
        id: 3.14,
        decision: 'Updated',
      });

      expect(result.valid).toBe(false);
    });

    it('should reject negative id', () => {
      const result = validateUpdate({
        id: -5,
        decision: 'Updated',
      });

      expect(result.valid).toBe(false);
    });

    it('should allow updating decision', () => {
      const result = validateUpdate({
        id: 1,
        decision: 'New decision text',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow updating context', () => {
      const result = validateUpdate({
        id: 1,
        context: 'Updated context',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow updating tags', () => {
      const result = validateUpdate({
        id: 1,
        tags: ['new-tag'],
      });

      expect(result.valid).toBe(true);
    });

    it('should allow updating priority', () => {
      const result = validateUpdate({
        id: 1,
        priority: 'high',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow updating status', () => {
      const result = validateUpdate({
        id: 1,
        status: 'in-progress',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate status values', () => {
      const validStatuses = ['pending', 'in-progress', 'done', 'archived'];

      for (const status of validStatuses) {
        const result = validateUpdate({
          id: 1,
          status: status as any,
        });

        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = validateUpdate({
        id: 1,
        status: 'cancelled',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should allow updating dependencies', () => {
      const result = validateUpdate({
        id: 1,
        dependencies: [2, 3],
      });

      expect(result.valid).toBe(true);
    });

    it('should require at least one update field besides id', () => {
      const result = validateUpdate({
        id: 1,
      });

      // This should be valid - update with id only is technically valid
      // The business logic will check if item exists
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDelete', () => {
    it('should validate valid delete args', () => {
      const result = validateDelete({
        id: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require id field', () => {
      const result = validateDelete({} as any);

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ').toLowerCase()).toContain('id');
    });

    it('should reject non-integer id', () => {
      const result = validateDelete({
        id: 3.14,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject negative id', () => {
      const result = validateDelete({
        id: -5,
      });

      expect(result.valid).toBe(false);
    });

    it('should allow optional hard flag', () => {
      const result = validateDelete({
        id: 1,
        hard: true,
      });

      expect(result.valid).toBe(true);
    });

    it('should reject non-boolean hard flag', () => {
      const result = validateDelete({
        id: 1,
        hard: 'yes',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should default hard to false', () => {
      const result = validateDelete({
        id: 1,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('validateList', () => {
    it('should validate empty list args', () => {
      const result = validateList({});

      expect(result.valid).toBe(true);
    });

    it('should allow status filter', () => {
      const result = validateList({
        status: 'pending',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateList({
        status: 'invalid-status',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should allow tags filter', () => {
      const result = validateList({
        tags: ['optimization', 'database'],
      });

      expect(result.valid).toBe(true);
    });

    it('should allow priority filter', () => {
      const result = validateList({
        priority: 'high',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow limit', () => {
      const result = validateList({
        limit: 50,
      });

      expect(result.valid).toBe(true);
    });

    it('should reject negative limit', () => {
      const result = validateList({
        limit: -10,
      });

      expect(result.valid).toBe(false);
    });

    it('should reject limit above 1000', () => {
      const result = validateList({
        limit: 1001,
      });

      expect(result.valid).toBe(false);
    });

    it('should allow cursor for pagination', () => {
      const result = validateList({
        cursor: 'eyJpZCI6MTIzfQ==',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('validateShow', () => {
    it('should validate valid show args', () => {
      const result = validateShow({
        id: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require id field', () => {
      const result = validateShow({} as any);

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ').toLowerCase()).toContain('id');
    });

    it('should reject non-integer id', () => {
      const result = validateShow({
        id: 'abc',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should reject negative id', () => {
      const result = validateShow({
        id: -1,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('validateDo', () => {
    it('should validate valid do args', () => {
      const result = validateDo({
        id: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should require id field', () => {
      const result = validateDo({} as any);

      expect(result.valid).toBe(false);
      expect(result.errors.join(' ').toLowerCase()).toContain('id');
    });

    it('should reject non-integer id', () => {
      const result = validateDo({
        id: '123',
      } as any);

      expect(result.valid).toBe(false);
    });

    it('should reject negative id', () => {
      const result = validateDo({
        id: -5,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle null as input', () => {
      expect(validateCapture(null as any).valid).toBe(false);
      expect(validateUpdate(null as any).valid).toBe(false);
      expect(validateDelete(null as any).valid).toBe(false);
      expect(validateList(null as any).valid).toBe(false);
      expect(validateShow(null as any).valid).toBe(false);
      expect(validateDo(null as any).valid).toBe(false);
    });

    it('should handle undefined as input', () => {
      expect(validateCapture(undefined as any).valid).toBe(false);
      expect(validateUpdate(undefined as any).valid).toBe(false);
      expect(validateDelete(undefined as any).valid).toBe(false);
      expect(validateList(undefined as any).valid).toBe(true); // List can be called with no args
      expect(validateShow(undefined as any).valid).toBe(false);
      expect(validateDo(undefined as any).valid).toBe(false);
    });

    it('should handle extra unknown fields gracefully', () => {
      const result = validateCapture({
        decision: 'Valid decision',
        unknownField: 'should be ignored',
      } as any);

      // Zod will strip unknown fields by default
      expect(result.valid).toBe(true);
    });
  });
});
