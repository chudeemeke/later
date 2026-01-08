/**
 * MCP Dependency Handlers Tests
 *
 * Tests for MCP handlers wrapping dependency commands and queries.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import handlers
import { createAddDependencyHandler } from '../../../../src/presentation/mcp/handlers/add-dependency.js';
import { createRemoveDependencyHandler } from '../../../../src/presentation/mcp/handlers/remove-dependency.js';
import { createDependencyChainHandler } from '../../../../src/presentation/mcp/handlers/dependency-chain.js';
import { createResolutionOrderHandler } from '../../../../src/presentation/mcp/handlers/resolution-order.js';
import { createSuggestDependenciesHandler } from '../../../../src/presentation/mcp/handlers/suggest-dependencies.js';

describe('MCP Dependency Handlers', () => {
  // Mock execute functions
  const mockAddDependencyExecute = jest.fn<() => Promise<unknown>>();
  const mockRemoveDependencyExecute = jest.fn<() => Promise<unknown>>();
  const mockGetDependencyChainExecute = jest.fn<() => Promise<unknown>>();
  const mockGetResolutionOrderExecute = jest.fn<() => Promise<unknown>>();
  const mockSuggestDependenciesExecute = jest.fn<() => Promise<unknown>>();

  // Mock container
  const mockContainer = {
    storage: {},
    commands: {
      capture: { execute: jest.fn() },
      update: { execute: jest.fn() },
      complete: { execute: jest.fn() },
      delete: { execute: jest.fn() },
      addDependency: { execute: mockAddDependencyExecute },
      removeDependency: { execute: mockRemoveDependencyExecute },
    },
    queries: {
      getItem: { execute: jest.fn() },
      listItems: { execute: jest.fn() },
      searchItems: { execute: jest.fn() },
      getBlockedItems: { execute: jest.fn() },
      getStaleItems: { execute: jest.fn() },
      getDependencyChain: { execute: mockGetDependencyChainExecute },
      getResolutionOrder: { execute: mockGetResolutionOrderExecute },
      suggestDependencies: { execute: mockSuggestDependenciesExecute },
    },
    services: {
      dependencyResolver: {},
      stalenessChecker: {},
    },
    close: jest.fn<() => Promise<void>>(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAddDependencyHandler', () => {
    it('should successfully add a dependency', async () => {
      const handler = createAddDependencyHandler(mockContainer);

      mockAddDependencyExecute.mockResolvedValue({
        success: true,
        created: true,
      });

      const result = await handler({
        item_id: 1,
        depends_on_id: 2,
        type: 'blocks',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('#1');
      expect(result.message).toContain('#2');
    });

    it('should handle cycle detection', async () => {
      const handler = createAddDependencyHandler(mockContainer);

      mockAddDependencyExecute.mockResolvedValue({
        success: false,
        error: 'Would create cycle',
        cycleDetected: {
          path: [1, 2, 3, 1],
          description: 'Adding this dependency would create a cycle',
        },
      });

      const result = await handler({
        item_id: 1,
        depends_on_id: 3,
      });

      expect(result.success).toBe(false);
      expect(result.cycle_detected).toBe(true);
      expect(result.cycle_path).toEqual([1, 2, 3, 1]);
    });

    it('should transform camelCase to snake_case', async () => {
      const handler = createAddDependencyHandler(mockContainer);

      mockAddDependencyExecute.mockResolvedValue({
        success: true,
      });

      await handler({
        item_id: 1,
        depends_on_id: 2,
      });

      // Verify the command was called with camelCase args
      expect(mockAddDependencyExecute).toHaveBeenCalledWith({
        itemId: 1,
        dependsOnId: 2,
        type: undefined,
      });
    });
  });

  describe('createRemoveDependencyHandler', () => {
    it('should successfully remove a dependency', async () => {
      const handler = createRemoveDependencyHandler(mockContainer);

      mockRemoveDependencyExecute.mockResolvedValue({
        success: true,
        removed: true,
      });

      const result = await handler({
        item_id: 1,
        depends_on_id: 2,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('#1');
      expect(result.message).toContain('#2');
    });

    it('should handle not found error', async () => {
      const handler = createRemoveDependencyHandler(mockContainer);

      mockRemoveDependencyExecute.mockResolvedValue({
        success: false,
        notFound: true,
        error: 'Dependency not found',
      });

      const result = await handler({
        item_id: 1,
        depends_on_id: 999,
      });

      expect(result.success).toBe(false);
      expect(result.not_found).toBe(true);
    });

    it('should include unblocked items when requested', async () => {
      const handler = createRemoveDependencyHandler(mockContainer);

      mockRemoveDependencyExecute.mockResolvedValue({
        success: true,
        removed: true,
        unblockedItems: [3, 4],
      });

      const result = await handler({
        item_id: 1,
        depends_on_id: 2,
        report_unblocked: true,
      });

      expect(result.success).toBe(true);
      expect(result.unblocked_items).toEqual([3, 4]);
    });
  });

  describe('createDependencyChainHandler', () => {
    it('should return dependency chain', async () => {
      const handler = createDependencyChainHandler(mockContainer);

      mockGetDependencyChainExecute.mockResolvedValue({
        success: true,
        chain: {
          itemId: 1,
          depth: 2,
          path: [1, 2, 3],
          totalBlockers: 2,
        },
      });

      const result = await handler({
        item_id: 1,
      });

      expect(result.success).toBe(true);
      expect(result.chain).toBeDefined();
      expect(result.chain!.item_id).toBe(1);
      expect(result.chain!.depth).toBe(2);
      expect(result.chain!.path).toEqual([1, 2, 3]);
      expect(result.chain!.total_blockers).toBe(2);
    });

    it('should include chain details when requested', async () => {
      const handler = createDependencyChainHandler(mockContainer);

      mockGetDependencyChainExecute.mockResolvedValue({
        success: true,
        chain: { itemId: 1, depth: 1, path: [1, 2], totalBlockers: 1 },
        chainDetails: [
          { id: 1, decision: 'Item 1', status: 'pending', priority: 'high' },
          { id: 2, decision: 'Item 2', status: 'done', priority: 'medium' },
        ],
      });

      const result = await handler({
        item_id: 1,
        include_item_details: true,
      });

      expect(result.success).toBe(true);
      expect(result.chain_details).toHaveLength(2);
      expect(result.chain_details![0].decision).toBe('Item 1');
    });

    it('should include visualization when requested', async () => {
      const handler = createDependencyChainHandler(mockContainer);

      mockGetDependencyChainExecute.mockResolvedValue({
        success: true,
        chain: { itemId: 1, depth: 1, path: [1, 2], totalBlockers: 1 },
        visualization: '[ ] #1: Item 1\n  -> [x] #2: Item 2',
      });

      const result = await handler({
        item_id: 1,
        include_visualization: true,
      });

      expect(result.success).toBe(true);
      expect(result.visualization).toContain('#1');
      expect(result.visualization).toContain('#2');
    });
  });

  describe('createResolutionOrderHandler', () => {
    it('should return resolution order', async () => {
      const handler = createResolutionOrderHandler(mockContainer);

      mockGetResolutionOrderExecute.mockResolvedValue({
        success: true,
        order: [
          {
            id: 2,
            decision: 'Item 2',
            status: 'pending',
            priority: 'high',
            tags: ['api'],
            isBlocked: false,
            blockerCount: 0,
            order: 1,
          },
          {
            id: 1,
            decision: 'Item 1',
            status: 'pending',
            priority: 'medium',
            tags: [],
            isBlocked: true,
            blockerCount: 1,
            order: 2,
          },
        ],
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.order).toHaveLength(2);
      expect(result.order![0].id).toBe(2); // Unblocked first
      expect(result.order![0].is_blocked).toBe(false);
      expect(result.order![1].is_blocked).toBe(true);
    });

    it('should include statistics when requested', async () => {
      const handler = createResolutionOrderHandler(mockContainer);

      mockGetResolutionOrderExecute.mockResolvedValue({
        success: true,
        order: [],
        stats: {
          totalItems: 10,
          itemsWithDependencies: 5,
          blockedItems: 3,
          maxDepth: 2,
        },
      });

      const result = await handler({
        include_stats: true,
      });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats!.total_items).toBe(10);
      expect(result.stats!.items_with_dependencies).toBe(5);
      expect(result.stats!.blocked_items).toBe(3);
      expect(result.stats!.max_depth).toBe(2);
    });

    it('should include next actions when requested', async () => {
      const handler = createResolutionOrderHandler(mockContainer);

      mockGetResolutionOrderExecute.mockResolvedValue({
        success: true,
        order: [],
        nextActions: [
          { id: 2, decision: 'Item 2', priority: 'high', reason: 'Unblocks 3 items', unblocks: 3 },
        ],
      });

      const result = await handler({
        include_next_actions: true,
      });

      expect(result.success).toBe(true);
      expect(result.next_actions).toHaveLength(1);
      expect(result.next_actions![0].unblocks).toBe(3);
    });
  });

  describe('createSuggestDependenciesHandler', () => {
    it('should return dependency suggestions', async () => {
      const handler = createSuggestDependenciesHandler(mockContainer);

      mockSuggestDependenciesExecute.mockResolvedValue({
        success: true,
        suggestions: [
          {
            targetId: 2,
            suggestedType: 'blocks',
            confidence: 0.8,
            reason: 'Shared keywords: api, authentication',
          },
        ],
      });

      const result = await handler({
        item_id: 1,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions![0].target_id).toBe(2);
      expect(result.suggestions![0].suggested_type).toBe('blocks');
      expect(result.suggestions![0].confidence).toBe(0.8);
    });

    it('should include target details when requested', async () => {
      const handler = createSuggestDependenciesHandler(mockContainer);

      mockSuggestDependenciesExecute.mockResolvedValue({
        success: true,
        suggestions: [
          {
            targetId: 2,
            suggestedType: 'relates-to',
            confidence: 0.6,
            reason: 'Shared tag: frontend',
            targetDecision: 'Update UI components',
            targetStatus: 'pending',
            targetPriority: 'medium',
          },
        ],
      });

      const result = await handler({
        item_id: 1,
        include_target_details: true,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions![0].target_decision).toBe('Update UI components');
      expect(result.suggestions![0].target_status).toBe('pending');
      expect(result.suggestions![0].target_priority).toBe('medium');
    });

    it('should respect limit parameter', async () => {
      const handler = createSuggestDependenciesHandler(mockContainer);

      mockSuggestDependenciesExecute.mockResolvedValue({
        success: true,
        suggestions: [],
      });

      await handler({
        item_id: 1,
        limit: 5,
        min_confidence: 0.5,
      });

      expect(mockSuggestDependenciesExecute).toHaveBeenCalledWith({
        itemId: 1,
        limit: 5,
        minConfidence: 0.5,
        includeCompleted: undefined,
        includeTargetDetails: undefined,
      });
    });

    it('should handle errors gracefully', async () => {
      const handler = createSuggestDependenciesHandler(mockContainer);

      mockSuggestDependenciesExecute.mockResolvedValue({
        success: false,
        error: 'Item not found',
      });

      const result = await handler({
        item_id: 999,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });
  });
});
