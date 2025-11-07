import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpClient } from '../../src/cli/mcp-client.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

const TEST_DIR = path.join(os.homedir(), '.later-test-cli');

describe('McpClient', () => {
  let client: McpClient;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create McpClient instance', () => {
      client = new McpClient();
      expect(client).toBeInstanceOf(McpClient);
    });

    it('should allow custom server path', () => {
      const customPath = '/custom/path/to/server.js';
      client = new McpClient(customPath);
      expect(client).toBeInstanceOf(McpClient);
    });
  });

  describe('callTool', () => {
    beforeEach(() => {
      // Use test data directory
      process.env.HOME = os.homedir();
      client = new McpClient(undefined, TEST_DIR);
    });

    it('should call later_capture tool successfully', async () => {
      const result = await client.callTool('later_capture', {
        decision: 'Test decision from CLI',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.item_id).toBeDefined();
      expect(typeof result.item_id).toBe('number');
    }, 10000);

    it('should call later_list tool successfully', async () => {
      // First create an item
      const captureClient = new McpClient(undefined, TEST_DIR);
      await captureClient.callTool('later_capture', {
        decision: 'Item for list test',
        priority: 'medium',
      });

      // Create new client for list call
      const listClient = new McpClient(undefined, TEST_DIR);
      const result = await listClient.callTool('later_list', {});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    }, 10000);

    it('should call later_show tool successfully', async () => {
      // First create an item
      const captureClient = new McpClient(undefined, TEST_DIR);
      const captureResult = await captureClient.callTool('later_capture', {
        decision: 'Item for show test',
        priority: 'medium',
      });

      // Create new client for show call
      const showClient = new McpClient(undefined, TEST_DIR);
      const result = await showClient.callTool('later_show', {
        id: captureResult.item_id,
      });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item.id).toBe(captureResult.item_id);
      expect(result.item.decision).toBe('Item for show test');
    }, 10000);

    it('should handle tool errors gracefully', async () => {
      await expect(async () => {
        await client.callTool('later_show', { id: 99999 });
      }).rejects.toThrow();
    }, 10000);

    it('should handle invalid tool name', async () => {
      await expect(async () => {
        await client.callTool('invalid_tool', {});
      }).rejects.toThrow();
    }, 10000);

    it('should timeout if server takes too long', async () => {
      // This tests the timeout mechanism
      const shortTimeoutClient = new McpClient(undefined, TEST_DIR, 100);

      await expect(async () => {
        // Call a tool but the timeout is too short
        await shortTimeoutClient.callTool('later_list', {});
      }).rejects.toThrow(/timeout/i);

      await shortTimeoutClient.close();
    }, 15000);
  });

  describe('error handling', () => {
    beforeEach(() => {
      client = new McpClient(undefined, TEST_DIR);
    });

    it('should handle missing required arguments', async () => {
      await expect(async () => {
        await client.callTool('later_capture', {});
      }).rejects.toThrow();
    }, 10000);

    it('should handle invalid argument types', async () => {
      await expect(async () => {
        await client.callTool('later_show', { id: 'not-a-number' });
      }).rejects.toThrow();
    }, 10000);
  });

  describe('resource cleanup', () => {
    it('should clean up resources when closed', async () => {
      client = new McpClient(undefined, TEST_DIR);

      await client.callTool('later_capture', {
        decision: 'Cleanup test',
        priority: 'medium',
      });

      await client.close();

      // Calling after close should create new instance
      await expect(async () => {
        await client.callTool('later_list', {});
      }).rejects.toThrow();
    }, 10000);
  });
});
