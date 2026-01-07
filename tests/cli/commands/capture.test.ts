import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { handleCapture } from "../../../src/cli/commands/capture.js";
import { McpClient } from "../../../src/cli/mcp-client.js";
import { ParsedArgs } from "../../../src/cli/parser.js";
import {
  createMockOutputWriter,
  MockOutputWriter,
} from "../../../src/cli/output/writer.js";

// Helper to create ParsedArgs
function createParsedArgs(
  args: string[],
  flags: Record<string, unknown> = {},
): ParsedArgs {
  return {
    subcommand: "capture",
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

describe("capture command handler", () => {
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

  it("should call MCP tool with decision text", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"]);
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
    });
    expect(mockOutput.getOutput()).toContain("Captured as item #1");
    expect(exitCode).toBe(0);
  });

  it("should return error when no decision provided", async () => {
    const parsed = createParsedArgs([]);

    await expect(
      handleCapture(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Decision text is required");
  });

  it("should handle MCP tool errors", async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: "Failed to capture",
    });

    const parsed = createParsedArgs(["Test"]);

    await expect(
      handleCapture(parsed, mockClient, mockOutput)
    ).rejects.toThrow("Failed to capture");
  });

  it("should handle exceptions", async () => {
    mockClient.callTool.mockRejectedValue(new Error("Network error"));

    const parsed = createParsedArgs(["Test"]);
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Network error");
    expect(exitCode).toBe(1);
  });

  it("should display warnings if present", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
      warnings: ["Warning 1", "Warning 2"],
    });

    const parsed = createParsedArgs(["Test"]);
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    const output = mockOutput.getOutput();
    expect(output).toContain("Captured as item #1");
    expect(output).toContain("Warning 1");
    expect(output).toContain("Warning 2");
    expect(exitCode).toBe(0);
  });

  it("should pass context flag to MCP server", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      context: "Some context for the decision",
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      context: "Some context for the decision",
    });
    expect(exitCode).toBe(0);
  });

  it("should pass tags flag to MCP server", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      tags: ["urgent", "review"],
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      tags: ["urgent", "review"],
    });
    expect(exitCode).toBe(0);
  });

  it("should handle --high flag shorthand for priority", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      high: true,
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      priority: "high",
    });
    expect(exitCode).toBe(0);
  });

  it("should handle --priority flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      priority: "low",
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      priority: "low",
    });
    expect(exitCode).toBe(0);
  });

  it("should prioritize --high flag over --priority flag", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      high: true,
      priority: "low", // This should be ignored
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      priority: "high", // --high takes precedence
    });
    expect(exitCode).toBe(0);
  });

  it("should pass all flags together", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
    });

    const parsed = createParsedArgs(["Test decision"], {
      context: "Context here",
      tags: ["tag1", "tag2"],
      priority: "medium",
    });
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockClient.callTool).toHaveBeenCalledWith("later_capture", {
      decision: "Test decision",
      context: "Context here",
      tags: ["tag1", "tag2"],
      priority: "medium",
    });
    expect(exitCode).toBe(0);
  });

  it("should handle non-Error exception", async () => {
    mockClient.callTool.mockRejectedValue("String error");

    const parsed = createParsedArgs(["Test"]);
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    expect(mockOutput.getErrors()).toContain("Unknown error");
    expect(exitCode).toBe(1);
  });

  it("should handle empty warnings array", async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: "Captured as item #1",
      warnings: [],
    });

    const parsed = createParsedArgs(["Test"]);
    const exitCode = await handleCapture(parsed, mockClient, mockOutput);

    // Should not log any warnings since array is empty
    const outputLines = mockOutput.getOutputLines();
    expect(outputLines.length).toBe(1); // Only the success message
    expect(outputLines[0]).toContain("Captured as item #1");
    expect(exitCode).toBe(0);
  });
});
