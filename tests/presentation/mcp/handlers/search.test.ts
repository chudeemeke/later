/**
 * MCP Search Handler Tests
 *
 * Tests for the MCP-facing search handler that wraps SearchItemsQuery.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createContainer, Container } from '../../../../src/presentation/composition-root.js';
import { createCaptureHandler } from '../../../../src/presentation/mcp/handlers/capture.js';
import { createSearchHandler, SearchArgs, SearchResult } from '../../../../src/presentation/mcp/handlers/search.js';

describe('MCP Search Handler', () => {
  let testDir: string;
  let container: Container;
  let searchHandler: (args: SearchArgs) => Promise<SearchResult>;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'later-search-handler-test-'));
    container = createContainer({ dataDir: testDir });
    searchHandler = createSearchHandler(container);

    // Seed test data
    const captureHandler = createCaptureHandler(container);
    await captureHandler({
      decision: 'Optimize database queries',
      context: 'Performance is slow on large datasets',
      tags: ['database', 'performance'],
      priority: 'high',
    });
    await captureHandler({
      decision: 'Refactor authentication module',
      context: 'Security improvements needed',
      tags: ['security', 'auth'],
      priority: 'high',
    });
    await captureHandler({
      decision: 'Add caching layer',
      context: 'Improve response times with Redis cache',
      tags: ['performance', 'cache'],
      priority: 'medium',
    });
  }, 30000); // Increased timeout for Windows/WSL I/O

  afterEach(async () => {
    await container.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  }, 30000); // Increased timeout for Windows/WSL cleanup

  describe('Basic search', () => {
    it('should find items by decision text', async () => {
      const result = await searchHandler({ query: 'database' });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results!.length).toBeGreaterThan(0);
      expect(result.results![0].decision).toContain('database');
    });

    it('should find items by context text', async () => {
      const result = await searchHandler({ query: 'Redis' });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBeGreaterThan(0);
    });

    it('should return relevance scores', async () => {
      const result = await searchHandler({ query: 'performance' });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBeGreaterThan(0);
      expect(result.results![0].score).toBeGreaterThan(0);
    });

    it('should return formatted output', async () => {
      const result = await searchHandler({ query: 'database' });

      expect(result.formatted_output).toBeDefined();
      expect(result.formatted_output).toContain('database');
    });
  });

  describe('Filtering', () => {
    it('should filter by priority', async () => {
      const result = await searchHandler({ query: 'database', priority: 'high' });

      expect(result.success).toBe(true);
      expect(result.results!.every((r) => r.priority === 'high')).toBe(true);
    });

    it('should filter by tags', async () => {
      const result = await searchHandler({ query: 'Optimize', tags: ['performance'] });

      expect(result.success).toBe(true);
      if (result.results!.length > 0) {
        expect(result.results![0].tags).toContain('performance');
      }
    });
  });

  describe('Pagination', () => {
    it('should limit results', async () => {
      const result = await searchHandler({ query: 'the', limit: 1 });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBeLessThanOrEqual(1);
    });

    it('should include total count', async () => {
      const result = await searchHandler({ query: 'the', limit: 1 });

      expect(result.total_count).toBeDefined();
    });

    it('should indicate if more results exist', async () => {
      const result = await searchHandler({ query: 'the', limit: 1 });

      expect(result.has_more).toBeDefined();
    });

    it('should support offset', async () => {
      const result = await searchHandler({ query: 'the', limit: 1, offset: 1 });

      expect(result.success).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should fail for empty query', async () => {
      const result = await searchHandler({ query: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('query');
    });

    it('should fail for whitespace-only query', async () => {
      const result = await searchHandler({ query: '   ' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('query');
    });
  });

  describe('Response format', () => {
    it('should use snake_case for MCP compatibility', async () => {
      const result = await searchHandler({ query: 'database' });

      expect(result).toHaveProperty('total_count');
      expect(result).toHaveProperty('has_more');
      expect(result).toHaveProperty('formatted_output');

      if (result.results!.length > 0) {
        expect(result.results![0]).toHaveProperty('created_at');
        expect(result.results![0]).toHaveProperty('updated_at');
      }
    });

    it('should include success flag', async () => {
      const result = await searchHandler({ query: 'test' });
      expect(typeof result.success).toBe('boolean');
    });

    it('should include results array', async () => {
      const result = await searchHandler({ query: 'test' });
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Empty results', () => {
    it('should handle no matches gracefully', async () => {
      const result = await searchHandler({ query: 'xyznonexistent' });

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it('should include "No results" in formatted output', async () => {
      const result = await searchHandler({ query: 'xyznonexistent' });

      expect(result.formatted_output).toContain('No results');
    });
  });
});
