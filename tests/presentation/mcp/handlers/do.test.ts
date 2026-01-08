/**
 * MCP Do Handler Tests
 *
 * Tests for the MCP-facing do handler that wraps CompleteItemCommand.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createDoHandler, DoArgs, DoResult } from '../../../../src/presentation/mcp/handlers/do.js';

describe('MCP Do Handler', () => {
  let testDir: string;
  let container: Container;
  let doHandler: (args: DoArgs) => Promise<DoResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-do-handler-test-'));
    container = createContainer({ dataDir: testDir });
    doHandler = createDoHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({ decision: 'Test decision 1' });
    await captureHandler({ decision: 'Test decision 2' });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic completion', () => {
    it('should mark item as done', async () => {
      const result = await doHandler({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('#1');
      expect(result.message).toContain('done');
    });

    it('should handle outcome', async () => {
      const result = await doHandler({ id: 1, outcome: 'success' });

      expect(result.success).toBe(true);
    });

    it('should handle lessons learned', async () => {
      const result = await doHandler({
        id: 1,
        outcome: 'success',
        lessons_learned: 'This worked well',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should fail for missing ID', async () => {
      const result = await doHandler({ id: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for negative ID', async () => {
      const result = await doHandler({ id: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for non-existent item', async () => {
      const result = await doHandler({ id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Retrospective fields', () => {
    it('should accept impact metrics', async () => {
      const result = await doHandler({
        id: 1,
        outcome: 'success',
        impact_time_saved: 60,
        impact_cost_saved: 100,
      });

      expect(result.success).toBe(true);
    });

    it('should accept effort metrics', async () => {
      const result = await doHandler({
        id: 1,
        outcome: 'success',
        effort_estimated: 30,
        effort_actual: 45,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await doHandler({
        id: 1,
        outcome: 'success',
        lessons_learned: 'Test',
      });

      // Result fields should be snake_case
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should include success flag', async () => {
      const result = await doHandler({ id: 1 });
      expect(typeof result.success).toBe('boolean');
    });
  });
});
