import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleShow } from '../../../src/cli/commands/show.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Helper to create ParsedArgs
function createParsedArgs(args: string[]): ParsedArgs {
  return {
    subcommand: 'show',
    args,
    errors: [],
    flags: {},
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('show command handler', () => {
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

  it('should call MCP tool with item ID and display details', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item: {
        id: 5,
        decision: 'Test item',
        status: 'pending',
        priority: 'high',
        tags: ['test'],
        created_at: '2024-01-15T10:00:00.000Z',
      },
    });

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleShow(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_show', { id: 5 });
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Item #5')
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Test item')
    );
    expect(exitCode).toBe(0);
  });

  it('should return error when no ID provided', async () => {
    const parsed = createParsedArgs([]);

    await expect(async () => {
      await handleShow(parsed, mockClient);
    }).rejects.toThrow('Item ID is required');
  });

  it('should return error for invalid ID', async () => {
    const parsed = createParsedArgs(['abc']);

    await expect(async () => {
      await handleShow(parsed, mockClient);
    }).rejects.toThrow('Invalid ID');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Item not found',
    });

    const parsed = createParsedArgs(['99']);

    await expect(async () => {
      await handleShow(parsed, mockClient);
    }).rejects.toThrow('Item not found');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleShow(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle item not found gracefully', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item: null,
    });

    const parsed = createParsedArgs(['99']);

    await expect(async () => {
      await handleShow(parsed, mockClient);
    }).rejects.toThrow('Item #99 not found');
  });

  it('should format output as JSON when --json flag is set', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      item: {
        id: 1,
        decision: 'Test item',
        context: 'Test context',
        status: 'pending',
        priority: 'medium',
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    const parsed = createParsedArgs(['1']);
    parsed.globalFlags = { ...parsed.globalFlags!, json: true };

    const exitCode = await handleShow(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
    const output = mockConsoleLog.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should handle non-Error exceptions', async () => {
    mockClient.callTool.mockRejectedValue('String error');  // Not an Error object

    const parsed = createParsedArgs(['1']);
    const exitCode = await handleShow(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
    expect(exitCode).toBe(1);
  });

  it('should use default error message when result.error is undefined', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      // No error field
    });

    const parsed = createParsedArgs(['999']);

    await expect(async () => {
      await handleShow(parsed, mockClient);
    }).rejects.toThrow('Item #999 not found');
  });
});
