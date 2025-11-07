import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleDelete } from '../../../src/cli/commands/delete.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

function createParsedArgs(args: string[], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'delete',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('delete command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should soft delete item by default', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item deleted (soft)',
    });

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_delete', { id: 5, hard: false });
    expect(exitCode).toBe(0);
  });

  it('should hard delete when --hard flag provided', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item deleted (permanent)',
    });

    const parsed = createParsedArgs(['5'], { hard: true });
    const exitCode = await handleDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_delete', { id: 5, hard: true });
    expect(exitCode).toBe(0);
  });

  it('should throw error when no ID provided', async () => {
    const parsed = createParsedArgs([]);

    await expect(async () => {
      await handleDelete(parsed, mockClient);
    }).rejects.toThrow('Item ID is required');
  });

  it('should throw error for invalid ID', async () => {
    const parsed = createParsedArgs(['abc']);

    await expect(async () => {
      await handleDelete(parsed, mockClient);
    }).rejects.toThrow('Invalid ID');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Item not found',
    });

    const parsed = createParsedArgs(['99']);

    await expect(async () => {
      await handleDelete(parsed, mockClient);
    }).rejects.toThrow('Item not found');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleDelete(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should display warnings if present', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Deleted item #5',
      warnings: ['Warning: This item has dependencies', 'Warning: Check related items'],
    });

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleDelete(parsed, mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('Deleted item #5');
    expect(mockConsoleLog).toHaveBeenCalledWith('⚠️  Warning: This item has dependencies');
    expect(mockConsoleLog).toHaveBeenCalledWith('⚠️  Warning: Check related items');
    expect(exitCode).toBe(0);
  });

  it('should handle empty warnings array', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Deleted item #5',
      warnings: [],
    });

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleDelete(parsed, mockClient);

    // Should only log the success message
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    expect(mockConsoleLog).toHaveBeenCalledWith('Deleted item #5');
    expect(exitCode).toBe(0);
  });

  it('should handle non-Error exception', async () => {
    mockClient.callTool.mockRejectedValue('String error');

    const parsed = createParsedArgs(['5']);
    const exitCode = await handleDelete(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
    expect(exitCode).toBe(1);
  });
});
