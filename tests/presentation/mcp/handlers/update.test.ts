/**
 * MCP Update Handler Tests
 *
 * Tests for the MCP-facing update handler that wraps UpdateItemCommand.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createShowHandler } from '../../../../src/presentation/mcp/handlers/show.js';
import { createUpdateHandler, UpdateArgs, UpdateResult } from '../../../../src/presentation/mcp/handlers/update.js';

describe('MCP Update Handler', () => {
  let testDir: string;
  let container: Container;
  let updateHandler: (args: UpdateArgs) => Promise<UpdateResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-update-handler-test-'));
    container = createContainer({ dataDir: testDir });
    updateHandler = createUpdateHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({
      decision: 'Original decision',
      context: 'Original context',
      tags: ['original'],
      priority: 'medium',
    });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Update decision', () => {
    it('should update decision text', async () => {
      const result = await updateHandler({ id: 1, decision: 'Updated decision' });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('decision');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.decision).toBe('Updated decision');
    });
  });

  describe('Update context', () => {
    it('should update context text', async () => {
      const result = await updateHandler({ id: 1, context: 'Updated context' });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('context');
    });
  });

  describe('Update status', () => {
    it('should update status', async () => {
      const result = await updateHandler({ id: 1, status: 'in-progress' });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('status');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.status).toBe('in-progress');
    });
  });

  describe('Update priority', () => {
    it('should update priority', async () => {
      const result = await updateHandler({ id: 1, priority: 'high' });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('priority');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.priority).toBe('high');
    });
  });

  describe('Update tags', () => {
    it('should replace all tags', async () => {
      const result = await updateHandler({ id: 1, tags: ['new', 'tags'] });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('tags');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.tags).toEqual(['new', 'tags']);
    });

    it('should add tags', async () => {
      const result = await updateHandler({ id: 1, add_tags: ['added'] });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('tags (added)');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.tags).toContain('original');
      expect(showResult.item!.tags).toContain('added');
    });

    it('should remove tags', async () => {
      const result = await updateHandler({ id: 1, remove_tags: ['original'] });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('tags (removed)');

      // Verify change
      const showHandler = createShowHandler(container);
      const showResult = await showHandler({ id: 1 });
      expect(showResult.item!.tags).not.toContain('original');
    });
  });

  describe('Multiple updates', () => {
    it('should apply multiple changes at once', async () => {
      const result = await updateHandler({
        id: 1,
        decision: 'New decision',
        priority: 'high',
        add_tags: ['urgent'],
      });

      expect(result.success).toBe(true);
      expect(result.changes_applied).toContain('decision');
      expect(result.changes_applied).toContain('priority');
      expect(result.changes_applied).toContain('tags (added)');
    });
  });

  describe('Validation', () => {
    it('should fail for missing ID', async () => {
      const result = await updateHandler({ id: 0, decision: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for negative ID', async () => {
      const result = await updateHandler({ id: -1, decision: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for non-existent item', async () => {
      const result = await updateHandler({ id: 999, decision: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await updateHandler({ id: 1, decision: 'Updated' });

      expect(result).toHaveProperty('changes_applied');
    });

    it('should include success flag', async () => {
      const result = await updateHandler({ id: 1, decision: 'Updated' });
      expect(typeof result.success).toBe('boolean');
    });

    it('should include message on success', async () => {
      const result = await updateHandler({ id: 1, decision: 'Updated' });

      expect(result.message).toContain('#1');
      expect(result.message).toContain('updated');
    });
  });
});
