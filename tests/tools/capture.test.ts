import { handleCapture } from '../../src/tools/capture.js';
import type { CaptureArgs, DeferredItem } from '../../src/types.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-capture-test');

describe('later_capture Tool', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic capture', () => {
    test('captures decision with minimal args', async () => {
      const args: CaptureArgs = {
        decision: 'Optimize CLAUDE.md',
      };

      const result = await handleCapture(args, storage);

      expect(result.success).toBe(true);
      expect(result.item_id).toBe(1);
      expect(result.message).toContain('Captured');
    });

    test('captures decision with all args', async () => {
      const args: CaptureArgs = {
        decision: 'Migrate to TypeScript',
        context: 'Need to improve type safety',
        tags: ['refactoring', 'typescript'],
        priority: 'high',
      };

      const result = await handleCapture(args, storage);

      expect(result.success).toBe(true);
      expect(result.item_id).toBe(1);

      // Verify item was stored correctly
      const item = await storage.findById(1);
      expect(item).not.toBeNull();
      expect(item!.decision).toBe('Migrate to TypeScript');
      expect(item!.context).toBe('Need to improve type safety');
      expect(item!.tags).toEqual(['refactoring', 'typescript']);
      expect(item!.priority).toBe('high');
      expect(item!.status).toBe('pending');
    });

    test('assigns default priority if not provided', async () => {
      const args: CaptureArgs = {
        decision: 'Test decision',
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.priority).toBe('medium');
    });

    test('assigns default status as pending', async () => {
      const args: CaptureArgs = {
        decision: 'Test decision',
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.status).toBe('pending');
    });

    test('generates sequential IDs', async () => {
      await handleCapture({ decision: 'First' }, storage);
      await handleCapture({ decision: 'Second' }, storage);
      await handleCapture({ decision: 'Third' }, storage);

      const items = await storage.readAll();
      expect(items.length).toBe(3);
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
      expect(items[2].id).toBe(3);
    });

    test('stores timestamps in ISO 8601 format', async () => {
      await handleCapture({ decision: 'Test' }, storage);

      const item = await storage.findById(1);
      expect(item!.created_at).toBeDefined();
      expect(item!.updated_at).toBeDefined();

      // Should be valid ISO dates
      const createdDate = new Date(item!.created_at);
      const updatedDate = new Date(item!.updated_at);
      expect(createdDate.toISOString()).toBe(item!.created_at);
      expect(updatedDate.toISOString()).toBe(item!.updated_at);
    });
  });

  describe('secret sanitization', () => {
    test('sanitizes secrets in context', async () => {
      const args: CaptureArgs = {
        decision: 'API integration',
        context: 'Use API key sk-1234567890abcdefghijklmnopqrstuvwxyz for authentication',
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.context).not.toContain('sk-1234567890');
      expect(item!.context).toContain('[REDACTED-OPENAI-KEY]');
    });

    test('sanitizes multiple secrets', async () => {
      const args: CaptureArgs = {
        decision: 'Setup credentials',
        context: `
          OpenAI: sk-1234567890abcdefghijklmnopqrstuvwxyz
          GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz
        `,
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.context).toContain('[REDACTED-OPENAI-KEY]');
      expect(item!.context).toContain('[REDACTED-GITHUB-TOKEN]');
      expect(item!.context).not.toContain('sk-1234567890');
      expect(item!.context).not.toContain('ghp_1234567890');
    });

    test('warns about detected secrets in result', async () => {
      const args: CaptureArgs = {
        decision: 'Test',
        context: 'Secret: sk-1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = await handleCapture(args, storage);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.warnings![0].toLowerCase()).toContain('secret');
    });
  });

  describe('duplicate detection', () => {
    test('detects exact duplicates', async () => {
      // Create original item
      await handleCapture({
        decision: 'Optimize CLAUDE.md',
        context: 'File size issue',
      }, storage);

      // Try to create duplicate
      const result = await handleCapture({
        decision: 'Optimize CLAUDE.md',
        context: 'File size issue',
      }, storage);

      expect(result.duplicate_detected).toBe(true);
      expect(result.similar_items).toBeDefined();
      expect(result.similar_items!.length).toBeGreaterThan(0);
    });

    test('detects similar items', async () => {
      await handleCapture({
        decision: 'Optimize CLAUDE.md',
        context: 'File size',
      }, storage);

      const result = await handleCapture({
        decision: 'Optimize CLAUDE.md size',
        context: 'File too large',
      }, storage);

      expect(result.duplicate_detected).toBe(true);
      expect(result.similar_items![0].similarity).toBeGreaterThan(70);
    });

    test('does not detect dissimilar items', async () => {
      await handleCapture({
        decision: 'Implement authentication',
      }, storage);

      const result = await handleCapture({
        decision: 'Design database schema',
      }, storage);

      expect(result.duplicate_detected).toBe(false);
    });

    test('skips duplicate check for done items', async () => {
      // Create completed item
      const item: DeferredItem = {
        id: 1,
        decision: 'Optimize code',
        context: 'Test',
        status: 'done',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await storage.append(item);

      // Should not detect as duplicate
      const result = await handleCapture({
        decision: 'Optimize code',
      }, storage);

      expect(result.duplicate_detected).toBe(false);
    });
  });

  describe('error handling', () => {
    test('rejects empty decision', async () => {
      const args: CaptureArgs = {
        decision: '',
      };

      const result = await handleCapture(args, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Decision cannot be empty');
    });

    test('rejects decision that is only whitespace', async () => {
      const args: CaptureArgs = {
        decision: '   ',
      };

      const result = await handleCapture(args, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Decision cannot be empty');
    });

    test('truncates very long context', async () => {
      const longContext = 'a'.repeat(6000);

      await handleCapture({
        decision: 'Test',
        context: longContext,
      }, storage);

      const item = await storage.findById(1);
      expect(item!.context.length).toBeLessThan(6000);
      expect(item!.context).toContain('[truncated]');
    });
  });

  describe('edge cases', () => {
    test('handles special characters in decision', async () => {
      const args: CaptureArgs = {
        decision: 'Use symbols: @#$%^&*()[]{}',
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.decision).toBe('Use symbols: @#$%^&*()[]{}');
    });

    test('handles unicode in decision', async () => {
      const args: CaptureArgs = {
        decision: 'Support 日本語 and émojis 🚀',
      };

      await handleCapture(args, storage);

      const item = await storage.findById(1);
      expect(item!.decision).toBe('Support 日本語 and émojis 🚀');
    });

    test('handles empty tags array', async () => {
      await handleCapture({
        decision: 'Test',
        tags: [],
      }, storage);

      const item = await storage.findById(1);
      expect(item!.tags).toEqual([]);
    });

    test('handles undefined context', async () => {
      await handleCapture({
        decision: 'Test',
      }, storage);

      const item = await storage.findById(1);
      expect(item!.context).toBeDefined();
      expect(item!.context.length).toBeGreaterThan(0);
    });
  });
});
