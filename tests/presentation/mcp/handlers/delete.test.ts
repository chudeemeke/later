/**
 * MCP Delete Handler Tests
 *
 * Tests for the MCP-facing delete handler that wraps DeleteItemCommand.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createListHandler } from '../../../../src/presentation/mcp/handlers/list.js';
import { createDeleteHandler, DeleteArgs, DeleteResult } from '../../../../src/presentation/mcp/handlers/delete.js';

describe('MCP Delete Handler', () => {
  let testDir: string;
  let container: Container;
  let deleteHandler: (args: DeleteArgs) => Promise<DeleteResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-delete-handler-test-'));
    container = createContainer({ dataDir: testDir });
    deleteHandler = createDeleteHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({ decision: 'Test decision 1' });
    await captureHandler({ decision: 'Test decision 2' });
    await captureHandler({ decision: 'Test decision 3' });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Soft delete (archive)', () => {
    it('should archive item by default', async () => {
      const result = await deleteHandler({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.was_archived).toBe(true);
      expect(result.deleted_id).toBe(1);
    });

    it('should show archive in message', async () => {
      const result = await deleteHandler({ id: 1 });

      expect(result.message).toContain('archived');
      expect(result.message).toContain('#1');
    });

    it('should archive item with hard=false', async () => {
      const result = await deleteHandler({ id: 1, hard: false });

      expect(result.success).toBe(true);
      expect(result.was_archived).toBe(true);
    });
  });

  describe('Hard delete', () => {
    it('should permanently delete with hard=true', async () => {
      const result = await deleteHandler({ id: 1, hard: true });

      expect(result.success).toBe(true);
      expect(result.was_archived).toBe(false);
      expect(result.deleted_id).toBe(1);
    });

    it('should show permanent delete in message', async () => {
      const result = await deleteHandler({ id: 1, hard: true });

      expect(result.message).toContain('permanently deleted');
      expect(result.message).toContain('#1');
    });
  });

  describe('Validation', () => {
    it('should fail for missing ID', async () => {
      const result = await deleteHandler({ id: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for negative ID', async () => {
      const result = await deleteHandler({ id: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID');
    });

    it('should fail for non-existent item', async () => {
      const result = await deleteHandler({ id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await deleteHandler({ id: 1 });

      expect(result).toHaveProperty('deleted_id');
      expect(result).toHaveProperty('was_archived');
      expect(result).toHaveProperty('cleaned_up_dependencies');
      expect(result).toHaveProperty('cleaned_up_reminders');
    });

    it('should include success flag', async () => {
      const result = await deleteHandler({ id: 1 });
      expect(typeof result.success).toBe('boolean');
    });

    it('should include cleanup counts', async () => {
      const result = await deleteHandler({ id: 1 });

      expect(typeof result.cleaned_up_dependencies).toBe('number');
      expect(typeof result.cleaned_up_reminders).toBe('number');
    });
  });

  describe('Multiple deletes', () => {
    it('should allow deleting multiple items with hard delete', async () => {
      // Use hard delete so items are actually removed
      const result1 = await deleteHandler({ id: 1, hard: true });
      const result2 = await deleteHandler({ id: 2, hard: true });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify remaining items
      const listHandler = createListHandler(container);
      const listResult = await listHandler({});
      expect(listResult.items.length).toBe(1);
    });
  });
});
