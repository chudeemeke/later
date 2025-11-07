import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleUpdate } from '../../../src/cli/commands/update.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

function createParsedArgs(args: string[], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'update',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('update command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should update item priority', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item updated',
      item: { id: 5, priority: 'high' },
    });

    const parsed = createParsedArgs(['5'], { priority: 'high' });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_update', {
      id: 5,
      priority: 'high',
    });
    expect(exitCode).toBe(0);
  });

  it('should update multiple fields', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item updated',
      item: { id: 5, priority: 'high', status: 'done' },
    });

    const parsed = createParsedArgs(['5'], { priority: 'high', status: 'done' });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_update', {
      id: 5,
      priority: 'high',
      status: 'done',
    });
    expect(exitCode).toBe(0);
  });

  it('should add tags', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item updated',
      item: { id: 5 },
    });

    const parsed = createParsedArgs(['5'], { 'add-tags': ['urgent', 'review'] });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_update', {
      id: 5,
      add_tags: ['urgent', 'review'],
    });
    expect(exitCode).toBe(0);
  });

  it('should remove tags', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item updated',
      item: { id: 5 },
    });

    const parsed = createParsedArgs(['5'], { 'remove-tags': ['old'] });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_update', {
      id: 5,
      remove_tags: ['old'],
    });
    expect(exitCode).toBe(0);
  });

  it('should throw error when no ID provided', async () => {
    const parsed = createParsedArgs([], { priority: 'high' });

    await expect(async () => {
      await handleUpdate(parsed, mockClient);
    }).rejects.toThrow('Item ID is required');
  });

  it('should throw error for invalid ID', async () => {
    const parsed = createParsedArgs(['abc'], { priority: 'high' });

    await expect(async () => {
      await handleUpdate(parsed, mockClient);
    }).rejects.toThrow('Invalid ID');
  });

  it('should throw error when no changes provided', async () => {
    const parsed = createParsedArgs(['5'], {});

    await expect(async () => {
      await handleUpdate(parsed, mockClient);
    }).rejects.toThrow('No update fields provided');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Item not found',
    });

    const parsed = createParsedArgs(['99'], { priority: 'high' });

    await expect(async () => {
      await handleUpdate(parsed, mockClient);
    }).rejects.toThrow('Item not found');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['5'], { priority: 'high' });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should update with dependencies', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item updated',
      item: { id: 5, dependencies: [1, 2] },
    });

    const parsed = createParsedArgs(['5'], { deps: [1, 2] });
    const exitCode = await handleUpdate(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_update', {
      id: 5,
      dependencies: [1, 2],
    });
    expect(exitCode).toBe(0);
  });
});
