import {
  extractContext,
  truncateContext,
  isValidContext,
  enhanceContext,
} from '../../src/utils/context.js';

describe('Context Utilities', () => {
  describe('extractContext', () => {
    test('returns provided context when given', () => {
      const context = extractContext('This is test context');
      expect(context).toBe('This is test context');
    });

    test('trims whitespace from context', () => {
      const context = extractContext('  Context with spaces  ');
      expect(context).toBe('Context with spaces');
    });

    test('returns default message when no context provided', () => {
      const context = extractContext();
      expect(context).toContain('No additional context');
    });

    test('returns default message for empty context', () => {
      const context = extractContext('');
      expect(context).toContain('No additional context');
    });

    test('includes conversation ID when provided', () => {
      const context = extractContext(undefined, 'conv-123');
      expect(context).toContain('conv-123');
    });

    test('returns provided context even with conversation ID', () => {
      const context = extractContext('My context', 'conv-123');
      expect(context).toBe('My context');
    });
  });

  describe('truncateContext', () => {
    test('returns context as-is when under limit', () => {
      const short = 'Short context';
      expect(truncateContext(short)).toBe(short);
    });

    test('truncates long context to default limit', () => {
      const long = 'a'.repeat(6000);
      const truncated = truncateContext(long);

      expect(truncated.length).toBeLessThan(long.length);
      expect(truncated).toContain('[truncated]');
    });

    test('respects custom max length', () => {
      const text = 'a'.repeat(200);
      const truncated = truncateContext(text, 100);

      expect(truncated.length).toBeLessThanOrEqual(100);
      expect(truncated).toContain('[truncated]');
    });

    test('does not truncate when exactly at limit', () => {
      const text = 'a'.repeat(100);
      const truncated = truncateContext(text, 100);

      expect(truncated).toBe(text);
      expect(truncated).not.toContain('[truncated]');
    });
  });

  describe('isValidContext', () => {
    test('returns true for valid context', () => {
      expect(isValidContext('Valid context')).toBe(true);
    });

    test('returns false for empty context', () => {
      expect(isValidContext('')).toBe(false);
    });

    test('returns false for context exceeding 10000 characters', () => {
      const tooLong = 'a'.repeat(10001);
      expect(isValidContext(tooLong)).toBe(false);
    });

    test('returns true for context at 10000 character limit', () => {
      const atLimit = 'a'.repeat(10000);
      expect(isValidContext(atLimit)).toBe(true);
    });

    test('returns true for long but valid context', () => {
      const long = 'a'.repeat(5000);
      expect(isValidContext(long)).toBe(true);
    });
  });

  describe('enhanceContext', () => {
    test('returns original context for MVP', () => {
      const original = 'Original context';
      const enhanced = enhanceContext(original);
      expect(enhanced).toBe(original);
    });

    test('ignores metadata in MVP version', () => {
      const original = 'Context';
      const metadata = { tags: ['test'], priority: 'high' };
      const enhanced = enhanceContext(original, metadata);
      expect(enhanced).toBe(original);
    });

    test('handles empty context', () => {
      const enhanced = enhanceContext('');
      expect(enhanced).toBe('');
    });
  });
});
