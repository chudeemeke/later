import { describe, it, expect } from '@jest/globals';
import { GitLink } from '../../../src/domain/entities/GitLink.js';

describe('GitLink Entity', () => {
  describe('creation', () => {
    it('should create git link with required fields', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc123def456789',
      });

      expect(link.id).toBe(1);
      expect(link.itemId.value).toBe(10);
      expect(link.commitHash).toBe('abc123def456789');
    });

    it('should create git link with all fields', () => {
      const commitDate = new Date('2024-01-15');
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc123def456789',
        commitMessage: 'Fix bug later:#10',
        commitDate,
        repoPath: '/path/to/repo',
      });

      expect(link.commitMessage).toBe('Fix bug later:#10');
      expect(link.commitDate).toEqual(commitDate);
      expect(link.repoPath).toBe('/path/to/repo');
    });

    it('should lowercase commit hash', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'ABC123DEF',
      });

      expect(link.commitHash).toBe('abc123def');
    });

    it('should throw on empty commit hash', () => {
      expect(() =>
        GitLink.create({ id: 1, itemId: 10, commitHash: '' })
      ).toThrow('Commit hash cannot be empty');
    });

    it('should set detectedAt on creation', () => {
      const before = new Date();
      const link = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const after = new Date();

      expect(link.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(link.detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('extractItemIds', () => {
    it('should extract later:#123 format', () => {
      const ids = GitLink.extractItemIds('Fix bug later:#42');
      expect(ids).toEqual([42]);
    });

    it('should extract later:123 format (no hash)', () => {
      const ids = GitLink.extractItemIds('Fix bug later:42');
      expect(ids).toEqual([42]);
    });

    it('should extract resolves-later:123 format', () => {
      const ids = GitLink.extractItemIds('resolves-later:99 completed');
      expect(ids).toEqual([99]);
    });

    it('should extract multiple IDs', () => {
      const ids = GitLink.extractItemIds('Fix later:#1 and later:#2, resolves-later:3');
      expect(ids).toEqual([1, 2, 3]);
    });

    it('should not include duplicates', () => {
      const ids = GitLink.extractItemIds('later:#5 later:#5 later:#5');
      expect(ids).toEqual([5]);
    });

    it('should return empty array for no matches', () => {
      const ids = GitLink.extractItemIds('Regular commit message');
      expect(ids).toEqual([]);
    });

    it('should be case insensitive', () => {
      const ids = GitLink.extractItemIds('LATER:#1 Later:#2 later:#3');
      expect(ids).toEqual([1, 2, 3]);
    });
  });

  describe('containsLaterTag', () => {
    it('should detect later tag', () => {
      expect(GitLink.containsLaterTag('Fix later:#1')).toBe(true);
    });

    it('should detect resolves-later tag', () => {
      expect(GitLink.containsLaterTag('resolves-later:5')).toBe(true);
    });

    it('should return false for no tags', () => {
      expect(GitLink.containsLaterTag('Normal commit')).toBe(false);
    });
  });

  describe('shortHash', () => {
    it('should return first 7 characters', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abcdefghijklmnop',
      });

      expect(link.shortHash()).toBe('abcdefg');
    });

    it('should handle short hashes', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc',
      });

      expect(link.shortHash()).toBe('abc');
    });
  });

  describe('equality', () => {
    it('should be equal for same item and commit', () => {
      const link1 = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const link2 = GitLink.create({ id: 2, itemId: 10, commitHash: 'abc123' });

      expect(link1.equals(link2)).toBe(true);
    });

    it('should not be equal for different items', () => {
      const link1 = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const link2 = GitLink.create({ id: 1, itemId: 11, commitHash: 'abc123' });

      expect(link1.equals(link2)).toBe(false);
    });

    it('should not be equal for different commits', () => {
      const link1 = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const link2 = GitLink.create({ id: 1, itemId: 10, commitHash: 'def456' });

      expect(link1.equals(link2)).toBe(false);
    });
  });

  describe('sameCommit', () => {
    it('should detect same commit', () => {
      const link1 = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const link2 = GitLink.create({ id: 2, itemId: 20, commitHash: 'abc123' });

      expect(link1.sameCommit(link2)).toBe(true);
    });

    it('should detect different commits', () => {
      const link1 = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      const link2 = GitLink.create({ id: 1, itemId: 10, commitHash: 'def456' });

      expect(link1.sameCommit(link2)).toBe(false);
    });
  });

  describe('key generation', () => {
    it('should generate composite key', () => {
      const link = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      expect(link.getKey()).toBe('10-abc123');
    });
  });

  describe('daysSinceCommit', () => {
    it('should return undefined when no commit date', () => {
      const link = GitLink.create({ id: 1, itemId: 10, commitHash: 'abc123' });
      expect(link.daysSinceCommit()).toBeUndefined();
    });

    it('should calculate days since commit', () => {
      const commitDate = new Date();
      commitDate.setDate(commitDate.getDate() - 5);

      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc123',
        commitDate,
      });

      expect(link.daysSinceCommit()).toBe(5);
    });
  });

  describe('serialization', () => {
    it('should convert to props', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc123',
        commitMessage: 'Test',
        repoPath: '/repo',
      });

      const props = link.toProps();

      expect(props.id).toBe(1);
      expect(props.itemId).toBe(10);
      expect(props.commitHash).toBe('abc123');
      expect(props.commitMessage).toBe('Test');
      expect(props.repoPath).toBe('/repo');
    });

    it('should convert to JSON', () => {
      const link = GitLink.create({
        id: 1,
        itemId: 10,
        commitHash: 'abc123',
      });

      const json = link.toJSON();

      expect(json.id).toBe(1);
      expect(json.item_id).toBe(10);
      expect(json.commit_hash).toBe('abc123');
      expect(typeof json.detected_at).toBe('string');
    });

    it('should reconstitute from props', () => {
      const props = {
        id: 1,
        itemId: 10,
        commitHash: 'abc123',
        commitMessage: 'Test later:#10',
        commitDate: new Date('2024-01-01'),
        repoPath: '/repo',
        detectedAt: new Date('2024-01-02'),
      };

      const link = GitLink.fromProps(props);

      expect(link.id).toBe(1);
      expect(link.commitMessage).toBe('Test later:#10');
      expect(link.detectedAt.getTime()).toBe(props.detectedAt.getTime());
    });
  });
});
