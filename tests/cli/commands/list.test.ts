import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleList } from '../../../src/cli/commands/list.js';
import { McpClient } from '../../../src/cli/mcp-client.js';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

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

    const exitCode = await handleList([], mockClient);

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

    const exitCode = await handleList([], mockClient);

    expect(mockConsoleLog).toHaveBeenCalledWith('No items found.');
    expect(exitCode).toBe(0);
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Failed to list',
    });

    const exitCode = await handleList([], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to list')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const exitCode = await handleList([], mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
    expect(exitCode).toBe(1);
  });
});
