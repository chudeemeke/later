import {
  levenshteinDistance,
  extractKeywords,
  keywordOverlap,
  calculateSimilarity,
  findSimilarItems,
} from '../../src/utils/duplicate.js';
import type { DeferredItem } from '../../src/types.js';

describe('Duplicate Detection Utilities', () => {
  describe('levenshteinDistance', () => {
    test('returns 0 for identical strings', () => {
      const distance = levenshteinDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    test('calculates distance for single character difference', () => {
      const distance = levenshteinDistance('hello', 'hallo');
      expect(distance).toBe(1);
    });

    test('calculates distance for kitten to sitting example', () => {
      const distance = levenshteinDistance('kitten', 'sitting');
      expect(distance).toBe(3); // k→s, e→i, +g
    });

    test('handles empty strings', () => {
      const distance = levenshteinDistance('', 'hello');
      expect(distance).toBe(5);
    });

    test('handles completely different strings', () => {
      const distance = levenshteinDistance('abc', 'xyz');
      expect(distance).toBe(3);
    });

    test('is case sensitive', () => {
      const distance = levenshteinDistance('Hello', 'hello');
      expect(distance).toBe(1);
    });
  });

  describe('extractKeywords', () => {
    test('extracts keywords from simple text', () => {
      const keywords = extractKeywords('Optimize CLAUDE.md');
      expect(keywords).toContain('optimize');
      expect(keywords).toContain('claude');
      expect(keywords).toContain('md');
    });

    test('removes stop words', () => {
      const keywords = extractKeywords('This is a test of the system');
      expect(keywords).not.toContain('this');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('the');
      expect(keywords).toContain('test');
      expect(keywords).toContain('system');
    });

    test('converts to lowercase', () => {
      const keywords = extractKeywords('UPPERCASE Test');
      expect(keywords).toContain('uppercase');
      expect(keywords).toContain('test');
    });

    test('removes punctuation', () => {
      const keywords = extractKeywords('Hello, world! How are you?');
      expect(keywords).toContain('hello');
      expect(keywords).toContain('world');
    });

    test('handles empty string', () => {
      const keywords = extractKeywords('');
      expect(keywords).toEqual([]);
    });

    test('handles text with only stop words', () => {
      const keywords = extractKeywords('the a an is');
      expect(keywords).toEqual([]);
    });
  });

  describe('keywordOverlap', () => {
    test('returns 100 for identical keyword sets', () => {
      const overlap = keywordOverlap('Optimize CLAUDE.md', 'Optimize CLAUDE.md');
      expect(overlap).toBe(100);
    });

    test('calculates overlap for similar texts', () => {
      const overlap = keywordOverlap('Optimize CLAUDE.md', 'Optimize CLAUDE.md size');
      expect(overlap).toBeGreaterThan(50);
      expect(overlap).toBeLessThan(100);
    });

    test('returns 0 for completely different texts', () => {
      const overlap = keywordOverlap('Hello world', 'Goodbye universe');
      expect(overlap).toBe(0);
    });

    test('handles empty strings', () => {
      const overlap = keywordOverlap('', 'test');
      expect(overlap).toBe(0);
    });

    test('returns 0 when both strings are empty', () => {
      const overlap = keywordOverlap('', '');
      expect(overlap).toBe(0);
    });

    test('handles strings with no keywords', () => {
      // Strings with only stop words/non-keywords
      const overlap = keywordOverlap('a the an', 'a the an');
      expect(overlap).toBe(0);
    });

    test('is case insensitive', () => {
      const overlap = keywordOverlap('TEST', 'test');
      expect(overlap).toBe(100);
    });
  });

  describe('calculateSimilarity', () => {
    test('returns 100 for identical items', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'Optimize CLAUDE.md',
        context: 'Need to reduce file size',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2 = { ...item1 };
      const similarity = calculateSimilarity(item1, item2);
      expect(similarity).toBe(100);
    });

    test('calculates similarity for similar decisions', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'Optimize CLAUDE.md',
        context: 'File size issue',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Optimize CLAUDE.md size',
        context: 'File too large',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similarity = calculateSimilarity(item1, item2);
      expect(similarity).toBeGreaterThan(70);
    });

    test('returns low similarity for different items', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'Implement authentication',
        context: 'Need OAuth',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Design database schema',
        context: 'PostgreSQL setup',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similarity = calculateSimilarity(item1, item2);
      expect(similarity).toBeLessThan(30);
    });

    test('weights title more heavily than context', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'Same title',
        context: 'Different context one',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Same title',
        context: 'Different context two',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similarity = calculateSimilarity(item1, item2);
      expect(similarity).toBeGreaterThan(60); // Title weight should dominate
    });

    test('handles items with empty decisions', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: '',
        context: 'Context one',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: '',
        context: 'Context two',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similarity = calculateSimilarity(item1, item2);
      // Both empty decisions should give 100% title similarity
      expect(similarity).toBeGreaterThan(0);
    });

    test('handles items with empty context', () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'Test decision',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Test decision',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similarity = calculateSimilarity(item1, item2);
      expect(similarity).toBe(100);
    });
  });

  describe('findSimilarItems', () => {
    test('finds exact duplicates', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Optimize CLAUDE.md',
        context: 'File size issue',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Optimize CLAUDE.md',
          context: 'File size issue',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const similar = findSimilarItems(newItem, existingItems, 80);
      expect(similar.length).toBe(1);
      expect(similar[0].item.id).toBe(1);
    });

    test('finds similar items above threshold', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Optimize CLAUDE.md',
        context: 'File size issue',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Optimize CLAUDE.md size',
          context: 'File too large',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const similar = findSimilarItems(newItem, existingItems, 70);
      expect(similar.length).toBeGreaterThan(0);
    });

    test('excludes items below threshold', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Implement authentication',
        context: 'OAuth setup',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Design database schema',
          context: 'PostgreSQL tables',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const similar = findSimilarItems(newItem, existingItems, 80);
      expect(similar).toEqual([]);
    });

    test('returns empty array when no existing items', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Test',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const similar = findSimilarItems(newItem, [], 80);
      expect(similar).toEqual([]);
    });

    test('sorts results by similarity score descending', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Optimize code',
        context: 'Performance issue',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Different task',
          context: 'Optimize code',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'Optimize code',
          context: 'Performance issue',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 3,
          decision: 'Optimize code performance',
          context: 'Speed issue',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const similar = findSimilarItems(newItem, existingItems, 50);
      expect(similar.length).toBeGreaterThan(1);
      // First result should be most similar (item 2 - exact match)
      expect(similar[0].item.id).toBe(2);
    });

    test('only checks pending and in-progress items', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Optimize code',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Optimize code',
          context: 'Test',
          status: 'done',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          decision: 'Optimize code',
          context: 'Test',
          status: 'archived',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const similar = findSimilarItems(newItem, existingItems, 80);
      expect(similar).toEqual([]);
    });

    test('uses default threshold of 80 when not specified', () => {
      const newItem: DeferredItem = {
        id: 0,
        decision: 'Optimize code',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingItems: DeferredItem[] = [
        {
          id: 1,
          decision: 'Optimize code',
          context: 'Test',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Call without threshold parameter to use default of 80
      const similar = findSimilarItems(newItem, existingItems);
      expect(similar.length).toBe(1);
      expect(similar[0].similarity).toBe(100);
    });
  });

  describe('keywordOverlap edge cases', () => {
    test('handles union of zero (both texts have only stop words)', () => {
      // Both texts result in empty keyword sets after filtering
      const overlap = keywordOverlap('the a an', 'is are was');
      expect(overlap).toBe(0);
    });

    test('handles one text with keywords and one without', () => {
      const overlap = keywordOverlap('test keyword', 'the a an');
      expect(overlap).toBe(0);
    });
  });
});
