/**
 * MCP List Handler Tests
 *
 * Tests for the MCP-facing list handler that wraps ListItemsQuery.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createListHandler, ListArgs, ListResult } from '../../../../src/presentation/mcp/handlers/list.js';

describe('MCP List Handler', () => {
  let testDir: string;
  let container: Container;
  let listHandler: (args: ListArgs) => Promise<ListResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-list-handler-test-'));
    container = createContainer({ dataDir: testDir });
    listHandler = createListHandler(container);

    // Seed some test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({ decision: 'First decision', tags: ['api'], priority: 'high' });
    await captureHandler({ decision: 'Second decision', tags: ['database'], priority: 'medium' });
    await captureHandler({ decision: 'Third decision', tags: ['api', 'performance'], priority: 'low' });
  });

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic listing', () => {
    it('should list all items', async () => {
      const result = await listHandler({});

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(3);
      expect(result.total_count).toBe(3);
    });

    it('should include item details', async () => {
      const result = await listHandler({});

      expect(result.items[0]).toHaveProperty('id');
      expect(result.items[0]).toHaveProperty('decision');
      expect(result.items[0]).toHaveProperty('status');
      expect(result.items[0]).toHaveProperty('priority');
      expect(result.items[0]).toHaveProperty('tags');
    });

    it('should return formatted output', async () => {
      const result = await listHandler({});

      expect(result.formatted_output).toBeDefined();
      expect(result.formatted_output).toContain('#1');
      expect(result.formatted_output).toContain('First decision');
    });
  });

  describe('Filtering by status', () => {
    it('should filter by pending status', async () => {
      const result = await listHandler({ status: 'pending' });

      expect(result.items.length).toBe(3);
      expect(result.items.every(item => item.status === 'pending')).toBe(true);
    });

    it('should return empty for non-matching status', async () => {
      const result = await listHandler({ status: 'done' });

      expect(result.items.length).toBe(0);
    });
  });

  describe('Filtering by priority', () => {
    it('should filter by high priority', async () => {
      const result = await listHandler({ priority: 'high' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].priority).toBe('high');
    });

    it('should filter by low priority', async () => {
      const result = await listHandler({ priority: 'low' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].priority).toBe('low');
    });
  });

  describe('Filtering by tags', () => {
    it('should filter by single tag', async () => {
      const result = await listHandler({ tags: ['api'] });

      expect(result.items.length).toBe(2);
      expect(result.items.every(item => item.tags.includes('api'))).toBe(true);
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const result = await listHandler({ tags: ['database', 'performance'] });

      expect(result.items.length).toBe(2);
    });
  });

  describe('Limit', () => {
    it('should limit results', async () => {
      const result = await listHandler({ limit: 2 });

      expect(result.items.length).toBe(2);
      expect(result.total_count).toBe(3);
      expect(result.showing_count).toBe(2);
    });

    it('should include all items if limit exceeds count', async () => {
      const result = await listHandler({ limit: 10 });

      expect(result.items.length).toBe(3);
    });
  });

  describe('Response format', () => {
    it('should include success flag', async () => {
      const result = await listHandler({});
      expect(typeof result.success).toBe('boolean');
    });

    it('should include items array (snake_case for MCP)', async () => {
      const result = await listHandler({});
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should include total_count', async () => {
      const result = await listHandler({});
      expect(typeof result.total_count).toBe('number');
    });

    it('should include formatted_output', async () => {
      const result = await listHandler({});
      expect(typeof result.formatted_output).toBe('string');
    });
  });

  describe('Empty list', () => {
    it('should handle empty database', async () => {
      // Create new container with empty database
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-empty-test-'));
      const emptyContainer = createContainer({ dataDir: emptyDir });
      const emptyListHandler = createListHandler(emptyContainer);

      const result = await emptyListHandler({});

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(0);
      expect(result.total_count).toBe(0);

      await emptyContainer.close();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });
});
