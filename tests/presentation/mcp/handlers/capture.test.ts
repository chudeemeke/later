/**
 * MCP Capture Handler Tests
 *
 * Tests for the MCP-facing capture handler that wraps CaptureItemCommand.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler, CaptureArgs, CaptureResult } from '../../../../src/presentation/mcp/handlers/capture.js';

describe('MCP Capture Handler', () => {
  let testDir: string;
  let container: Container;
  let captureHandler: (args: CaptureArgs) => Promise<CaptureResult>;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-capture-handler-test-'));
    container = createContainer({ dataDir: testDir });
    captureHandler = createCaptureHandler(container);
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic capture', () => {
    it('should capture a simple decision', async () => {
      const result = await captureHandler({
        decision: 'Use PostgreSQL for database',
      });

      expect(result.success).toBe(true);
      expect(result.item_id).toBeDefined();
      expect(result.item_id).toBeGreaterThan(0);
      expect(result.message).toContain('Captured');
    });

    it('should capture with context', async () => {
      const result = await captureHandler({
        decision: 'Choose between REST and GraphQL',
        context: 'REST is simpler but GraphQL provides better flexibility',
      });

      expect(result.success).toBe(true);
      expect(result.item_id).toBeDefined();

      // Verify context was stored
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.context).toContain('REST');
    });

    it('should capture with tags', async () => {
      const result = await captureHandler({
        decision: 'Select CI/CD platform',
        tags: ['devops', 'infrastructure'],
      });

      expect(result.success).toBe(true);

      // Verify tags were stored
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.tags).toContain('devops');
      expect(getResult.item?.tags).toContain('infrastructure');
    });

    it('should capture with priority', async () => {
      const result = await captureHandler({
        decision: 'Critical security fix decision',
        priority: 'high',
      });

      expect(result.success).toBe(true);

      // Verify priority was stored
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.priority).toBe('high');
    });
  });

  describe('Validation', () => {
    it('should reject empty decision', async () => {
      const result = await captureHandler({
        decision: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only decision', async () => {
      const result = await captureHandler({
        decision: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should trim decision whitespace', async () => {
      const result = await captureHandler({
        decision: '  Use TypeScript  ',
      });

      expect(result.success).toBe(true);

      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.decision).toBe('Use TypeScript');
    });
  });

  describe('Response format', () => {
    it('should include success flag', async () => {
      const result = await captureHandler({ decision: 'Test' });
      expect(typeof result.success).toBe('boolean');
    });

    it('should include item_id on success (snake_case for MCP compatibility)', async () => {
      const result = await captureHandler({ decision: 'Test' });
      expect(result.item_id).toBeDefined();
    });

    it('should include message on success', async () => {
      const result = await captureHandler({ decision: 'Test' });
      expect(result.message).toBeDefined();
      expect(result.message).toContain('#');
    });

    it('should include error on failure', async () => {
      const result = await captureHandler({ decision: '' });
      expect(result.error).toBeDefined();
    });
  });

  describe('ID assignment', () => {
    it('should assign sequential IDs', async () => {
      const result1 = await captureHandler({ decision: 'First' });
      const result2 = await captureHandler({ decision: 'Second' });
      const result3 = await captureHandler({ decision: 'Third' });

      expect(result1.item_id).toBe(1);
      expect(result2.item_id).toBe(2);
      expect(result3.item_id).toBe(3);
    });
  });

  describe('Default values', () => {
    it('should default to pending status', async () => {
      const result = await captureHandler({ decision: 'Test' });
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.status).toBe('pending');
    });

    it('should default to medium priority', async () => {
      const result = await captureHandler({ decision: 'Test' });
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.priority).toBe('medium');
    });

    it('should default to empty tags', async () => {
      const result = await captureHandler({ decision: 'Test' });
      const getResult = await container.queries.getItem.execute({ id: result.item_id! });
      expect(getResult.item?.tags).toEqual([]);
    });
  });
});
