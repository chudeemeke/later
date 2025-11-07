import { describe, it, expect } from '@jest/globals';
import { JsonFormatter } from '../../../src/cli/output/json-formatter.js';

describe('JsonFormatter', () => {
  describe('formatCaptureResult', () => {
    it('should format successful capture result', () => {
      const result = {
        success: true,
        item_id: 5,
        message: 'Captured as item #5',
        warnings: [],
        duplicate_detected: false,
        similar_items: [],
      };

      const formatted = JsonFormatter.formatCaptureResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.id).toBe(5);
      expect(parsed.message).toBe('Captured as item #5');
      expect(parsed.warnings).toEqual([]);
      expect(parsed.duplicate_detected).toBe(false);
      expect(parsed.similar_items).toEqual([]);
    });

    it('should format capture result with warnings', () => {
      const result = {
        success: true,
        item_id: 10,
        message: 'Captured',
        warnings: ['Long decision text'],
        duplicate_detected: true,
        similar_items: [3, 4],
      };

      const formatted = JsonFormatter.formatCaptureResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.warnings).toContain('Long decision text');
      expect(parsed.duplicate_detected).toBe(true);
      expect(parsed.similar_items).toEqual([3, 4]);
    });

    it('should format failed capture result', () => {
      const result = {
        success: false,
        error: 'Validation failed',
      };

      const formatted = JsonFormatter.formatCaptureResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Validation failed');
    });
  });

  describe('formatListResult', () => {
    it('should format empty list', () => {
      const items: any[] = [];
      const formatted = JsonFormatter.formatListResult(items);
      const parsed = JSON.parse(formatted);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(0);
    });

    it('should format list with items', () => {
      const items = [
        { id: 1, decision: 'Test 1', status: 'pending' },
        { id: 2, decision: 'Test 2', status: 'done' },
      ];

      const formatted = JsonFormatter.formatListResult(items);
      const parsed = JSON.parse(formatted);

      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe(1);
      expect(parsed[1].id).toBe(2);
    });

    it('should preserve all item fields', () => {
      const items = [
        {
          id: 5,
          decision: 'Complex item',
          context: 'Context here',
          status: 'in_progress',
          priority: 'high',
          tags: ['urgent', 'review'],
          created_at: '2025-01-01T00:00:00Z',
          dependencies: [1, 2],
        },
      ];

      const formatted = JsonFormatter.formatListResult(items);
      const parsed = JSON.parse(formatted);

      expect(parsed[0]).toEqual(items[0]);
    });
  });

  describe('formatShowResult', () => {
    it('should format item with all fields', () => {
      const item = {
        id: 42,
        decision: 'Show test',
        context: 'Context',
        status: 'pending',
        priority: 'medium',
        tags: ['test'],
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        dependencies: [],
      };

      const formatted = JsonFormatter.formatShowResult(item);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual(item);
    });

    it('should handle item with minimal fields', () => {
      const item = {
        id: 1,
        decision: 'Minimal',
      };

      const formatted = JsonFormatter.formatShowResult(item);
      const parsed = JSON.parse(formatted);

      expect(parsed.id).toBe(1);
      expect(parsed.decision).toBe('Minimal');
    });
  });

  describe('formatSearchResult', () => {
    it('should format search results', () => {
      const result = {
        query: 'test query',
        totalFound: 5,
        searchTime: 42,
        results: [
          { item: { id: 1, decision: 'Test' }, score: 0.95 },
          { item: { id: 2, decision: 'Another' }, score: 0.85 },
        ],
      };

      const formatted = JsonFormatter.formatSearchResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.query).toBe('test query');
      expect(parsed.totalFound).toBe(5);
      expect(parsed.searchTime).toBe(42);
      expect(parsed.results.length).toBe(2);
    });

    it('should format empty search results', () => {
      const result = {
        query: 'nonexistent',
        totalFound: 0,
        searchTime: 10,
        results: [],
      };

      const formatted = JsonFormatter.formatSearchResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.totalFound).toBe(0);
      expect(parsed.results).toEqual([]);
    });
  });

  describe('formatDoResult', () => {
    it('should format do result with all fields', () => {
      const result = {
        success: true,
        message: 'Item marked as in_progress',
        item: { id: 5, status: 'in_progress' },
        todo_guidance: 'Break down into steps',
        warnings: [],
      };

      const formatted = JsonFormatter.formatDoResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Item marked as in_progress');
      expect(parsed.item.id).toBe(5);
      expect(parsed.todo_guidance).toBe('Break down into steps');
    });

    it('should handle missing optional fields', () => {
      const result = {
        success: true,
        message: 'Done',
        item: { id: 1 },
      };

      const formatted = JsonFormatter.formatDoResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
    });
  });

  describe('formatUpdateResult', () => {
    it('should format update result', () => {
      const result = {
        success: true,
        message: 'Item updated',
        item: { id: 5, priority: 'high' },
        warnings: ['Some field changed'],
      };

      const formatted = JsonFormatter.formatUpdateResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
      expect(parsed.item.priority).toBe('high');
      expect(parsed.warnings).toContain('Some field changed');
    });

    it('should handle update without warnings', () => {
      const result = {
        success: true,
        message: 'Updated',
        item: { id: 1 },
      };

      const formatted = JsonFormatter.formatUpdateResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.warnings).toEqual([]);
    });
  });

  describe('formatDeleteResult', () => {
    it('should format delete result', () => {
      const result = {
        success: true,
        message: 'Item deleted',
        warnings: [],
      };

      const formatted = JsonFormatter.formatDeleteResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('Item deleted');
    });

    it('should include warnings if present', () => {
      const result = {
        success: true,
        message: 'Deleted',
        warnings: ['Had dependencies'],
      };

      const formatted = JsonFormatter.formatDeleteResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.warnings).toContain('Had dependencies');
    });
  });

  describe('formatBulkResult', () => {
    it('should format bulk operation result', () => {
      const result = {
        success: true,
        total: 5,
        succeeded: 4,
        failedCount: 1,
        processed: [1, 2, 3, 4],
        failed: [{ id: 5, error: 'Not found' }],
      };

      const formatted = JsonFormatter.formatBulkResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(5);
      expect(parsed.succeeded).toBe(4);
      expect(parsed.failed).toBe(1);
      expect(parsed.processed).toEqual([1, 2, 3, 4]);
      expect(parsed.failures).toHaveLength(1);
      expect(parsed.failures[0].id).toBe(5);
    });

    it('should handle all successful bulk operation', () => {
      const result = {
        success: true,
        total: 3,
        succeeded: 3,
        processed: [1, 2, 3],
      };

      const formatted = JsonFormatter.formatBulkResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.succeeded).toBe(3);
      expect(parsed.failed).toBe(0);
      expect(parsed.failures).toEqual([]);
    });

    it('should handle all failed bulk operation', () => {
      const result = {
        success: false,
        total: 2,
        succeeded: 0,
        failedCount: 2,
        failed: [
          { id: 1, error: 'Error 1' },
          { id: 2, error: 'Error 2' },
        ],
      };

      const formatted = JsonFormatter.formatBulkResult(result);
      const parsed = JSON.parse(formatted);

      expect(parsed.succeeded).toBe(0);
      expect(parsed.failed).toBe(2);
      expect(parsed.failures).toHaveLength(2);
    });
  });

  describe('JSON formatting', () => {
    it('should produce valid JSON', () => {
      const result = { success: true, item_id: 5, message: 'Test' };

      const formatted = JsonFormatter.formatCaptureResult(result);

      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('should format with indentation', () => {
      const result = { success: true, item_id: 1, message: 'Test' };

      const formatted = JsonFormatter.formatCaptureResult(result);

      // Should have newlines (indicating pretty-print)
      expect(formatted).toContain('\n');
      expect(formatted).toContain('  ');
    });

    it('should handle special characters', () => {
      const items = [
        {
          id: 1,
          decision: 'Test "quotes" and \\backslashes\\',
          tags: ['tag1', 'tag2'],
        },
      ];

      const formatted = JsonFormatter.formatListResult(items);
      const parsed = JSON.parse(formatted);

      expect(parsed[0].decision).toBe('Test "quotes" and \\backslashes\\');
    });
  });
});
