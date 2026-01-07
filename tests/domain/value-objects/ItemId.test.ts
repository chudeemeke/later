import { describe, it, expect } from '@jest/globals';
import { ItemId } from '../../../src/domain/value-objects/ItemId.js';

describe('ItemId Value Object', () => {
  describe('creation', () => {
    it('should create ItemId from positive integer', () => {
      const id = ItemId.create(1);
      expect(id.value).toBe(1);
    });

    it('should create ItemId from large positive integer', () => {
      const id = ItemId.create(999999);
      expect(id.value).toBe(999999);
    });

    it('should throw on zero', () => {
      expect(() => ItemId.create(0)).toThrow('Invalid item ID: 0');
    });

    it('should throw on negative number', () => {
      expect(() => ItemId.create(-1)).toThrow('Invalid item ID: -1');
    });

    it('should throw on float', () => {
      expect(() => ItemId.create(1.5)).toThrow('Invalid item ID: 1.5');
    });

    it('should throw on NaN', () => {
      expect(() => ItemId.create(NaN)).toThrow('Invalid item ID: NaN');
    });

    it('should throw on Infinity', () => {
      expect(() => ItemId.create(Infinity)).toThrow('Invalid item ID: Infinity');
    });
  });

  describe('fromString', () => {
    it('should create ItemId from numeric string', () => {
      const id = ItemId.fromString('123');
      expect(id.value).toBe(123);
    });

    it('should throw on non-numeric string', () => {
      expect(() => ItemId.fromString('abc')).toThrow('Invalid item ID string: abc');
    });

    it('should throw on empty string', () => {
      expect(() => ItemId.fromString('')).toThrow('Invalid item ID string:');
    });

    it('should throw on zero string', () => {
      expect(() => ItemId.fromString('0')).toThrow('Invalid item ID: 0');
    });

    it('should throw on negative string', () => {
      expect(() => ItemId.fromString('-5')).toThrow('Invalid item ID: -5');
    });
  });

  describe('validation', () => {
    it('should validate positive integer', () => {
      expect(ItemId.isValid(1)).toBe(true);
      expect(ItemId.isValid(100)).toBe(true);
    });

    it('should not validate zero', () => {
      expect(ItemId.isValid(0)).toBe(false);
    });

    it('should not validate negative', () => {
      expect(ItemId.isValid(-1)).toBe(false);
    });

    it('should not validate float', () => {
      expect(ItemId.isValid(1.5)).toBe(false);
    });

    it('should not validate NaN', () => {
      expect(ItemId.isValid(NaN)).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same values', () => {
      const a = ItemId.create(42);
      const b = ItemId.create(42);
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different values', () => {
      const a = ItemId.create(42);
      const b = ItemId.create(43);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to string', () => {
      expect(ItemId.create(123).toString()).toBe('123');
    });

    it('should convert to JSON', () => {
      expect(ItemId.create(123).toJSON()).toBe(123);
      expect(JSON.stringify({ id: ItemId.create(123) })).toBe('{"id":123}');
    });

    it('should provide display string with hash', () => {
      expect(ItemId.create(123).toDisplayString()).toBe('#123');
    });
  });
});
