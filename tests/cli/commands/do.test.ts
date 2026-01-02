import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { handleDo } from "../../../src/cli/commands/do.js";
import { McpClient } from "../../../src/cli/mcp-client.js";
import {
  createMockOutputWriter,
  MockOutputWriter,
} from "../../../src/cli/output/writer.js";

describe("do command handler", () => {
  let mockClient: jest.Mocked<McpClient>;
  let mockOutput: MockOutputWriter;

  beforeEach(() => {
    mockOutput = createMockOutputWriter();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;
  });

  it("should mark item as in-progress", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item #5 marked as in_progress",
      item: { id: 5, status: "in_progress" },
    });

    const exitCode = await handleDo(["5"], mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_do", { id: 5 });
    expect(mockOutput.getOutput()).toContain("Item #5 marked as in_progress");
    expect(exitCode).toBe(0);
  });

  it("should throw error when no ID provided", async () => {
    await expect(async () => {
      await handleDo([], mockClient, mockOutput);
    }).rejects.toThrow("Item ID is required");
  });

  it("should throw error for invalid ID", async () => {
    await expect(async () => {
      await handleDo(["abc"], mockClient, mockOutput);
    }).rejects.toThrow("Invalid ID");
  });

  it("should handle MCP tool errors", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: "Item not found",
    });

    await expect(async () => {
      await handleDo(["99"], mockClient, mockOutput);
    }).rejects.toThrow("Item not found");
  });

  it("should handle exceptions", async () => {
    mockClient.callTool.mockRejectedValue(new Error("Network error"));

    const exitCode = await handleDo(["5"], mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Network error");
    expect(exitCode).toBe(1);
  });

  it("should display todo guidance when provided", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item #5 marked as in_progress",
      item: { id: 5, status: "in_progress" },
      todo_guidance: "Next: Review the implementation",
    });

    const exitCode = await handleDo(["5"], mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(output).toContain("Item #5 marked as in_progress");
    expect(output).toContain("Next: Review the implementation");
    expect(exitCode).toBe(0);
  });

  it("should display warnings when provided", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item #5 marked as in_progress",
      item: { id: 5, status: "in_progress" },
      warnings: "Warning: This item has dependencies",
    });

    const exitCode = await handleDo(["5"], mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(output).toContain("Item #5 marked as in_progress");
    expect(output).toContain("Warning: This item has dependencies");
    expect(exitCode).toBe(0);
  });

  it("should display both todo guidance and warnings", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item #5 marked as in_progress",
      item: { id: 5, status: "in_progress" },
      todo_guidance: "Next: Review the implementation",
      warnings: "Warning: This item has dependencies",
    });

    const exitCode = await handleDo(["5"], mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(output).toContain("Item #5 marked as in_progress");
    expect(output).toContain("Next: Review the implementation");
    expect(output).toContain("Warning: This item has dependencies");
    expect(exitCode).toBe(0);
  });

  it("should use default error message when result.error is undefined", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      // No error field
    });

    await expect(async () => {
      await handleDo(["999"], mockClient, mockOutput);
    }).rejects.toThrow("Item #999 not found");
  });

  it("should handle non-Error exceptions", async () => {
    mockClient.callTool.mockRejectedValue("String error"); // Not an Error object

    const exitCode = await handleDo(["1"], mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Unknown error");
    expect(exitCode).toBe(1);
  });
});
