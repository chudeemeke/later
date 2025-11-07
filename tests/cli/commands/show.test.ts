import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleShow } from '../../../src/cli/commands/show.js';
import { McpClient } from '../../../src/cli/mcp-client.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

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

    const exitCode = await handleShow(['5'], mockClient);

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
    const exitCode = await handleShow([], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Item ID is required')
    );
    expect(exitCode).toBe(1);
  });

  it('should return error for invalid ID', async () => {
    const exitCode = await handleShow(['abc'], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Invalid ID')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Item not found',
    });

    const exitCode = await handleShow(['99'], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Item not found')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const exitCode = await handleShow(['5'], mockClient);

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

    const exitCode = await handleShow(['99'], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Item #99 not found')
    );
    expect(exitCode).toBe(1);
  });
});
