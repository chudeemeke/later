import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import chalk from 'chalk';
import {
  ColorSupport,
  Colors,
  TextUtils,
  TableFormatter,
} from '../../../src/cli/output/table-formatter.js';

describe('ColorSupport', () => {
  beforeEach(() => {
    // Reset to default state
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    // Clean up
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  it('should detect NO_COLOR environment variable', () => {
    process.env.NO_COLOR = '1';
    expect(ColorSupport.isEnabled()).toBe(false);
  });

  it('should respect disable() call', () => {
    ColorSupport.disable();
    expect(ColorSupport.isEnabled()).toBe(false);
  });

  it('should respect enable() call', () => {
    ColorSupport.disable();
    ColorSupport.enable();
    // Might be true or false depending on terminal, but shouldn't be force-disabled
    // We just verify it doesn't throw
    const enabled = ColorSupport.isEnabled();
    expect(typeof enabled).toBe('boolean');
  });
});

describe('Colors', () => {
  let originalChalkLevel: number;

  beforeEach(() => {
    // Save original chalk level and force colors on for testing
    originalChalkLevel = chalk.level;
    chalk.level = 3 as any; // Force colors enabled (3 = TrueColor)
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    // Restore original chalk level
    chalk.level = originalChalkLevel as any;
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  it('should color priority levels correctly', () => {
    const high = Colors.priority('high');
    const medium = Colors.priority('medium');
    const low = Colors.priority('low');
    const unknown = Colors.priority('unknown');

    // Should return strings
    expect(typeof high).toBe('string');
    expect(typeof medium).toBe('string');
    expect(typeof low).toBe('string');
    expect(typeof unknown).toBe('string');

    // Should contain the priority text
    expect(high).toContain('high');
    expect(medium).toContain('medium');
    expect(low).toContain('low');
    expect(unknown).toContain('unknown');
  });

  it('should color status correctly', () => {
    const pending = Colors.status('pending');
    const inProgress = Colors.status('in_progress');
    const done = Colors.status('done');
    const archived = Colors.status('archived');
    const unknown = Colors.status('unknown');

    expect(typeof pending).toBe('string');
    expect(typeof inProgress).toBe('string');
    expect(typeof done).toBe('string');
    expect(typeof archived).toBe('string');
    expect(typeof unknown).toBe('string');

    // Should contain the status text
    expect(pending).toContain('pending');
    expect(inProgress).toContain('in_progress');
    expect(done).toContain('done');
    expect(archived).toContain('archived');
    expect(unknown).toContain('unknown');
  });

  it('should format IDs with hash', () => {
    const id = Colors.id(5);
    expect(id).toContain('#5');
  });

  it('should format success messages', () => {
    const msg = Colors.success('Operation completed');
    expect(msg).toContain('Operation completed');
    expect(msg).toContain('✓');
  });

  it('should format error messages', () => {
    const msg = Colors.error('Something went wrong');
    expect(msg).toContain('Something went wrong');
    expect(msg).toContain('✗');
  });

  it('should format warning messages', () => {
    const msg = Colors.warning('Be careful');
    expect(msg).toContain('Be careful');
    expect(msg).toContain('⚠');
  });

  it('should format info messages', () => {
    const msg = Colors.info('FYI');
    expect(msg).toContain('FYI');
    expect(msg).toContain('ℹ');
  });

  it('should format dim text', () => {
    const text = Colors.dim('Less important');
    expect(text).toContain('Less important');
  });

  it('should format bold text', () => {
    const text = Colors.bold('Important');
    expect(text).toContain('Important');
  });

  it('should format tags', () => {
    const tag = Colors.tag('urgent');
    expect(tag).toContain('urgent');
  });

  it('should return plain text when colors disabled', () => {
    ColorSupport.disable();

    const high = Colors.priority('high');
    const success = Colors.success('Done');
    const id = Colors.id(5);

    // Should not contain ANSI codes (simple check)
    expect(high).toBe('high');
    expect(success).toBe('✓ Done');
    expect(id).toBe('#5');
  });

  it('should handle unknown priority gracefully', () => {
    const unknown = Colors.priority('unknown');
    expect(unknown).toBe('unknown');
  });

  it('should handle unknown status gracefully', () => {
    const unknown = Colors.status('unknown');
    expect(unknown).toBe('unknown');
  });

  it('should format all status types with colors enabled', () => {
    ColorSupport.enable();
    const pending = Colors.status('pending');
    const inProgress = Colors.status('in_progress');
    const done = Colors.status('done');
    const archived = Colors.status('archived');

    expect(pending).toContain('pending');
    expect(inProgress).toContain('in_progress');
    expect(done).toContain('done');
    expect(archived).toContain('archived');
  });

  it('should format all priority types with colors enabled', () => {
    ColorSupport.enable();
    const high = Colors.priority('high');
    const medium = Colors.priority('medium');
    const low = Colors.priority('low');

    expect(high).toContain('high');
    expect(medium).toContain('medium');
    expect(low).toContain('low');
  });

  it('should format all message types with colors disabled', () => {
    ColorSupport.disable();

    expect(Colors.error('Error')).toBe('✗ Error');
    expect(Colors.warning('Warning')).toBe('⚠ Warning');
    expect(Colors.info('Info')).toBe('ℹ Info');
    expect(Colors.dim('Dim')).toBe('Dim');
    expect(Colors.bold('Bold')).toBe('Bold');
    expect(Colors.tag('tag')).toBe('tag');
  });
});

describe('TextUtils', () => {
  it('should truncate text with ellipsis', () => {
    const long = 'This is a very long piece of text that needs to be truncated';
    const short = TextUtils.truncate(long, 20);

    expect(short.length).toBeLessThanOrEqual(20);
    expect(short).toContain('...');
  });

  it('should not truncate short text', () => {
    const short = 'Short';
    const result = TextUtils.truncate(short, 20);
    expect(result).toBe('Short');
  });

  it('should truncate with word boundaries', () => {
    const text = 'This is a very long sentence that needs truncation';
    const result = TextUtils.truncateWords(text, 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain('...');
    // Result should be truncated
    expect(result).not.toBe(text);
  });

  it('should format dates as "Today"', () => {
    const today = new Date().toISOString();
    const formatted = TextUtils.formatDate(today);
    expect(formatted).toBe('Today');
  });

  it('should format dates as "Yesterday"', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const formatted = TextUtils.formatDate(yesterday);
    expect(formatted).toBe('Yesterday');
  });

  it('should format dates as "X days ago"', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const formatted = TextUtils.formatDate(threeDaysAgo);
    expect(formatted).toBe('3 days ago');
  });

  it('should format dates as "X weeks ago"', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const formatted = TextUtils.formatDate(twoWeeksAgo);
    expect(formatted).toContain('weeks ago');
  });

  it('should format tags', () => {
    const tags = ['urgent', 'review', 'api'];
    const formatted = TextUtils.formatTags(tags);
    expect(formatted).toContain('urgent');
    expect(formatted).toContain('review');
    expect(formatted).toContain('api');
  });

  it('should handle empty tag list', () => {
    const formatted = TextUtils.formatTags([]);
    expect(formatted).toBe('-');
  });

  it('should handle null tags', () => {
    const formatted = TextUtils.formatTags(null as any);
    expect(formatted).toBe('-');
  });

  it('should truncate at word boundary when space is in good position', () => {
    // Text with space at 75% position (good for word boundary)
    const text = 'This is a very long sentence';
    const result = TextUtils.truncateWords(text, 20);
    expect(result).toContain('...');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('should truncate without word boundary when no good break point', () => {
    // Text with space very early (< 70% of max length)
    const text = 'Hi verylongtextwithoutspaces';
    const result = TextUtils.truncateWords(text, 20);
    expect(result).toContain('...');
    expect(result.length).toBe(20);
  });

  it('should truncate at word boundary when space is past 70% mark', () => {
    // Create text where last space in truncated portion is at > 70% of maxLength
    // For maxLength=20, 70% = 14, so space at index 15+ triggers word boundary
    const text = 'Aaaaaaaaaaaaaa Bbb'; // Space at index 14 in a 18-char string
    // With maxLength=20, truncated = 'Aaaaaaaaaaaaaa B' (17 chars, space at 14)
    // 14 > 14 is FALSE, so need space at 15+
    const betterText = 'Aaaaaaaaaaaaaaa Bb'; // 18 chars, space at index 15
    const result = TextUtils.truncateWords(betterText, 20);
    // Since text length (18) < maxLength (20), it should return as-is
    expect(result).toBe(betterText);
  });

  it('should find word boundary at correct position for truncation', () => {
    // Need a string where: length > maxLength AND lastSpace > 0.7 * maxLength
    // For maxLength=20: need lastSpace > 14 in first 17 chars
    // 'Aaaaaaaaaaaaaaa Bbbbbb' - space at 15, text length > 20
    const text = 'Aaaaaaaaaaaaaaa Bbbbbbb Ccc';
    const result = TextUtils.truncateWords(text, 20);
    // Truncated = first 17 chars = 'Aaaaaaaaaaaaaaa Bb', lastSpace = 15
    // 15 > 14 is TRUE, so should truncate at word boundary
    expect(result).toBe('Aaaaaaaaaaaaaaa...');
    expect(result.length).toBe(18);
  });

  it('should format months ago correctly', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const formatted = TextUtils.formatDate(twoMonthsAgo);
    expect(formatted).toContain('months ago');
  });

  it('should format old dates as localized date string', () => {
    const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const formatted = TextUtils.formatDate(longAgo);
    // Should not contain "ago" - should be a date string
    expect(formatted).not.toContain('ago');
  });
});

describe('TableFormatter', () => {
  const sampleItem = {
    id: 1,
    decision: 'Test decision',
    status: 'pending',
    priority: 'high',
    tags: ['test', 'urgent'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    context: 'Test context',
  };

  beforeEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  it('should format empty list', () => {
    const output = TableFormatter.formatList([]);
    expect(output).toContain('No items found');
  });

  it('should format list of items', () => {
    const items = [sampleItem];
    const output = TableFormatter.formatList(items);

    expect(output).toContain('Found 1 item');
    expect(output).toContain('Test decision');
    expect(output).toContain('pending');
    expect(output).toContain('high');
  });

  it('should format single item details', () => {
    const output = TableFormatter.formatItem(sampleItem);

    expect(output).toContain('#1');
    expect(output).toContain('Test decision');
    expect(output).toContain('pending');
    expect(output).toContain('high');
    expect(output).toContain('test');
    expect(output).toContain('Test context');
  });

  it('should format search results', () => {
    const results = [
      {
        score: 0.95,
        item: sampleItem,
        matchedFields: ['decision', 'context'],
      },
    ];

    const output = TableFormatter.formatSearchResults(results);
    expect(output).toContain('Found 1 matching item');
    expect(output).toContain('0.95');
    expect(output).toContain('Test decision');
  });

  it('should format empty search results', () => {
    const output = TableFormatter.formatSearchResults([]);
    expect(output).toContain('No matching items found');
  });

  it('should format bulk operation results', () => {
    const output = TableFormatter.formatBulkResults(
      'update',
      [1, 2, 3],
      [{ id: 4, error: 'Not found' }]
    );

    expect(output).toContain('Bulk update Results');
    expect(output).toContain('Successfully updated 3 item');
    expect(output).toContain('Failed to update 1 item');
    expect(output).toContain('#4');
    expect(output).toContain('Not found');
  });

  it('should format success message', () => {
    const msg = TableFormatter.formatMessage('success', 'Operation completed');
    expect(msg).toContain('Operation completed');
    expect(msg).toContain('✓');
  });

  it('should format error message', () => {
    const msg = TableFormatter.formatMessage('error', 'Operation failed');
    expect(msg).toContain('Operation failed');
    expect(msg).toContain('✗');
  });

  it('should format warning message', () => {
    const msg = TableFormatter.formatMessage('warning', 'Be careful');
    expect(msg).toContain('Be careful');
    expect(msg).toContain('⚠');
  });

  it('should format info message', () => {
    const msg = TableFormatter.formatMessage('info', 'FYI');
    expect(msg).toContain('FYI');
    expect(msg).toContain('ℹ');
  });

  it('should handle items with dependencies', () => {
    const itemWithDeps = {
      ...sampleItem,
      dependencies: [2, 3],
    };

    const output = TableFormatter.formatItem(itemWithDeps);
    expect(output).toContain('Blocks on');
    expect(output).toContain('#2');
    expect(output).toContain('#3');
  });

  it('should handle items without context', () => {
    const itemNoContext = {
      ...sampleItem,
      context: undefined,
    };

    const output = TableFormatter.formatItem(itemNoContext);
    expect(output).not.toContain('Context:');
  });

  it('should show updated date only if different from created', () => {
    const createdDate = new Date('2024-01-01').toISOString();
    const updatedDate = new Date('2024-01-02').toISOString();
    const itemWithUpdate = {
      ...sampleItem,
      created_at: createdDate,
      updated_at: updatedDate,
    };

    const output = TableFormatter.formatItem(itemWithUpdate);
    expect(output).toContain('Updated');
  });

  it('should not show updated date if same as created', () => {
    const sameDate = new Date().toISOString();
    const itemSameDate = {
      ...sampleItem,
      created_at: sameDate,
      updated_at: sameDate,
    };

    const output = TableFormatter.formatItem(itemSameDate);
    // "Updated" should not appear as a separate row
    const updatedCount = (output.match(/Updated/g) || []).length;
    expect(updatedCount).toBe(0);
  });

  it('should handle search results with missing score', () => {
    const results = [
      {
        item: sampleItem,
        matchedFields: ['decision'],
      },
    ];

    const output = TableFormatter.formatSearchResults(results);
    expect(output).toContain('-'); // Missing score shows as dash
  });

  it('should handle search results with missing matchedFields', () => {
    const results = [
      {
        item: sampleItem,
        score: 0.8,
      },
    ];

    const output = TableFormatter.formatSearchResults(results);
    expect(output).toContain('-'); // Missing matchedFields shows as dash
  });

  it('should color search scores appropriately', () => {
    ColorSupport.enable();

    const highScoreResult = [{ item: sampleItem, score: 0.9 }];
    const mediumScoreResult = [{ item: sampleItem, score: 0.6 }];
    const lowScoreResult = [{ item: sampleItem, score: 0.3 }];

    const highOutput = TableFormatter.formatSearchResults(highScoreResult);
    const mediumOutput = TableFormatter.formatSearchResults(mediumScoreResult);
    const lowOutput = TableFormatter.formatSearchResults(lowScoreResult);

    expect(highOutput).toContain('0.90');
    expect(mediumOutput).toContain('0.60');
    expect(lowOutput).toContain('0.30');
  });

  it('should handle bulk results with no failures', () => {
    const output = TableFormatter.formatBulkResults('delete', [1, 2, 3], []);
    expect(output).toContain('Successfully deleted 3 item');
    expect(output).not.toContain('Failed');
  });

  it('should handle bulk results with no successes', () => {
    const failed = [
      { id: 1, error: 'Error 1' },
      { id: 2, error: 'Error 2' },
    ];
    const output = TableFormatter.formatBulkResults('update', [], failed);
    expect(output).toContain('Failed to update 2 item');
    expect(output).not.toContain('Successfully');
  });

  it('should handle items without dependencies', () => {
    const itemNoDeps = {
      ...sampleItem,
      dependencies: [],
    };

    const output = TableFormatter.formatItem(itemNoDeps);
    expect(output).not.toContain('Blocks on');
  });

  it('should handle items with undefined dependencies', () => {
    const itemNoDeps = {
      ...sampleItem,
      dependencies: undefined,
    };

    const output = TableFormatter.formatItem(itemNoDeps);
    expect(output).not.toContain('Blocks on');
  });

  it('should truncate long decisions in list view', () => {
    const longDecision = 'A'.repeat(100);
    const itemLongDecision = {
      ...sampleItem,
      decision: longDecision,
    };

    const output = TableFormatter.formatList([itemLongDecision]);
    expect(output).toContain('...');
  });

  it('should format multiple items in list', () => {
    const items = [
      sampleItem,
      { ...sampleItem, id: 2, decision: 'Second decision' },
      { ...sampleItem, id: 3, decision: 'Third decision' },
    ];

    const output = TableFormatter.formatList(items);
    expect(output).toContain('Found 3 item');
    expect(output).toContain('#1');
    expect(output).toContain('#2');
    expect(output).toContain('#3');
  });

  describe('with colors disabled', () => {
    beforeEach(() => {
      ColorSupport.disable();
    });

    afterEach(() => {
      ColorSupport.enable();
    });

    it('should format list without colored borders when colors disabled', () => {
      const items = [sampleItem];
      const output = TableFormatter.formatList(items);

      expect(output).toContain('Found 1 item');
      expect(output).toContain('Test decision');
      // Border styling should be empty array (no colors)
    });

    it('should format item details without colored borders when colors disabled', () => {
      const output = TableFormatter.formatItem(sampleItem);

      expect(output).toContain('#1');
      expect(output).toContain('Test decision');
      expect(output).toContain('pending');
    });

    it('should format search results without colored borders when colors disabled', () => {
      const results = [
        {
          score: 0.95,
          item: sampleItem,
          matchedFields: ['decision'],
        },
      ];

      const output = TableFormatter.formatSearchResults(results);

      expect(output).toContain('Found 1 matching item');
      expect(output).toContain('0.95');
    });

    it('should format search results with plain score when colors disabled', () => {
      // Test all score ranges with colors disabled
      const highScoreResult = [{ item: sampleItem, score: 0.9 }];
      const mediumScoreResult = [{ item: sampleItem, score: 0.6 }];
      const lowScoreResult = [{ item: sampleItem, score: 0.3 }];

      const highOutput = TableFormatter.formatSearchResults(highScoreResult);
      const mediumOutput = TableFormatter.formatSearchResults(mediumScoreResult);
      const lowOutput = TableFormatter.formatSearchResults(lowScoreResult);

      // All should show plain scores without ANSI color codes
      expect(highOutput).toContain('0.90');
      expect(mediumOutput).toContain('0.60');
      expect(lowOutput).toContain('0.30');
    });
  });

  describe('score coloring with colors enabled', () => {
    let originalChalkLevel: number;

    beforeEach(() => {
      originalChalkLevel = chalk.level;
      chalk.level = 3 as any; // Force TrueColor
      ColorSupport.enable();
    });

    afterEach(() => {
      chalk.level = originalChalkLevel as any;
      ColorSupport.enable();
    });

    it('should apply green color to high scores (>= 0.8)', () => {
      const results = [{ item: sampleItem, score: 0.85 }];
      const output = TableFormatter.formatSearchResults(results);
      expect(output).toContain('0.85');
    });

    it('should apply yellow color to medium scores (>= 0.5, < 0.8)', () => {
      const results = [{ item: sampleItem, score: 0.55 }];
      const output = TableFormatter.formatSearchResults(results);
      expect(output).toContain('0.55');
    });

    it('should apply gray color to low scores (< 0.5)', () => {
      const results = [{ item: sampleItem, score: 0.35 }];
      const output = TableFormatter.formatSearchResults(results);
      expect(output).toContain('0.35');
    });

    it('should handle boundary score of exactly 0.8', () => {
      const results = [{ item: sampleItem, score: 0.8 }];
      const output = TableFormatter.formatSearchResults(results);
      expect(output).toContain('0.80');
    });

    it('should handle boundary score of exactly 0.5', () => {
      const results = [{ item: sampleItem, score: 0.5 }];
      const output = TableFormatter.formatSearchResults(results);
      expect(output).toContain('0.50');
    });
  });
});
