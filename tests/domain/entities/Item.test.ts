import { describe, it, expect } from '@jest/globals';
import { Item } from '../../../src/domain/entities/Item.js';
import { Status } from '../../../src/domain/value-objects/Status.js';
import { Priority } from '../../../src/domain/value-objects/Priority.js';

describe('Item Entity', () => {
  describe('creation', () => {
    it('should create item with required fields', () => {
      const item = Item.create(1, { decision: 'Test decision' });

      expect(item.id.value).toBe(1);
      expect(item.decision).toBe('Test decision');
      expect(item.context).toBe('');
      expect(item.status.value).toBe('pending');
      expect(item.priority.value).toBe('medium');
      expect(item.tags).toEqual([]);
      expect(item.dependencies).toEqual([]);
    });

    it('should create item with all fields', () => {
      const item = Item.create(1, {
        decision: 'Full decision',
        context: 'Some context',
        tags: ['tag1', 'tag2'],
        priority: 'high',
        conversationId: 'conv-123',
        dependencies: [2, 3],
      });

      expect(item.decision).toBe('Full decision');
      expect(item.context).toBe('Some context');
      expect(item.tags).toEqual(['tag1', 'tag2']);
      expect(item.priority.value).toBe('high');
      expect(item.conversationId).toBe('conv-123');
      expect(item.dependencies).toEqual([2, 3]);
    });

    it('should trim decision whitespace', () => {
      const item = Item.create(1, { decision: '  trimmed  ' });
      expect(item.decision).toBe('trimmed');
    });

    it('should throw on empty decision', () => {
      expect(() => Item.create(1, { decision: '' })).toThrow('Decision cannot be empty');
    });

    it('should throw on whitespace-only decision', () => {
      expect(() => Item.create(1, { decision: '   ' })).toThrow('Decision cannot be empty');
    });

    it('should set timestamps on creation', () => {
      const before = new Date();
      const item = Item.create(1, { decision: 'Test' });
      const after = new Date();

      expect(item.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(item.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(item.updatedAt.getTime()).toBe(item.createdAt.getTime());
    });
  });

  describe('status transitions', () => {
    it('should transition from pending to in-progress', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.start();
      expect(item.status.value).toBe('in-progress');
    });

    it('should transition from pending to done', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.complete();
      expect(item.status.value).toBe('done');
    });

    it('should transition from in-progress to done', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.start();
      item.complete();
      expect(item.status.value).toBe('done');
    });

    it('should transition from done to archived', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.complete();
      item.archive();
      expect(item.status.value).toBe('archived');
    });

    it('should throw on invalid transition from done to pending', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.complete();
      expect(() => item.transitionTo(Status.pending())).toThrow(
        'Cannot transition from done to pending'
      );
    });

    it('should throw on invalid transition from archived', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.complete();
      item.archive();
      expect(() => item.start()).toThrow('Cannot transition from archived to in-progress');
    });

    it('should update timestamp on status change', () => {
      const item = Item.create(1, { decision: 'Test' });
      const originalUpdate = item.updatedAt;

      // Small delay to ensure timestamp difference
      item.start();

      expect(item.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdate.getTime());
    });
  });

  describe('priority management', () => {
    it('should update priority', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.setPriority(Priority.high());
      expect(item.priority.value).toBe('high');
    });

    it('should update timestamp on priority change', () => {
      const item = Item.create(1, { decision: 'Test' });
      const original = item.updatedAt;
      item.setPriority(Priority.low());
      expect(item.updatedAt.getTime()).toBeGreaterThanOrEqual(original.getTime());
    });
  });

  describe('tag management', () => {
    it('should add tag', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.addTag('newtag');
      expect(item.tags).toContain('newtag');
    });

    it('should normalize tags to lowercase', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.addTag('UpperCase');
      expect(item.tags).toContain('uppercase');
    });

    it('should not add duplicate tags', () => {
      const item = Item.create(1, { decision: 'Test', tags: ['existing'] });
      item.addTag('existing');
      expect(item.tags.filter(t => t === 'existing')).toHaveLength(1);
    });

    it('should remove tag', () => {
      const item = Item.create(1, { decision: 'Test', tags: ['remove-me', 'keep'] });
      item.removeTag('remove-me');
      expect(item.tags).not.toContain('remove-me');
      expect(item.tags).toContain('keep');
    });

    it('should set all tags', () => {
      const item = Item.create(1, { decision: 'Test', tags: ['old'] });
      item.setTags(['new1', 'new2']);
      expect(item.tags).toEqual(['new1', 'new2']);
    });

    it('should check if has tag', () => {
      const item = Item.create(1, { decision: 'Test', tags: ['mytag'] });
      expect(item.hasTag('mytag')).toBe(true);
      expect(item.hasTag('other')).toBe(false);
    });
  });

  describe('dependency management', () => {
    it('should add dependency', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.addDependency(2);
      expect(item.dependencies).toContain(2);
    });

    it('should not add duplicate dependencies', () => {
      const item = Item.create(1, { decision: 'Test', dependencies: [2] });
      item.addDependency(2);
      expect(item.dependencies.filter(d => d === 2)).toHaveLength(1);
    });

    it('should throw when adding self-dependency', () => {
      const item = Item.create(1, { decision: 'Test' });
      expect(() => item.addDependency(1)).toThrow('Item cannot depend on itself');
    });

    it('should remove dependency', () => {
      const item = Item.create(1, { decision: 'Test', dependencies: [2, 3] });
      item.removeDependency(2);
      expect(item.dependencies).not.toContain(2);
      expect(item.dependencies).toContain(3);
    });

    it('should check if has dependencies', () => {
      const itemWithDeps = Item.create(1, { decision: 'Test', dependencies: [2] });
      const itemWithoutDeps = Item.create(2, { decision: 'Test' });

      expect(itemWithDeps.hasDependencies()).toBe(true);
      expect(itemWithoutDeps.hasDependencies()).toBe(false);
    });
  });

  describe('context management', () => {
    it('should update context', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.updateContext('new context', 'hash123', ['file.ts']);

      expect(item.context).toBe('new context');
      expect(item.contextHash).toBe('hash123');
      expect(item.contextFiles).toEqual(['file.ts']);
    });

    it('should set context tokenization', () => {
      const item = Item.create(1, { decision: 'Test' });
      item.setContextTokenization(
        { tok1: 'value1' },
        { email: 2 }
      );

      expect(item.contextTokens).toEqual({ tok1: 'value1' });
      expect(item.contextPiiTypes).toEqual({ email: 2 });
    });
  });

  describe('activity checks', () => {
    it('should identify active items', () => {
      const pending = Item.create(1, { decision: 'Test' });
      const inProgress = Item.create(2, { decision: 'Test' });
      inProgress.start();

      expect(pending.isActive()).toBe(true);
      expect(inProgress.isActive()).toBe(true);
    });

    it('should identify complete items', () => {
      const done = Item.create(1, { decision: 'Test' });
      done.complete();
      const archived = Item.create(2, { decision: 'Test' });
      archived.complete();
      archived.archive();

      expect(done.isComplete()).toBe(true);
      expect(archived.isComplete()).toBe(true);
    });
  });

  describe('staleness', () => {
    it('should calculate days since creation', () => {
      const item = Item.create(1, { decision: 'Test' });
      // Just created, so 0 days
      expect(item.daysSinceCreation()).toBe(0);
    });

    it('should calculate days since update', () => {
      const item = Item.create(1, { decision: 'Test' });
      expect(item.daysSinceUpdate()).toBe(0);
    });

    it('should detect stale items', () => {
      const item = Item.create(1, { decision: 'Test' });
      // Just created, not stale
      expect(item.isStale(30)).toBe(false);
      expect(item.isStale(0)).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should convert to props', () => {
      const item = Item.create(1, {
        decision: 'Test',
        context: 'Context',
        tags: ['tag1'],
        priority: 'high',
      });

      const props = item.toProps();

      expect(props.id).toBe(1);
      expect(props.decision).toBe('Test');
      expect(props.context).toBe('Context');
      expect(props.tags).toEqual(['tag1']);
      expect(props.priority).toBe('high');
      expect(props.status).toBe('pending');
    });

    it('should convert to JSON', () => {
      const item = Item.create(1, { decision: 'Test' });
      const json = item.toJSON();

      expect(json.id).toBe(1);
      expect(json.decision).toBe('Test');
      expect(json.status).toBe('pending');
      expect(typeof json.created_at).toBe('string');
      expect(typeof json.updated_at).toBe('string');
    });

    it('should reconstitute from props', () => {
      const props = {
        id: 1,
        decision: 'Reconstituted',
        context: 'Context',
        status: 'in-progress' as const,
        tags: ['tag'],
        priority: 'high' as const,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const item = Item.fromProps(props);

      expect(item.id.value).toBe(1);
      expect(item.decision).toBe('Reconstituted');
      expect(item.status.value).toBe('in-progress');
      expect(item.createdAt.getTime()).toBe(props.createdAt.getTime());
    });
  });
});
