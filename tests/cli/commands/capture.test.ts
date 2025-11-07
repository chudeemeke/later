import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleCapture } from '../../../src/cli/commands/capture.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Helper to create ParsedArgs
function createParsedArgs(args: string[], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'capture',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('capture command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Create mock client
    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should call MCP tool with decision text', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: 'Captured as item #1',
    });

    const parsed = createParsedArgs(['Test decision']);
    const exitCode = await handleCapture(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_capture', {
      decision: 'Test decision',
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Captured as item #1');
    expect(exitCode).toBe(0);
  });

  it('should return error when no decision provided', async () => {
    const parsed = createParsedArgs([]);

    await expect(async () => {
      await handleCapture(parsed, mockClient);
    }).rejects.toThrow('Decision text is required');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Failed to capture',
    });

    const parsed = createParsedArgs(['Test']);

    await expect(async () => {
      await handleCapture(parsed, mockClient);
    }).rejects.toThrow('Failed to capture');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['Test']);
    const exitCode = await handleCapture(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
    expect(exitCode).toBe(1);
  });

  it('should display warnings if present', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item_id: 1,
      message: 'Captured as item #1',
      warnings: ['Warning 1', 'Warning 2'],
    });

    const parsed = createParsedArgs(['Test']);
    const exitCode = await handleCapture(parsed, mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('Captured as item #1');
    expect(mockConsoleLog).toHaveBeenCalledWith('Warning 1');
    expect(mockConsoleLog).toHaveBeenCalledWith('Warning 2');
    expect(exitCode).toBe(0);
  });
});
