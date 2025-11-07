/**
 * search_tools Meta-Tool Tests
 * Tests for tool discovery and progressive disclosure
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleSearchTools } from '../../src/tools/meta/search-tools.js';
import { toolRegistry } from '../../src/registry.js';
import type { ToolMetadata } from '../../src/types/tool-metadata.js';

describe('search_tools', () => {
  beforeEach(() => {
    // Clear and re-register test tools
    toolRegistry.clear();

    const testTools: ToolMetadata[] = [
      {
        name: 'later_capture',
        category: 'core',
        keywords: ['create', 'add', 'capture', 'new', 'save'],
        priority: 10,
        description: 'Capture a new deferred decision',
        inputSchema: {
          type: 'object',
          properties: {
            decision: { type: 'string' }
          }
        },
        handler: async () => ({ success: true })
      },
      {
        name: 'later_list',
        category: 'core',
        keywords: ['list', 'show', 'all', 'view'],
        priority: 10,
        description: 'List all deferred items',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        handler: async () => ({ success: true })
      },
      {
        name: 'later_delete',
        category: 'workflow',
        keywords: ['delete', 'remove', 'discard'],
        priority: 5,
        description: 'Delete a deferred item',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number' }
          }
        },
        handler: async () => ({ success: true })
      },
      {
        name: 'later_search',
        category: 'search',
        keywords: ['search', 'find', 'query'],
        priority: 8,
        description: 'Search deferred items by text',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          }
        },
        handler: async () => ({ success: true })
      }
    ];

    testTools.forEach(tool => toolRegistry.register(tool));
  });

  describe('Basic Functionality', () => {
    it('should find tools by query', async () => {
      const result = await handleSearchTools({ query: 'create' });

      expect(result.success).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0].name).toBe('later_capture');
    });

    it('should return total found count', async () => {
      const result = await handleSearchTools({ query: 'list' });

      expect(result.total_found).toBeGreaterThan(0);
      expect(result.total_found).toBeGreaterThanOrEqual(result.tools.length);
    });

    it('should echo back the query', async () => {
      const result = await handleSearchTools({ query: 'test query' });

      expect(result.query).toBe('test query');
    });
  });

  describe('Detail Levels', () => {
    it('should return brief details by default', async () => {
      const result = await handleSearchTools({ query: 'capture' });

      expect(result.tools.length).toBeGreaterThan(0);
      const tool = result.tools[0];
      expect(tool.name).toBeDefined();
      expect(tool.category).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeUndefined();
    });

    it('should return brief details when explicitly requested', async () => {
      const result = await handleSearchTools({
        query: 'capture',
        detail: 'brief'
      });

      const tool = result.tools[0];
      expect(tool.inputSchema).toBeUndefined();
    });

    it('should return full details when requested', async () => {
      const result = await handleSearchTools({
        query: 'capture',
        detail: 'full'
      });

      expect(result.tools.length).toBeGreaterThan(0);
      const tool = result.tools[0];
      expect(tool.name).toBeDefined();
      expect(tool.category).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  describe('Limit Parameter', () => {
    it('should limit results to 5 by default', async () => {
      // Search for something that matches all tools
      const result = await handleSearchTools({ query: 'later' });

      expect(result.tools.length).toBeLessThanOrEqual(5);
    });

    it('should respect custom limit', async () => {
      const result = await handleSearchTools({
        query: 'later',
        limit: 2
      });

      expect(result.tools.length).toBeLessThanOrEqual(2);
    });

    it('should return all matches if fewer than limit', async () => {
      const result = await handleSearchTools({
        query: 'capture',
        limit: 10
      });

      expect(result.tools.length).toBeLessThanOrEqual(10);
      expect(result.tools.length).toBe(Math.min(result.total_found, 10));
    });
  });

  describe('Search Relevance', () => {
    it('should rank exact keyword matches highly', async () => {
      const result = await handleSearchTools({ query: 'capture' });

      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0].name).toBe('later_capture');
    });

    it('should find tools by name', async () => {
      const result = await handleSearchTools({ query: 'delete' });

      expect(result.tools.some(t => t.name === 'later_delete')).toBe(true);
    });

    it('should find tools by description', async () => {
      const result = await handleSearchTools({ query: 'decision' });

      expect(result.tools.some(t => t.description.includes('decision'))).toBe(true);
    });

    it('should handle multiple keyword matches', async () => {
      const result = await handleSearchTools({ query: 'create new' });

      // Should match 'later_capture' which has both keywords
      expect(result.tools.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty query', async () => {
      const result = await handleSearchTools({ query: '' });

      expect(result.success).toBe(false);
      expect(result.tools).toEqual([]);
      expect(result.total_found).toBe(0);
    });

    it('should handle whitespace-only query', async () => {
      const result = await handleSearchTools({ query: '   ' });

      expect(result.success).toBe(false);
      expect(result.tools).toEqual([]);
    });

    it('should handle query with no matches', async () => {
      const result = await handleSearchTools({ query: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.tools).toEqual([]);
      expect(result.total_found).toBe(0);
    });
  });

  describe('Use Cases', () => {
    it('should help user find create/capture tools', async () => {
      const queries = [
        'create a decision',
        'add new item',
        'capture something',
        'save a task'
      ];

      for (const query of queries) {
        const result = await handleSearchTools({ query });
        expect(result.tools.some(t => t.name === 'later_capture')).toBe(true);
      }
    });

    it('should help user find list/view tools', async () => {
      const queries = [
        'list all items',
        'show everything',
        'view all decisions'
      ];

      for (const query of queries) {
        const result = await handleSearchTools({ query });
        expect(result.tools.some(t => t.name === 'later_list')).toBe(true);
      }
    });

    it('should help user find delete/remove tools', async () => {
      const queries = [
        'delete item',
        'remove decision',
        'discard task'
      ];

      for (const query of queries) {
        const result = await handleSearchTools({ query });
        expect(result.tools.some(t => t.name === 'later_delete')).toBe(true);
      }
    });

    it('should help user find search tools', async () => {
      const queries = [
        'search items',
        'find decision',
        'query tasks'
      ];

      for (const query of queries) {
        const result = await handleSearchTools({ query });
        expect(result.tools.some(t => t.name === 'later_search')).toBe(true);
      }
    });
  });

  describe('Progressive Disclosure Benefits', () => {
    it('should allow discovering tools on-demand', async () => {
      // User doesn't need to see all tools upfront
      // They can discover what they need when they need it
      const result = await handleSearchTools({ query: 'what can I do?' });

      // Should return some tools without overwhelming the user
      expect(result.tools.length).toBeLessThanOrEqual(5);
    });

    it('should provide enough info in brief mode for decision making', async () => {
      const result = await handleSearchTools({
        query: 'create',
        detail: 'brief'
      });

      const tool = result.tools[0];
      // Brief mode should have name, category, description - enough to decide
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.category).toBeDefined();
    });

    it('should provide schema only when needed', async () => {
      // Get brief info first
      const brief = await handleSearchTools({
        query: 'capture',
        detail: 'brief'
      });

      // Then get full schema when ready to use
      const full = await handleSearchTools({
        query: 'capture',
        detail: 'full'
      });

      expect(brief.tools[0].inputSchema).toBeUndefined();
      expect(full.tools[0].inputSchema).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle case insensitive search', async () => {
      const lower = await handleSearchTools({ query: 'capture' });
      const upper = await handleSearchTools({ query: 'CAPTURE' });
      const mixed = await handleSearchTools({ query: 'CaPtUrE' });

      expect(lower.tools.length).toBe(upper.tools.length);
      expect(lower.tools.length).toBe(mixed.tools.length);
    });

    it('should handle special characters in query', async () => {
      const result = await handleSearchTools({ query: 'create!@#' });

      // Should still work (special chars ignored/stripped)
      expect(result.success).toBe(true);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'create '.repeat(100);
      const result = await handleSearchTools({ query: longQuery });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.tools)).toBe(true);
    });

    it('should handle limit of 0', async () => {
      const result = await handleSearchTools({
        query: 'capture',
        limit: 0
      });

      expect(result.tools).toEqual([]);
    });

    it('should handle negative limit', async () => {
      const result = await handleSearchTools({
        query: 'capture',
        limit: -1
      });

      // Negative limit should be treated as slice(-1), returning last item
      // Or could return empty array - depends on implementation
      expect(Array.isArray(result.tools)).toBe(true);
    });
  });
});
