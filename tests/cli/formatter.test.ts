import { describe, it, expect } from '@jest/globals';
import {
  formatSuccess,
  formatError,
  formatItem,
  formatList,
} from '../../src/cli/output/formatter.js';

describe('CLI Output Formatter', () => {
  describe('formatSuccess', () => {
    it('should return success message as-is', () => {
      const message = 'Operation successful';
      const result = formatSuccess(message);

      expect(result).toBe(message);
    });

    it('should handle empty string', () => {
      const result = formatSuccess('');

      expect(result).toBe('');
    });

    it('should handle multi-line messages', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const result = formatSuccess(message);

      expect(result).toBe(message);
    });
  });

  describe('formatError', () => {
    it('should prefix error message with "Error: "', () => {
      const error = 'Something went wrong';
      const result = formatError(error);

      expect(result).toBe('Error: Something went wrong');
    });

    it('should handle empty error string', () => {
      const result = formatError('');

      expect(result).toBe('Error: ');
    });

    it('should handle already prefixed errors', () => {
      const error = 'Error: Already prefixed';
      const result = formatError(error);

      expect(result).toBe('Error: Error: Already prefixed');
    });
  });

  describe('formatItem', () => {
    it('should format a complete item with all fields', () => {
      const item = {
        id: 1,
        decision: 'Test decision',
        status: 'pending',
        priority: 'high',
        tags: ['test', 'important'],
        context: 'This is the context',
        created_at: '2024-01-15T10:00:00.000Z',
        dependencies: [2, 3],
      };

      const result = formatItem(item);

      expect(result).toContain('Item #1');
      expect(result).toContain('Decision: Test decision');
      expect(result).toContain('Status: pending');
      expect(result).toContain('Priority: high');
      expect(result).toContain('Tags: test, important');
      expect(result).toContain('Context: This is the context');
      expect(result).toContain('Created:');
      expect(result).toContain('Dependencies: 2, 3');
    });

    it('should format item without optional fields', () => {
      const item = {
        id: 5,
        decision: 'Minimal item',
        status: 'done',
        priority: 'low',
        tags: [],
      };

      const result = formatItem(item);

      expect(result).toContain('Item #5');
      expect(result).toContain('Decision: Minimal item');
      expect(result).toContain('Status: done');
      expect(result).toContain('Priority: low');
      expect(result).not.toContain('Tags:');
      expect(result).not.toContain('Context:');
      expect(result).not.toContain('Dependencies:');
    });

    it('should handle item with empty dependencies array', () => {
      const item = {
        id: 3,
        decision: 'No deps',
        status: 'pending',
        priority: 'medium',
        tags: [],
        dependencies: [],
      };

      const result = formatItem(item);

      expect(result).not.toContain('Dependencies:');
    });

    it('should format dates correctly', () => {
      const item = {
        id: 7,
        decision: 'Date test',
        status: 'pending',
        priority: 'medium',
        tags: [],
        created_at: '2024-03-20T15:30:00.000Z',
      };

      const result = formatItem(item);

      expect(result).toContain('Created:');
      // Should contain a formatted date (exact format depends on locale)
      expect(result).toMatch(/Created:.*202/);
    });
  });

  describe('formatList', () => {
    it('should format empty list', () => {
      const result = formatList([]);

      expect(result).toBe('No items found.');
    });

    it('should format list with single item', () => {
      const items = [
        {
          id: 1,
          status: 'pending',
          decision: 'Single item',
          priority: 'high',
          created_at: '2024-01-15T10:00:00.000Z',
          tags: ['test'],
        },
      ];

      const result = formatList(items);

      expect(result).toContain('Found 1 item(s)');
      expect(result).toContain('#1 [pending] Single item');
      expect(result).toContain('Priority: high');
      expect(result).toContain('Tags: test');
    });

    it('should format list with multiple items', () => {
      const items = [
        {
          id: 1,
          status: 'pending',
          decision: 'First item',
          priority: 'high',
          created_at: '2024-01-15T10:00:00.000Z',
          tags: ['test'],
        },
        {
          id: 2,
          status: 'done',
          decision: 'Second item',
          priority: 'low',
          created_at: '2024-01-16T11:00:00.000Z',
          tags: [],
        },
        {
          id: 3,
          status: 'in-progress',
          decision: 'Third item',
          priority: 'medium',
          created_at: '2024-01-17T12:00:00.000Z',
          tags: ['work', 'important'],
        },
      ];

      const result = formatList(items);

      expect(result).toContain('Found 3 item(s)');
      expect(result).toContain('#1 [pending] First item');
      expect(result).toContain('#2 [done] Second item');
      expect(result).toContain('#3 [in-progress] Third item');
      expect(result).toContain('Priority: high');
      expect(result).toContain('Priority: low');
      expect(result).toContain('Priority: medium');
    });

    it('should handle items with no tags', () => {
      const items = [
        {
          id: 10,
          status: 'archived',
          decision: 'No tags item',
          priority: 'medium',
          created_at: '2024-01-15T10:00:00.000Z',
          tags: [],
        },
      ];

      const result = formatList(items);

      expect(result).toContain('Found 1 item(s)');
      expect(result).toContain('#10 [archived] No tags item');
      // Should not have a tags line for items with empty tags
      const lines = result.split('\n');
      const itemLines = lines.filter(l => l.includes('#10'));
      const tagLines = itemLines.filter(l => l.includes('Tags:'));
      expect(tagLines.length).toBe(0);
    });

    it('should separate items with blank lines', () => {
      const items = [
        {
          id: 1,
          status: 'pending',
          decision: 'Item 1',
          priority: 'high',
          created_at: '2024-01-15T10:00:00.000Z',
          tags: [],
        },
        {
          id: 2,
          status: 'pending',
          decision: 'Item 2',
          priority: 'high',
          created_at: '2024-01-15T10:00:00.000Z',
          tags: [],
        },
      ];

      const result = formatList(items);

      // Should have blank lines between items
      expect(result).toMatch(/Item 1.*\n.*\n\n.*Item 2/s);
    });
  });
});
