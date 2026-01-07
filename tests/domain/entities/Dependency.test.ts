import { describe, it, expect } from '@jest/globals';
import { Dependency } from '../../../src/domain/entities/Dependency.js';

describe('Dependency Entity', () => {
  describe('creation', () => {
    it('should create dependency with default type', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2 });

      expect(dep.itemId.value).toBe(1);
      expect(dep.dependsOnId.value).toBe(2);
      expect(dep.type.value).toBe('blocks');
    });

    it('should create dependency with specified type', () => {
      const dep = Dependency.create({
        itemId: 1,
        dependsOnId: 2,
        type: 'relates-to',
      });

      expect(dep.type.value).toBe('relates-to');
    });

    it('should throw on self-dependency', () => {
      expect(() =>
        Dependency.create({ itemId: 1, dependsOnId: 1 })
      ).toThrow('Item cannot depend on itself');
    });

    it('should set createdAt on creation', () => {
      const before = new Date();
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const after = new Date();

      expect(dep.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(dep.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('type predicates', () => {
    it('should identify blocking dependency', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });

      expect(dep.isBlocking()).toBe(true);
      expect(dep.isInformational()).toBe(false);
      expect(dep.isHierarchical()).toBe(false);
    });

    it('should identify informational dependency (relates-to)', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'relates-to' });

      expect(dep.isBlocking()).toBe(false);
      expect(dep.isInformational()).toBe(true);
      expect(dep.isHierarchical()).toBe(false);
    });

    it('should identify informational dependency (duplicates)', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'duplicates' });

      expect(dep.isBlocking()).toBe(false);
      expect(dep.isInformational()).toBe(true);
      expect(dep.isHierarchical()).toBe(false);
    });

    it('should identify hierarchical dependency', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'parent-of' });

      expect(dep.isBlocking()).toBe(false);
      expect(dep.isInformational()).toBe(false);
      expect(dep.isHierarchical()).toBe(true);
    });
  });

  describe('cycle detection requirement', () => {
    it('should require cycle detection for blocks', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      expect(dep.requiresCycleDetection()).toBe(true);
    });

    it('should require cycle detection for parent-of', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'parent-of' });
      expect(dep.requiresCycleDetection()).toBe(true);
    });

    it('should not require cycle detection for relates-to', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'relates-to' });
      expect(dep.requiresCycleDetection()).toBe(false);
    });

    it('should not require cycle detection for duplicates', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'duplicates' });
      expect(dep.requiresCycleDetection()).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same items and type', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const dep2 = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });

      expect(dep1.equals(dep2)).toBe(true);
    });

    it('should not be equal for different types', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const dep2 = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'relates-to' });

      expect(dep1.equals(dep2)).toBe(false);
    });

    it('should not be equal for different items', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const dep2 = Dependency.create({ itemId: 1, dependsOnId: 3 });

      expect(dep1.equals(dep2)).toBe(false);
    });
  });

  describe('sameItems', () => {
    it('should detect same items in same direction', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const dep2 = Dependency.create({ itemId: 1, dependsOnId: 2 });

      expect(dep1.sameItems(dep2)).toBe(true);
    });

    it('should detect same items in reverse direction', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const dep2 = Dependency.create({ itemId: 2, dependsOnId: 1 });

      expect(dep1.sameItems(dep2)).toBe(true);
    });

    it('should not match different items', () => {
      const dep1 = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const dep2 = Dependency.create({ itemId: 1, dependsOnId: 3 });

      expect(dep1.sameItems(dep2)).toBe(false);
    });
  });

  describe('key generation', () => {
    it('should generate composite key', () => {
      const dep = Dependency.create({ itemId: 5, dependsOnId: 10 });
      expect(dep.getKey()).toBe('5-10');
    });
  });

  describe('serialization', () => {
    it('should convert to props', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2, type: 'blocks' });
      const props = dep.toProps();

      expect(props.itemId).toBe(1);
      expect(props.dependsOnId).toBe(2);
      expect(props.type).toBe('blocks');
      expect(props.createdAt).toBeInstanceOf(Date);
    });

    it('should convert to JSON', () => {
      const dep = Dependency.create({ itemId: 1, dependsOnId: 2 });
      const json = dep.toJSON();

      expect(json.item_id).toBe(1);
      expect(json.depends_on_id).toBe(2);
      expect(json.dep_type).toBe('blocks');
      expect(typeof json.created_at).toBe('string');
    });

    it('should reconstitute from props', () => {
      const props = {
        itemId: 1,
        dependsOnId: 2,
        type: 'relates-to' as const,
        createdAt: new Date('2024-01-01'),
      };

      const dep = Dependency.fromProps(props);

      expect(dep.itemId.value).toBe(1);
      expect(dep.dependsOnId.value).toBe(2);
      expect(dep.type.value).toBe('relates-to');
      expect(dep.createdAt.getTime()).toBe(props.createdAt.getTime());
    });
  });
});
