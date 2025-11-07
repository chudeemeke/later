import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleList } from '../../../src/cli/commands/list.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Helper to create ParsedArgs
function createParsedArgs(args: string[] = [], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'list',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('list command handler', () => {
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

  it('should call MCP tool and display items', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [
        {
          id: 1,
          decision: 'Test item',
          status: 'pending',
          priority: 'medium',
          tags: [],
          created_at: '2024-01-15T10:00:00.000Z',
        },
      ],
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', {});
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 item(s)')
    );
    expect(exitCode).toBe(0);
  });

  it('should handle empty list', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('No items found.');
    expect(exitCode).toBe(0);
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Failed to list',
    });

    const parsed = createParsedArgs();

    await expect(async () => {
      await handleList(parsed, mockClient);
    }).rejects.toThrow('Failed to list');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
    expect(exitCode).toBe(1);
  });

  it('should filter by status flag', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { status: 'pending' };
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', { status: 'pending' });
    expect(exitCode).toBe(0);
  });

  it('should filter by priority flag', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { priority: 'high' };
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', { priority: 'high' });
    expect(exitCode).toBe(0);
  });

  it('should filter by tags flag', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { tags: ['urgent'] };
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', { tags: ['urgent'] });
    expect(exitCode).toBe(0);
  });

  it('should apply limit flag', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { limit: 10 };
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', { limit: 10 });
    expect(exitCode).toBe(0);
  });

  it('should combine multiple filter flags', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.flags = { status: 'pending', priority: 'high', limit: 5 };
    const exitCode = await handleList(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_list', {
      status: 'pending',
      priority: 'high',
      limit: 5
    });
    expect(exitCode).toBe(0);
  });

  it('should format output as JSON when --json flag is set', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      items: [],
    });

    const parsed = createParsedArgs();
    parsed.globalFlags = { help: false, version: false, json: true, debug: false, noColor: false };
    const exitCode = await handleList(parsed, mockClient);

    const output = mockConsoleLog.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
    expect(exitCode).toBe(0);
  });

  it('should handle error without error message', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      // No error field - should use default message
    });

    const parsed = createParsedArgs();

    await expect(async () => {
      await handleList(parsed, mockClient);
    }).rejects.toThrow('List failed');
  });

  it('should handle non-Error exceptions', async () => {
    mockClient.callTool.mockRejectedValue('String error');  // Not an Error object

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle result with undefined items', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      // No items field
    });

    const parsed = createParsedArgs();
    const exitCode = await handleList(parsed, mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('No items found.');
    expect(exitCode).toBe(0);
  });
});
