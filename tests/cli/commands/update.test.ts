import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { handleUpdate } from "../../../src/cli/commands/update.js";
import { McpClient } from "../../../src/cli/mcp-client.js";
import { ParsedArgs } from "../../../src/cli/parser.js";
import {
  createMockOutputWriter,
  MockOutputWriter,
} from "../../../src/cli/output/writer.js";

function createParsedArgs(
  args: string[],
  flags: Record<string, unknown> = {},
): ParsedArgs {
  return {
    subcommand: "update",
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

describe("update command handler", () => {
  let mockClient: jest.Mocked<McpClient>;
  let mockOutput: MockOutputWriter;

  beforeEach(() => {
    mockOutput = createMockOutputWriter();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;
  });

  it("should update item priority", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      item: { id: 5, priority: "high" },
    });

    const parsed = createParsedArgs(["5"], { priority: "high" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      priority: "high",
    });
    expect(exitCode).toBe(0);
  });

  it("should update multiple fields", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      item: { id: 5, priority: "high", status: "done" },
    });

    const parsed = createParsedArgs(["5"], {
      priority: "high",
      status: "done",
    });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      priority: "high",
      status: "done",
    });
    expect(exitCode).toBe(0);
  });

  it("should add tags", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      item: { id: 5 },
    });

    const parsed = createParsedArgs(["5"], {
      "add-tags": ["urgent", "review"],
    });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      add_tags: ["urgent", "review"],
    });
    expect(exitCode).toBe(0);
  });

  it("should remove tags", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      item: { id: 5 },
    });

    const parsed = createParsedArgs(["5"], { "remove-tags": ["old"] });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      remove_tags: ["old"],
    });
    expect(exitCode).toBe(0);
  });

  it("should throw error when no ID provided", async () => {
    const parsed = createParsedArgs([], { priority: "high" });

    await expect(
      handleUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Item ID is required");
  });

  it("should throw error for invalid ID", async () => {
    const parsed = createParsedArgs(["abc"], { priority: "high" });

    await expect(
      handleUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Invalid ID");
  });

  it("should throw error when no changes provided", async () => {
    const parsed = createParsedArgs(["5"], {});

    await expect(
      handleUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("No update fields provided");
  });

  it("should handle MCP tool errors", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: "Item not found",
    });

    const parsed = createParsedArgs(["99"], { priority: "high" });

    await expect(
      handleUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Item not found");
  });

  it("should handle exceptions", async () => {
    mockClient.callTool.mockRejectedValue(new Error("Network error"));

    const parsed = createParsedArgs(["5"], { priority: "high" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Network error");
    expect(exitCode).toBe(1);
  });

  it("should update with dependencies", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      item: { id: 5, dependencies: [1, 2] },
    });

    const parsed = createParsedArgs(["5"], { deps: ["1", "2"] });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      dependencies: [1, 2],
    });
    expect(exitCode).toBe(0);
  });

  it("should update decision field", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
    });

    const parsed = createParsedArgs(["5"], { decision: "New decision text" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      decision: "New decision text",
    });
    expect(exitCode).toBe(0);
  });

  it("should update context field", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
    });

    const parsed = createParsedArgs(["5"], { context: "New context" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      context: "New context",
    });
    expect(exitCode).toBe(0);
  });

  it("should update status field", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
    });

    const parsed = createParsedArgs(["5"], { status: "done" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_update", {
      id: 5,
      status: "done",
    });
    expect(exitCode).toBe(0);
  });

  it("should display warnings if present", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      warnings: ["Warning: Invalid transition", "Warning: Check dependencies"],
    });

    const parsed = createParsedArgs(["5"], { priority: "high" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(output).toContain("Item updated");
    expect(output).toContain("Warning: Invalid transition");
    expect(output).toContain("Warning: Check dependencies");
    expect(exitCode).toBe(0);
  });

  it("should handle empty warnings array", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: "Item updated",
      warnings: [],
    });

    const parsed = createParsedArgs(["5"], { priority: "high" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    const outputLines = mockOutput.getOutputLines();
    expect(outputLines.length).toBe(1);
    expect(outputLines[0]).toContain("Item updated");
    expect(exitCode).toBe(0);
  });

  it("should handle non-Error exception", async () => {
    mockClient.callTool.mockRejectedValue("String error");

    const parsed = createParsedArgs(["5"], { priority: "high" });
    const exitCode = await handleUpdate(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Unknown error");
    expect(exitCode).toBe(1);
  });

  it("should throw error for invalid dependency ID", async () => {
    const parsed = createParsedArgs(["5"], { deps: ["1", "invalid", "3"] });

    await expect(
      handleUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Invalid dependency ID: invalid");
  });
});
