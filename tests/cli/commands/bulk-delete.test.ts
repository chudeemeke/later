import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleBulkDelete } from '../../../src/cli/commands/bulk-delete.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

function createParsedArgs(args: string[], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'bulk-delete',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('bulk-delete command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should soft delete multiple items by default', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 3,
      failedCount: 0,
      processed: [1, 2, 3],
      failed: [],
    });

    const parsed = createParsedArgs(['1,2,3']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_bulk_delete', {
      ids: [1, 2, 3],
      hard: false,
    });
    expect(exitCode).toBe(0);
  });

  it('should hard delete when --hard flag provided', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 2,
      succeeded: 2,
      failedCount: 0,
      processed: [5, 6],
      failed: [],
    });

    const parsed = createParsedArgs(['5,6'], { hard: true });
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_bulk_delete', {
      ids: [5, 6],
      hard: true,
    });
    expect(exitCode).toBe(0);
  });

  it('should handle partial success', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 2,
      failedCount: 1,
      processed: [1, 2],
      failed: [{ id: 3, error: 'Not found' }],
    });

    const parsed = createParsedArgs(['1,2,3']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(exitCode).toBe(1); // Non-zero because some failed
  });

  it('should handle all failures', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      total: 2,
      succeeded: 0,
      failedCount: 2,
      processed: [],
      failed: [
        { id: 1, error: 'Not found' },
        { id: 2, error: 'Not found' },
      ],
    });

    const parsed = createParsedArgs(['1,2']);

    await expect(async () => {
      await handleBulkDelete(parsed, mockClient);
    }).rejects.toThrow();
  });

  it('should throw error when no IDs provided', async () => {
    const parsed = createParsedArgs([]);

    await expect(async () => {
      await handleBulkDelete(parsed, mockClient);
    }).rejects.toThrow('Item IDs are required');
  });

  it('should throw error for invalid ID in list', async () => {
    const parsed = createParsedArgs(['1,abc,3']);

    await expect(async () => {
      await handleBulkDelete(parsed, mockClient);
    }).rejects.toThrow('Invalid ID');
  });

  it('should handle spaces in ID list', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 3,
      succeeded: 3,
      failedCount: 0,
      processed: [1, 2, 3],
      failed: [],
    });

    const parsed = createParsedArgs(['1, 2, 3']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_bulk_delete', {
      ids: [1, 2, 3],
      hard: false,
    });
    expect(exitCode).toBe(0);
  });

  it('should handle single item deletion', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 1,
      succeeded: 1,
      failedCount: 0,
      processed: [10],
      failed: [],
    });

    const parsed = createParsedArgs(['10']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_bulk_delete', {
      ids: [10],
      hard: false,
    });
    expect(exitCode).toBe(0);
  });

  it('should handle large batch of IDs', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 20,
      succeeded: 20,
      failedCount: 0,
      processed: ids,
      failed: [],
    });

    const parsed = createParsedArgs([ids.join(',')]);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_bulk_delete', {
      ids,
      hard: false,
    });
    expect(exitCode).toBe(0);
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['1,2']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should handle JSON output mode', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 2,
      succeeded: 2,
      failedCount: 0,
      processed: [1, 2],
      failed: [],
    });

    const parsed = createParsedArgs(['1,2']);
    parsed.globalFlags = { ...parsed.globalFlags!, json: true };

    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should display detailed results', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      total: 4,
      succeeded: 3,
      failedCount: 1,
      processed: [1, 2, 3],
      failed: [{ id: 4, error: 'Item has dependencies' }],
    });

    const parsed = createParsedArgs(['1,2,3,4']);
    const exitCode = await handleBulkDelete(parsed, mockClient);

    expect(mockConsoleLog).toHaveBeenCalled();
    expect(exitCode).toBe(1); // Should return 1 because some failed
  });
});
