/**
 * MCP Show Handler Tests
 *
 * Tests for the MCP-facing show handler that wraps GetItemQuery.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createShowHandler, ShowArgs, ShowResult } from '../../../../src/presentation/mcp/handlers/show.js';

describe('MCP Show Handler', () => {
  let testDir: string;
  let container: Container;
  let showHandler: (args: ShowArgs) => Promise<ShowResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-show-handler-test-'));
    container = createContainer({ dataDir: testDir });
    showHandler = createShowHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({ decision: 'Test decision', context: 'Test context', tags: ['test'] });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic show', () => {
    it('should show an item by ID', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.id).toBe(1);
      expect(result.item!.decision).toBe('Test decision');
    });

    it('should include all item fields', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item).toHaveProperty('id');
      expect(result.item).toHaveProperty('decision');
      expect(result.item).toHaveProperty('context');
      expect(result.item).toHaveProperty('status');
      expect(result.item).toHaveProperty('priority');
      expect(result.item).toHaveProperty('tags');
      expect(result.item).toHaveProperty('created_at');
      expect(result.item).toHaveProperty('updated_at');
    });

    it('should return formatted output', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.formatted_output).toBeDefined();
      expect(result.formatted_output).toContain('#1');
      expect(result.formatted_output).toContain('Test decision');
    });
  });

  describe('Validation', () => {
    it('should fail for missing ID', async () => {
      const result = await showHandler({ id: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for negative ID', async () => {
      const result = await showHandler({ id: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for non-existent item', async () => {
      const result = await showHandler({ id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await showHandler({ id: 1 });

      expect(result.item).toHaveProperty('created_at');
      expect(result.item).toHaveProperty('updated_at');
      expect(result).toHaveProperty('formatted_output');
    });

    it('should include success flag', async () => {
      const result = await showHandler({ id: 1 });
      expect(typeof result.success).toBe('boolean');
    });
  });
});
