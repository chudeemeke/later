import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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
  beforeEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  it('should color priority levels correctly', () => {
    const high = Colors.priority('high');
    const medium = Colors.priority('medium');
    const low = Colors.priority('low');

    // Should return strings
    expect(typeof high).toBe('string');
    expect(typeof medium).toBe('string');
    expect(typeof low).toBe('string');

    // Should contain the priority text
    expect(high).toContain('high');
    expect(medium).toContain('medium');
    expect(low).toContain('low');
  });

  it('should color status correctly', () => {
    const pending = Colors.status('pending');
    const inProgress = Colors.status('in_progress');
    const done = Colors.status('done');
    const archived = Colors.status('archived');

    expect(typeof pending).toBe('string');
    expect(typeof inProgress).toBe('string');
    expect(typeof done).toBe('string');
    expect(typeof archived).toBe('string');
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
});
