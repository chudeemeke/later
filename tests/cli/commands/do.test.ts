import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleDo } from '../../../src/cli/commands/do.js';
import { McpClient } from '../../../src/cli/mcp-client.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('do command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should mark item as in-progress', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item #5 marked as in_progress',
      item: { id: 5, status: 'in_progress' },
    });

    const exitCode = await handleDo(['5'], mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_do', { id: 5 });
    expect(mockConsoleLog).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should throw error when no ID provided', async () => {
    await expect(async () => {
      await handleDo([], mockClient);
    }).rejects.toThrow('Item ID is required');
  });

  it('should throw error for invalid ID', async () => {
    await expect(async () => {
      await handleDo(['abc'], mockClient);
    }).rejects.toThrow('Invalid ID');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Item not found',
    });

    await expect(async () => {
      await handleDo(['99'], mockClient);
    }).rejects.toThrow('Item not found');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const exitCode = await handleDo(['5'], mockClient);

    expect(mockConsoleError).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should display todo guidance when provided', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item #5 marked as in_progress',
      item: { id: 5, status: 'in_progress' },
      todo_guidance: 'Next: Review the implementation',
    });

    const exitCode = await handleDo(['5'], mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('Item #5 marked as in_progress');
    expect(mockConsoleLog).toHaveBeenCalledWith('Next: Review the implementation');
    expect(exitCode).toBe(0);
  });

  it('should display warnings when provided', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item #5 marked as in_progress',
      item: { id: 5, status: 'in_progress' },
      warnings: 'Warning: This item has dependencies',
    });

    const exitCode = await handleDo(['5'], mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('Item #5 marked as in_progress');
    expect(mockConsoleLog).toHaveBeenCalledWith('Warning: This item has dependencies');
    expect(exitCode).toBe(0);
  });

  it('should display both todo guidance and warnings', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      message: 'Item #5 marked as in_progress',
      item: { id: 5, status: 'in_progress' },
      todo_guidance: 'Next: Review the implementation',
      warnings: 'Warning: This item has dependencies',
    });

    const exitCode = await handleDo(['5'], mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('Item #5 marked as in_progress');
    expect(mockConsoleLog).toHaveBeenCalledWith('Next: Review the implementation');
    expect(mockConsoleLog).toHaveBeenCalledWith('Warning: This item has dependencies');
    expect(exitCode).toBe(0);
  });
});
