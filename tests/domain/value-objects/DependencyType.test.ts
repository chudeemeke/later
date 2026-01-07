import { describe, it, expect } from '@jest/globals';
import { DependencyType, VALID_DEPENDENCY_TYPES } from '../../../src/domain/value-objects/DependencyType.js';

describe('DependencyType Value Object', () => {
  describe('creation', () => {
    it('should create dependency type from valid string', () => {
      const depType = DependencyType.create('blocks');
      expect(depType.value).toBe('blocks');
    });

    it('should throw on invalid dependency type', () => {
      expect(() => DependencyType.create('depends')).toThrow('Invalid dependency type: depends');
    });

    it('should throw on empty string', () => {
      expect(() => DependencyType.create('')).toThrow('Invalid dependency type:');
    });

    it('should create all valid dependency types', () => {
      for (const value of VALID_DEPENDENCY_TYPES) {
        const depType = DependencyType.create(value);
        expect(depType.value).toBe(value);
      }
    });
  });

  describe('factory methods', () => {
    it('should create blocks type', () => {
      expect(DependencyType.blocks().value).toBe('blocks');
    });

    it('should create relates-to type', () => {
      expect(DependencyType.relatesTo().value).toBe('relates-to');
    });

    it('should create duplicates type', () => {
      expect(DependencyType.duplicates().value).toBe('duplicates');
    });

    it('should create parent-of type', () => {
      expect(DependencyType.parentOf().value).toBe('parent-of');
    });

    it('should create default as blocks', () => {
      expect(DependencyType.default().value).toBe('blocks');
    });
  });

  describe('validation', () => {
    it('should validate blocks as valid', () => {
      expect(DependencyType.isValid('blocks')).toBe(true);
    });

    it('should validate relates-to as valid', () => {
      expect(DependencyType.isValid('relates-to')).toBe(true);
    });

    it('should validate duplicates as valid', () => {
      expect(DependencyType.isValid('duplicates')).toBe(true);
    });

    it('should validate parent-of as valid', () => {
      expect(DependencyType.isValid('parent-of')).toBe(true);
    });

    it('should validate invalid string as invalid', () => {
      expect(DependencyType.isValid('child-of')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(DependencyType.isValid('Blocks')).toBe(false);
      expect(DependencyType.isValid('BLOCKS')).toBe(false);
    });
  });

  describe('isBlocking', () => {
    it('should return true for blocks', () => {
      expect(DependencyType.blocks().isBlocking()).toBe(true);
    });

    it('should return false for relates-to', () => {
      expect(DependencyType.relatesTo().isBlocking()).toBe(false);
    });

    it('should return false for duplicates', () => {
      expect(DependencyType.duplicates().isBlocking()).toBe(false);
    });

    it('should return false for parent-of', () => {
      expect(DependencyType.parentOf().isBlocking()).toBe(false);
    });
  });

  describe('isInformational', () => {
    it('should return false for blocks', () => {
      expect(DependencyType.blocks().isInformational()).toBe(false);
    });

    it('should return true for relates-to', () => {
      expect(DependencyType.relatesTo().isInformational()).toBe(true);
    });

    it('should return true for duplicates', () => {
      expect(DependencyType.duplicates().isInformational()).toBe(true);
    });

    it('should return false for parent-of', () => {
      expect(DependencyType.parentOf().isInformational()).toBe(false);
    });
  });

  describe('isHierarchical', () => {
    it('should return false for blocks', () => {
      expect(DependencyType.blocks().isHierarchical()).toBe(false);
    });

    it('should return false for relates-to', () => {
      expect(DependencyType.relatesTo().isHierarchical()).toBe(false);
    });

    it('should return false for duplicates', () => {
      expect(DependencyType.duplicates().isHierarchical()).toBe(false);
    });

    it('should return true for parent-of', () => {
      expect(DependencyType.parentOf().isHierarchical()).toBe(true);
    });
  });

  describe('requiresCycleDetection', () => {
    it('should return true for blocks', () => {
      expect(DependencyType.blocks().requiresCycleDetection()).toBe(true);
    });

    it('should return false for relates-to', () => {
      expect(DependencyType.relatesTo().requiresCycleDetection()).toBe(false);
    });

    it('should return false for duplicates', () => {
      expect(DependencyType.duplicates().requiresCycleDetection()).toBe(false);
    });

    it('should return true for parent-of', () => {
      expect(DependencyType.parentOf().requiresCycleDetection()).toBe(true);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      expect(DependencyType.blocks().equals(DependencyType.blocks())).toBe(true);
    });

    it('should not be equal for different values', () => {
      expect(DependencyType.blocks().equals(DependencyType.relatesTo())).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(DependencyType.blocks().toString()).toBe('blocks');
      expect(DependencyType.relatesTo().toString()).toBe('relates-to');
    });

    it('should convert to JSON', () => {
      expect(DependencyType.blocks().toJSON()).toBe('blocks');
      expect(JSON.stringify({ type: DependencyType.blocks() })).toBe('{"type":"blocks"}');
    });
  });
});
