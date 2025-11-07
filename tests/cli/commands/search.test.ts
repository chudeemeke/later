import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handleSearch } from '../../../src/cli/commands/search.js';
import { McpClient } from '../../../src/cli/mcp-client.js';
import { ParsedArgs } from '../../../src/cli/parser.js';

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

function createParsedArgs(args: string[], flags: Record<string, any> = {}): ParsedArgs {
  return {
    subcommand: 'search',
    args,
    errors: [],
    flags,
    globalFlags: { help: false, version: false, json: false, debug: false, noColor: false },
  };
}

describe('search command handler', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    mockClient = {
      callTool: jest.fn(),
      close: jest.fn(),
    } as any;
  });

  it('should search with query', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Database decision', status: 'pending', priority: 'high', tags: [] },
          score: 0.95,
          matches: { decision: 1, context: 0, tags: 0 },
        },
      ],
    });

    const parsed = createParsedArgs(['database']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_search', {
      query: 'database',
    });
    expect(mockConsoleLog).toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it('should search with fields filter', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [],
    });

    const parsed = createParsedArgs(['test'], { fields: ['decision', 'tags'] });
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_search', {
      query: 'test',
      fields: ['decision', 'tags'],
    });
    expect(exitCode).toBe(0);
  });

  it('should search with limit', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [],
    });

    const parsed = createParsedArgs(['query'], { limit: 5 });
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_search', {
      query: 'query',
      limit: 5,
    });
    expect(exitCode).toBe(0);
  });

  it('should search with min-score filter', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [],
    });

    const parsed = createParsedArgs(['test'], { 'min-score': 0.8 });
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_search', {
      query: 'test',
      minScore: 0.8,
    });
    expect(exitCode).toBe(0);
  });

  it('should search with all options', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [],
    });

    const parsed = createParsedArgs(['test'], {
      fields: ['decision'],
      limit: 10,
      'min-score': 0.5,
    });
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockClient.callTool).toHaveBeenCalledWith('later_search', {
      query: 'test',
      fields: ['decision'],
      limit: 10,
      minScore: 0.5,
    });
    expect(exitCode).toBe(0);
  });

  it('should handle empty results', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [],
    });

    const parsed = createParsedArgs(['nonexistent']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should handle multiple results', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Test 1', status: 'pending', priority: 'high', tags: [] },
          score: 0.95,
          matches: { decision: 1 },
        },
        {
          item: { id: 2, decision: 'Test 2', status: 'done', priority: 'medium', tags: ['tag'] },
          score: 0.85,
          matches: { decision: 1 },
        },
      ],
    });

    const parsed = createParsedArgs(['test']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should throw error when no query provided', async () => {
    const parsed = createParsedArgs([]);

    await expect(async () => {
      await handleSearch(parsed, mockClient);
    }).rejects.toThrow('Search query is required');
  });

  it('should handle MCP tool errors', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      error: 'Search failed',
    });

    const parsed = createParsedArgs(['test']);

    await expect(async () => {
      await handleSearch(parsed, mockClient);
    }).rejects.toThrow('Search failed');
  });

  it('should handle exceptions', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Network error'));

    const parsed = createParsedArgs(['test']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });

  it('should format results with scores', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'High score result', status: 'pending', priority: 'high', tags: [] },
          score: 0.95,
          matches: { decision: 2, context: 1 },
        },
      ],
    });

    const parsed = createParsedArgs(['test']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
  });

  it('should handle JSON output mode', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Test', status: 'pending', priority: 'high', tags: [] },
          score: 0.9,
          matches: { decision: 1 },
        },
      ],
    });

    const parsed = createParsedArgs(['test']);
    parsed.globalFlags = { ...parsed.globalFlags!, json: true };

    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
    // Should output JSON
    const output = mockConsoleLog.mock.calls[0][0];
    expect(typeof output).toBe('string');
  });

  it('should transform results with matchedFields for table display', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Test decision', status: 'pending', priority: 'high', tags: [] },
          score: 0.95,
          matches: { decision: 2, context: 1 },  // Multiple matched fields
        },
      ],
    });

    const parsed = createParsedArgs(['test']);

    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should handle result with undefined error field', async () => {
    mockClient.callTool.mockResolvedValue({
      success: false,
      // No error field - should use default message
    });

    const parsed = createParsedArgs(['test']);

    await expect(async () => {
      await handleSearch(parsed, mockClient);
    }).rejects.toThrow('Search failed');
  });

  it('should handle non-Error exceptions', async () => {
    mockClient.callTool.mockRejectedValue('String error');  // Not an Error object

    const parsed = createParsedArgs(['test']);
    const exitCode = await handleSearch(parsed, mockClient);

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error')
    );
    expect(exitCode).toBe(1);
  });

  it('should handle results with empty matches object', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Test', status: 'pending', priority: 'high', tags: [] },
          score: 0.5,
          matches: {},  // Empty matches
        },
      ],
    });

    const parsed = createParsedArgs(['test']);

    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
  });

  it('should handle results with undefined matches', async () => {
    mockClient.callTool.mockResolvedValue({
      success: true,
      results: [
        {
          item: { id: 1, decision: 'Test', status: 'pending', priority: 'high', tags: [] },
          score: 0.5,
          // No matches field
        },
      ],
    });

    const parsed = createParsedArgs(['test']);

    const exitCode = await handleSearch(parsed, mockClient);

    expect(exitCode).toBe(0);
  });
});
