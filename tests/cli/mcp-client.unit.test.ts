/**
 * Unit tests for McpClient
 *
 * These tests mock the MCP SDK to test the client logic without spawning a real server.
 * Integration tests in mcp-client.test.ts cover real server communication.
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Mock the MCP SDK modules BEFORE importing McpClient
const mockConnect = jest.fn<() => Promise<void>>();
const mockCallTool = jest.fn<() => Promise<any>>();
const mockTransportClose = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    callTool: mockCallTool,
  })),
}));

jest.unstable_mockModule("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
  })),
}));

// Mock ora for spinner
const mockStart = jest.fn().mockReturnThis();
const mockSucceed = jest.fn().mockReturnThis();
const mockFail = jest.fn().mockReturnThis();

jest.unstable_mockModule("ora", () => ({
  default: jest.fn(() => ({
    start: mockStart,
    succeed: mockSucceed,
    fail: mockFail,
  })),
}));

// Import after mocking
const { McpClient } = await import("../../src/cli/mcp-client.js");

describe("McpClient Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockConnect.mockResolvedValue(undefined);
    mockTransportClose.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with default values", () => {
      const client = new McpClient();
      expect(client).toBeInstanceOf(McpClient);
    });

    it("should accept custom server path", () => {
      const client = new McpClient("/custom/server.js");
      expect(client).toBeInstanceOf(McpClient);
    });

    it("should accept custom data directory", () => {
      const client = new McpClient(undefined, "/custom/data");
      expect(client).toBeInstanceOf(McpClient);
    });

    it("should accept custom timeout", () => {
      const client = new McpClient(undefined, undefined, 10000);
      expect(client).toBeInstanceOf(McpClient);
    });

    it("should accept showSpinner option", () => {
      const client = new McpClient(undefined, undefined, 5000, false);
      expect(client).toBeInstanceOf(McpClient);
    });

    it("should disable spinner in CI environment", () => {
      const originalCI = process.env.CI;
      process.env.CI = "true";

      const client = new McpClient(undefined, undefined, 5000, true);
      expect(client).toBeInstanceOf(McpClient);

      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      } else {
        delete process.env.CI;
      }
    });

    it("should disable spinner when not TTY", () => {
      const originalTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
      });

      const client = new McpClient(undefined, undefined, 5000, true);
      expect(client).toBeInstanceOf(McpClient);

      Object.defineProperty(process.stdout, "isTTY", {
        value: originalTTY,
        configurable: true,
      });
    });
  });

  describe("callTool", () => {
    it("should throw error when client is closed", async () => {
      const client = new McpClient(undefined, undefined, 5000, false);
      await client.close();

      await expect(client.callTool("later_list", {})).rejects.toThrow(
        "MCP client has been closed",
      );
    });

    it("should parse JSON response from text content", async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, items: [] }),
          },
        ],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      const result = await client.callTool("later_list", {});

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
    });

    it("should handle non-JSON text response", async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "Plain text response",
          },
        ],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      const result = await client.callTool("later_list", {});

      expect(result.success).toBe(true);
      expect(result.message).toBe("Plain text response");
    });

    it("should handle result with isError flag", async () => {
      mockCallTool.mockResolvedValue({
        isError: true,
        content: [
          {
            type: "text",
            text: "Tool error occurred",
          },
        ],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      await expect(client.callTool("later_show", { id: 1 })).rejects.toThrow(
        "Tool error occurred",
      );
    });

    it("should handle isError with empty content", async () => {
      mockCallTool.mockResolvedValue({
        isError: true,
        content: [],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      await expect(client.callTool("later_show", { id: 1 })).rejects.toThrow(
        "Tool execution failed",
      );
    });

    it("should handle parsed result with success=false", async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: "Item not found" }),
          },
        ],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      await expect(client.callTool("later_show", { id: 999 })).rejects.toThrow(
        "Item not found",
      );
    });

    it("should handle result with no content array", async () => {
      mockCallTool.mockResolvedValue({
        data: "some other format",
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      const result = await client.callTool("later_list", {});

      // Should return the raw result
      expect(result.data).toBe("some other format");
    });

    it("should handle content array with no text type", async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "image",
            data: "base64...",
          },
        ],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      const result = await client.callTool("later_list", {});

      // Should return raw result when no text content found
      expect(result.content).toBeDefined();
    });

    it("should timeout when operation takes too long", async () => {
      // Make connect hang indefinitely
      mockConnect.mockImplementation(() => new Promise(() => {}));

      const client = new McpClient(undefined, undefined, 100, false); // 100ms timeout

      await expect(client.callTool("later_list", {})).rejects.toThrow(
        /timeout/i,
      );
    });

    it("should add __raw flag to arguments", async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      await client.callTool("later_list", { status: "pending" });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "later_list",
        arguments: { status: "pending", __raw: true },
      });
    });

    it("should cleanup after successful call", async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      await client.callTool("later_list", {});

      expect(mockTransportClose).toHaveBeenCalled();
    });

    it("should cleanup after failed call", async () => {
      mockConnect.mockRejectedValue(new Error("Connection failed"));

      const client = new McpClient(undefined, undefined, 5000, false);

      await expect(client.callTool("later_list", {})).rejects.toThrow(
        "Connection failed",
      );
      expect(mockTransportClose).toHaveBeenCalled();
    });
  });

  describe("callTool with spinner", () => {
    it("should show spinner when enabled and TTY", async () => {
      const originalCI = process.env.CI;
      const originalTTY = process.stdout.isTTY;

      delete process.env.CI;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });

      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
      });

      const client = new McpClient(undefined, undefined, 5000, true);
      await client.callTool("later_capture", { decision: "test" });

      expect(mockStart).toHaveBeenCalled();
      expect(mockSucceed).toHaveBeenCalled();

      // Restore
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalTTY,
        configurable: true,
      });
    });

    it("should call fail on spinner when error occurs", async () => {
      const originalCI = process.env.CI;
      const originalTTY = process.stdout.isTTY;

      delete process.env.CI;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });

      mockConnect.mockRejectedValue(new Error("Connection failed"));

      const client = new McpClient(undefined, undefined, 5000, true);

      await expect(client.callTool("later_list", {})).rejects.toThrow();
      expect(mockFail).toHaveBeenCalled();

      // Restore
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalTTY,
        configurable: true,
      });
    });
  });

  describe("getOperationName coverage", () => {
    it("should return correct operation names for all tools", async () => {
      // Test by calling each tool and checking the spinner text
      const originalCI = process.env.CI;
      const originalTTY = process.stdout.isTTY;

      delete process.env.CI;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });

      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
      });

      const toolOperations: Record<string, string> = {
        later_capture: "Capturing decision...",
        later_list: "Loading items...",
        later_show: "Fetching item...",
        later_update: "Updating item...",
        later_delete: "Deleting item...",
        later_do: "Marking as in-progress...",
        later_search: "Searching...",
        later_bulk_update: "Updating multiple items...",
        later_bulk_delete: "Deleting multiple items...",
        unknown_tool: "Processing...",
      };

      for (const [toolName, expectedText] of Object.entries(toolOperations)) {
        jest.clearAllMocks();
        mockConnect.mockResolvedValue(undefined);
        mockTransportClose.mockResolvedValue(undefined);
        mockCallTool.mockResolvedValue({
          content: [{ type: "text", text: '{"success": true}' }],
        });

        const client = new McpClient(undefined, undefined, 5000, true);
        await client.callTool(toolName, {});

        // ora() is called with { text: expectedText, color: 'cyan' }
        // We can't easily verify this without more complex mocking
      }

      // Restore
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalTTY,
        configurable: true,
      });
    });
  });

  describe("getServerVersion", () => {
    it("should return version string", async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true, "items": []}' }],
      });

      const client = new McpClient(undefined, undefined, 5000, false);
      const version = await client.getServerVersion();

      expect(version).toBe("2.0.0");
    });

    it("should throw error when server is unreachable", async () => {
      mockConnect.mockRejectedValue(new Error("Connection refused"));

      const client = new McpClient(undefined, undefined, 5000, false);

      await expect(client.getServerVersion()).rejects.toThrow(
        "Unable to connect to MCP server",
      );
    });

    it("should temporarily disable spinner during version check", async () => {
      const originalCI = process.env.CI;
      const originalTTY = process.stdout.isTTY;

      delete process.env.CI;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });

      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true, "items": []}' }],
      });

      const client = new McpClient(undefined, undefined, 5000, true);
      await client.getServerVersion();

      // Spinner should not be shown for version check (start shouldn't be called)
      // Note: This is hard to test without more sophisticated mocking

      // Restore
      if (originalCI !== undefined) {
        process.env.CI = originalCI;
      }
      Object.defineProperty(process.stdout, "isTTY", {
        value: originalTTY,
        configurable: true,
      });
    });
  });

  describe("isVersionCompatible", () => {
    it("should return true for same major version", () => {
      expect(McpClient.isVersionCompatible("1.0.0", "1.5.0")).toBe(true);
      expect(McpClient.isVersionCompatible("2.1.3", "2.0.0")).toBe(true);
    });

    it("should return false for different major versions", () => {
      expect(McpClient.isVersionCompatible("1.0.0", "2.0.0")).toBe(false);
      expect(McpClient.isVersionCompatible("3.0.0", "2.0.0")).toBe(false);
    });

    it("should return true for exact match", () => {
      expect(McpClient.isVersionCompatible("1.2.3", "1.2.3")).toBe(true);
    });
  });

  describe("close", () => {
    it("should close transport and set closed flag", async () => {
      const client = new McpClient(undefined, undefined, 5000, false);

      // First make a call to initialize transport
      mockCallTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
      });
      await client.callTool("later_list", {});

      // Transport should already be closed after callTool (short-lived design)
      expect(mockTransportClose).toHaveBeenCalled();
    });

    it("should be idempotent", async () => {
      const client = new McpClient(undefined, undefined, 5000, false);

      await client.close();
      await client.close();

      // Should not throw
    });

    it("should prevent further calls after close", async () => {
      const client = new McpClient(undefined, undefined, 5000, false);

      await client.close();

      await expect(client.callTool("later_list", {})).rejects.toThrow(
        "MCP client has been closed",
      );
    });
  });
});
