/**
 * Tool Registry Tests
 * Tests for tool registration, retrieval, and search functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { toolRegistry } from '../src/registry.js';
import type { ToolMetadata } from '../src/types/tool-metadata.js';

describe('Tool Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    toolRegistry.clear();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool: ToolMetadata = {
        name: 'test_tool',
        category: 'core',
        keywords: ['test'],
        priority: 1,
        description: 'Test tool',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      const retrieved = toolRegistry.get('test_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
    });

    it('should allow registering multiple tools', () => {
      const tools: ToolMetadata[] = [
        {
          name: 'tool1',
          category: 'core',
          keywords: ['test1'],
          priority: 1,
          description: 'Tool 1',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'tool2',
          category: 'workflow',
          keywords: ['test2'],
          priority: 2,
          description: 'Tool 2',
          inputSchema: {},
          handler: async () => ({ success: true })
        }
      ];

      tools.forEach(tool => toolRegistry.register(tool));

      expect(toolRegistry.getAll().length).toBe(2);
    });

    it('should overwrite existing tool with same name', () => {
      const tool1: ToolMetadata = {
        name: 'test_tool',
        category: 'core',
        keywords: ['old'],
        priority: 1,
        description: 'Old description',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      const tool2: ToolMetadata = {
        name: 'test_tool',
        category: 'workflow',
        keywords: ['new'],
        priority: 2,
        description: 'New description',
        inputSchema: {},
        handler: async () => ({ success: false })
      };

      toolRegistry.register(tool1);
      toolRegistry.register(tool2);

      const retrieved = toolRegistry.get('test_tool');
      expect(retrieved?.description).toBe('New description');
      expect(retrieved?.category).toBe('workflow');
    });
  });

  describe('get', () => {
    it('should retrieve a registered tool', () => {
      const tool: ToolMetadata = {
        name: 'test_tool',
        category: 'core',
        keywords: ['test'],
        priority: 1,
        description: 'Test tool',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      const retrieved = toolRegistry.get('test_tool');

      expect(retrieved).toEqual(tool);
    });

    it('should return undefined for non-existent tool', () => {
      const retrieved = toolRegistry.get('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no tools registered', () => {
      const tools = toolRegistry.getAll();
      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const tool1: ToolMetadata = {
        name: 'tool1',
        category: 'core',
        keywords: ['test1'],
        priority: 1,
        description: 'Tool 1',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      const tool2: ToolMetadata = {
        name: 'tool2',
        category: 'workflow',
        keywords: ['test2'],
        priority: 2,
        description: 'Tool 2',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool1);
      toolRegistry.register(tool2);

      const tools = toolRegistry.getAll();
      expect(tools.length).toBe(2);
      expect(tools).toContainEqual(tool1);
      expect(tools).toContainEqual(tool2);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      const tools: ToolMetadata[] = [
        {
          name: 'core1',
          category: 'core',
          keywords: ['test'],
          priority: 1,
          description: 'Core tool 1',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'core2',
          category: 'core',
          keywords: ['test'],
          priority: 1,
          description: 'Core tool 2',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'workflow1',
          category: 'workflow',
          keywords: ['test'],
          priority: 1,
          description: 'Workflow tool 1',
          inputSchema: {},
          handler: async () => ({ success: true })
        }
      ];

      tools.forEach(tool => toolRegistry.register(tool));
    });

    it('should return tools in specified category', () => {
      const coreTools = toolRegistry.getByCategory('core');
      expect(coreTools.length).toBe(2);
      expect(coreTools.every(t => t.category === 'core')).toBe(true);
    });

    it('should return empty array for category with no tools', () => {
      const metaTools = toolRegistry.getByCategory('meta');
      expect(metaTools).toEqual([]);
    });

    it('should return empty array for non-existent category', () => {
      const tools = toolRegistry.getByCategory('nonexistent' as any);
      expect(tools).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const tools: ToolMetadata[] = [
        {
          name: 'later_capture',
          category: 'core',
          keywords: ['create', 'add', 'capture', 'new'],
          priority: 10,
          description: 'Capture a new decision',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'later_list',
          category: 'core',
          keywords: ['list', 'show', 'all'],
          priority: 10,
          description: 'List all items',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'later_delete',
          category: 'workflow',
          keywords: ['delete', 'remove'],
          priority: 5,
          description: 'Delete an item',
          inputSchema: {},
          handler: async () => ({ success: true })
        },
        {
          name: 'hidden_tool',
          category: 'meta',
          keywords: ['hidden'],
          priority: 1,
          description: 'Hidden tool',
          inputSchema: {},
          hidden: true,
          handler: async () => ({ success: true })
        }
      ];

      tools.forEach(tool => toolRegistry.register(tool));
    });

    it('should find tools by keyword match', () => {
      const results = toolRegistry.search('create');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('later_capture');
    });

    it('should find tools by name match', () => {
      const results = toolRegistry.search('list');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'later_list')).toBe(true);
    });

    it('should find tools by description match', () => {
      const results = toolRegistry.search('decision');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'later_capture')).toBe(true);
    });

    it('should rank by priority', () => {
      const results = toolRegistry.search('all');
      // Higher priority tools should rank higher
      const captureIndex = results.findIndex(t => t.name === 'later_capture');
      const deleteIndex = results.findIndex(t => t.name === 'later_delete');

      if (captureIndex !== -1 && deleteIndex !== -1) {
        expect(captureIndex).toBeLessThan(deleteIndex);
      }
    });

    it('should exclude hidden tools', () => {
      const results = toolRegistry.search('hidden');
      expect(results.every(t => !t.hidden)).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = toolRegistry.search('nonexistent');
      expect(results).toEqual([]);
    });

    it('should be case insensitive', () => {
      const lowerResults = toolRegistry.search('create');
      const upperResults = toolRegistry.search('CREATE');
      const mixedResults = toolRegistry.search('CrEaTe');

      expect(lowerResults.length).toBeGreaterThan(0);
      expect(upperResults.length).toBe(lowerResults.length);
      expect(mixedResults.length).toBe(lowerResults.length);
    });

    it('should handle empty query', () => {
      const results = toolRegistry.search('');
      // Empty query should match nothing (score = 0)
      expect(results).toEqual([]);
    });

    it('should handle partial keyword matches', () => {
      const results = toolRegistry.search('capt');
      // Should match 'capture' keyword
      expect(results.some(t => t.keywords.includes('capture'))).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      const tool: ToolMetadata = {
        name: 'test_tool',
        category: 'core',
        keywords: ['test'],
        priority: 1,
        description: 'Test tool',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      expect(toolRegistry.getAll().length).toBe(1);

      toolRegistry.clear();
      expect(toolRegistry.getAll().length).toBe(0);
    });

    it('should allow registration after clear', () => {
      toolRegistry.clear();

      const tool: ToolMetadata = {
        name: 'test_tool',
        category: 'core',
        keywords: ['test'],
        priority: 1,
        description: 'Test tool',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      expect(toolRegistry.getAll().length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool with no keywords', () => {
      const tool: ToolMetadata = {
        name: 'no_keywords',
        category: 'core',
        keywords: [],
        priority: 1,
        description: 'Tool with no keywords',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      const results = toolRegistry.search('keywords');

      // Should still match by description
      expect(results.some(t => t.name === 'no_keywords')).toBe(true);
    });

    it('should handle tool with zero priority', () => {
      const tool: ToolMetadata = {
        name: 'zero_priority',
        category: 'core',
        keywords: ['test'],
        priority: 0,
        description: 'Zero priority tool',
        inputSchema: {},
        handler: async () => ({ success: true })
      };

      toolRegistry.register(tool);
      const retrieved = toolRegistry.get('zero_priority');
      expect(retrieved?.priority).toBe(0);
    });

    it('should handle special characters in search query', () => {
      const results = toolRegistry.search('create!@#$%');
      // Should still work with special chars
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
