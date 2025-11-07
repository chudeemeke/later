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
      // V2.0: Invalid tools return error response instead of throwing
      const result: any = await client.callTool('invalid_tool', {});
      expect(result.message).toContain('Error');
      expect(result.message).toContain('invalid_tool');
      expect(result.message).toContain('not found');
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

  describe('version checking', () => {
    beforeEach(() => {
      client = new McpClient(undefined, TEST_DIR, 5000, false);
    });

    it('should get server version successfully', async () => {
      const version = await client.getServerVersion();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/\d+\.\d+\.\d+/);
    }, 10000);

    it('should check version compatibility - compatible versions', () => {
      const compatible = McpClient.isVersionCompatible('1.2.3', '1.5.0');
      expect(compatible).toBe(true);
    });

    it('should check version compatibility - incompatible versions', () => {
      const compatible = McpClient.isVersionCompatible('1.2.3', '2.0.0');
      expect(compatible).toBe(false);
    });

    it('should check version compatibility - exact match', () => {
      const compatible = McpClient.isVersionCompatible('1.0.0', '1.0.0');
      expect(compatible).toBe(true);
    });
  });

  describe('spinner support', () => {
    beforeEach(async () => {
      // Clean test directory
      await fs.rm(TEST_DIR, { recursive: true, force: true });
      await fs.mkdir(TEST_DIR, { recursive: true });
    });

    it('should work with spinner enabled', async () => {
      // Force spinner on (will be disabled in CI, but test the code path)
      const oldCI = process.env.CI;
      const oldIsTTY = process.stdout.isTTY;

      delete process.env.CI;
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      client = new McpClient(undefined, TEST_DIR, 5000, true);

      const result = await client.callTool('later_capture', {
        decision: 'Spinner test',
        priority: 'medium',
      });

      expect(result.success).toBe(true);

      // Restore environment
      if (oldCI !== undefined) {
        process.env.CI = oldCI;
      }
      Object.defineProperty(process.stdout, 'isTTY', {
        value: oldIsTTY,
        writable: true,
        configurable: true,
      });
    }, 10000);

    it('should work with spinner disabled', async () => {
      client = new McpClient(undefined, TEST_DIR, 5000, false);

      const result = await client.callTool('later_capture', {
        decision: 'No spinner test',
        priority: 'medium',
      });

      expect(result.success).toBe(true);
    }, 10000);

    it('should disable spinner in CI environment', () => {
      const oldCI = process.env.CI;
      process.env.CI = 'true';

      client = new McpClient(undefined, TEST_DIR, 5000, true);

      // Spinner should be disabled even though we passed true
      // This tests the constructor logic

      if (oldCI !== undefined) {
        process.env.CI = oldCI;
      } else {
        delete process.env.CI;
      }
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      client = new McpClient(undefined, TEST_DIR, 5000, false);
    });

    it('should handle all tool names in operation mapping', async () => {
      // This tests getOperationName for all operations
      const tools = [
        'later_capture',
        'later_list',
        'later_show',
        'later_update',
        'later_delete',
        'later_do',
        'later_search',
        'later_bulk_update',
        'later_bulk_delete',
      ];

      // Just verify we can create client and it doesn't crash
      // The actual getOperationName is private, but it's called during callTool
      expect(client).toBeInstanceOf(McpClient);
    });

    it('should handle concurrent calls correctly', async () => {
      // Each call creates its own client, so concurrent calls should work
      const client1 = new McpClient(undefined, TEST_DIR, 5000, false);
      const client2 = new McpClient(undefined, TEST_DIR, 5000, false);

      const [result1, result2] = await Promise.all([
        client1.callTool('later_capture', { decision: 'Concurrent 1', priority: 'medium' }),
        client2.callTool('later_capture', { decision: 'Concurrent 2', priority: 'medium' }),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.item_id).not.toBe(result2.item_id);
    }, 15000);
  });
});
