import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { handleBulkUpdate } from "../../../src/cli/commands/bulk-update.js";
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
    subcommand: "bulk-update",
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

describe("bulk-update command handler", () => {
  let mockClient: jest.Mocked<McpClient>;
  let mockOutput: MockOutputWriter;

  beforeEach(() => {
    mockOutput = createMockOutputWriter();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;
  });

  it("should update multiple items with priority", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 3,
      failedCount: 0,
      processed: [1, 2, 3],
      failed: [],
    });

    const parsed = createParsedArgs(["1,2,3"], { priority: "high" });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [1, 2, 3],
      changes: { priority: "high" },
    });
    expect(exitCode).toBe(0);
  });

  it("should update with multiple changes", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 2,
      succeeded: 2,
      failedCount: 0,
      processed: [5, 6],
      failed: [],
    });

    const parsed = createParsedArgs(["5,6"], {
      priority: "low",
      status: "done",
      "add-tags": ["completed", "reviewed"],
    });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [5, 6],
      changes: {
        priority: "low",
        status: "done",
        add_tags: ["completed", "reviewed"],
      },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle partial success", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 2,
      failedCount: 1,
      processed: [1, 2],
      failed: [{ id: 3, error: "Not found" }],
    });

    const parsed = createParsedArgs(["1,2,3"], { priority: "high" });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(exitCode).toBe(1); // Non-zero because some failed
  });

  it("should handle all failures", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      total: 2,
      succeeded: 0,
      failedCount: 2,
      processed: [],
      failed: [
        { id: 1, error: "Not found" },
        { id: 2, error: "Not found" },
      ],
    });

    const parsed = createParsedArgs(["1,2"], { priority: "high" });

    await expect(
      handleBulkUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow();
  });

  it("should throw error when no IDs provided", async () => {
    const parsed = createParsedArgs([], { priority: "high" });

    await expect(
      handleBulkUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Item IDs are required");
  });

  it("should throw error for invalid ID in list", async () => {
    const parsed = createParsedArgs(["1,abc,3"], { priority: "high" });

    await expect(
      handleBulkUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Invalid ID");
  });

  it("should throw error when no changes provided", async () => {
    const parsed = createParsedArgs(["1,2,3"], {});

    await expect(
      handleBulkUpdate(parsed, mockClient, mockOutput)
    ).rejects.toThrow("No changes provided");
  });

  it("should handle spaces in ID list", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 3,
      failedCount: 0,
      processed: [1, 2, 3],
      failed: [],
    });

    const parsed = createParsedArgs(["1, 2, 3"], { priority: "high" });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [1, 2, 3],
      changes: { priority: "high" },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle decision update", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 1,
      succeeded: 1,
      failedCount: 0,
      processed: [5],
      failed: [],
    });

    const parsed = createParsedArgs(["5"], {
      decision: "Updated decision text",
    });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [5],
      changes: { decision: "Updated decision text" },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle context update", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 1,
      succeeded: 1,
      failedCount: 0,
      processed: [1],
      failed: [],
    });

    const parsed = createParsedArgs(["1"], { context: "New context" });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [1],
      changes: { context: "New context" },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle tags replacement", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 1,
      succeeded: 1,
      failedCount: 0,
      processed: [1],
      failed: [],
    });

    const parsed = createParsedArgs(["1"], { tags: ["new", "tags"] });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [1],
      changes: { tags: ["new", "tags"] },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle add-tags", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 2,
      succeeded: 2,
      failedCount: 0,
      processed: [1, 2],
      failed: [],
    });

    const parsed = createParsedArgs(["1,2"], { "add-tags": ["urgent"] });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_bulk_update", {
      ids: [1, 2],
      changes: { add_tags: ["urgent"] },
    });
    expect(exitCode).toBe(0);
  });

  it("should handle exceptions", async () => {
    mockClient.callTool.mockRejectedValue(new Error("Network error"));

    const parsed = createParsedArgs(["1,2"], { priority: "high" });
    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Network error");
    expect(exitCode).toBe(1);
  });

  it("should handle JSON output mode", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 2,
      succeeded: 2,
      failedCount: 0,
      processed: [1, 2],
      failed: [],
    });

    const parsed = createParsedArgs(["1,2"], { priority: "high" });
    parsed.globalFlags = { ...parsed.globalFlags!, json: true };

    const exitCode = await handleBulkUpdate(parsed, mockClient, mockOutput);

    expect(exitCode).toBe(0);
    expect(mockOutput.getOutput()).not.toBe("");
  });
});
