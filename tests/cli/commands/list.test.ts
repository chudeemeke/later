import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { handleList } from "../../../src/cli/commands/list.js";
import { McpClient } from "../../../src/cli/mcp-client.js";
import { ParsedArgs } from "../../../src/cli/parser.js";
import {
  createMockOutputWriter,
  MockOutputWriter,
} from "../../../src/cli/output/writer.js";

// Helper to create ParsedArgs
function createParsedArgs(
  args: string[] = [],
  flags: Record<string, unknown> = {},
): ParsedArgs {
  return {
    subcommand: "list",
    args,
    errors: [],
    flags,
    globalFlags: {
      help: false,
      version: false,
      json: false,
      debug: false,
      noColor: false,
    },
  };
}

describe("list command handler", () => {
  let mockClient: jest.Mocked<McpClient>;
  let mockOutput: MockOutputWriter;

  beforeEach(() => {
    mockOutput = createMockOutputWriter();

    // Create mock client
    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;
  });

  it("should call MCP tool and display items", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [
        {
          id: 1,
          decision: "Test item",
          status: "pending",
          priority: "medium",
          tags: [],
          created_at: "2024-01-15T10:00:00.000Z",
        },
      ],
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {});
    expect(mockOutput.getOutput()).toContain("Found 1 item(s)");
    expect(exitCode).toBe(0);
  });

  it("should handle empty list", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockOutput.getOutput()).toContain("No items found");
    expect(exitCode).toBe(0);
  });

  it("should handle MCP tool errors", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: "Failed to list",
    });

    const parsed = createParsedArgs();

    await expect(
      handleList(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Failed to list");
  });

  it("should handle exceptions", async () => {
    mockClient.callTool.mockRejectedValue(new Error("Network error"));

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Network error");
    expect(exitCode).toBe(1);
  });

  it("should filter by status flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { status: "pending" };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {
      status: "pending",
    });
    expect(exitCode).toBe(0);
  });

  it("should filter by priority flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { priority: "high" };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {
      priority: "high",
    });
    expect(exitCode).toBe(0);
  });

  it("should filter by tags flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { tags: ["urgent"] };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {
      tags: ["urgent"],
    });
    expect(exitCode).toBe(0);
  });

  it("should apply limit flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { limit: 10 };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {
      limit: 10,
    });
    expect(exitCode).toBe(0);
  });

  it("should combine multiple filter flags", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { status: "pending", priority: "high", limit: 5 };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_list", {
      status: "pending",
      priority: "high",
      limit: 5,
    });
    expect(exitCode).toBe(0);
  });

  it("should format output as JSON when --json flag is set", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.globalFlags = {
      help: false,
      version: false,
      json: true,
      debug: false,
      noColor: false,
    };
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(() => JSON.parse(output)).not.toThrow();
    expect(exitCode).toBe(0);
  });

  it("should handle error without error message", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      // No error field - should use default message
    });

    const parsed = createParsedArgs();

    await expect(
      handleList(parsed, mockClient, mockOutput)
    ).rejects.toThrow("List failed");
  });

  it("should handle non-Error exceptions", async () => {
    mockClient.callTool.mockRejectedValue("String error"); // Not an Error object

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Unknown error");
    expect(exitCode).toBe(1);
  });

  it("should handle result with undefined items", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      // No items field
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient, mockOutput);

    expect(mockOutput.getOutput()).toContain("No items found");
    expect(exitCode).toBe(0);
  });
});
