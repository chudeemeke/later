/**
 * MCP Retrospective Handlers Tests
 *
 * Tests for MCP handlers wrapping retrospective commands and queries.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import handlers
import { createGetRetrospectiveHandler } from '../../../../src/presentation/mcp/handlers/get-retrospective.js';
import { createGetRetrospectiveStatsHandler } from '../../../../src/presentation/mcp/handlers/get-retrospective-stats.js';
import { createUpdateRetrospectiveHandler } from '../../../../src/presentation/mcp/handlers/update-retrospective.js';

describe('MCP Retrospective Handlers', () => {
  // Mock execute functions
  const mockGetRetrospectiveExecute = jest.fn<() => Promise<unknown>>();
  const mockGetRetrospectiveStatsExecute = jest.fn<() => Promise<unknown>>();
  const mockUpdateRetrospectiveExecute = jest.fn<() => Promise<unknown>>();

  // Mock container
  const mockContainer = {
    storage: {},
    commands: {
      capture: { execute: jest.fn() },
      update: { execute: jest.fn() },
      complete: { execute: jest.fn() },
      delete: { execute: jest.fn() },
      addDependency: { execute: jest.fn() },
      removeDependency: { execute: jest.fn() },
      updateRetrospective: { execute: mockUpdateRetrospectiveExecute },
    },
    queries: {
      getItem: { execute: jest.fn() },
      listItems: { execute: jest.fn() },
      searchItems: { execute: jest.fn() },
      getBlockedItems: { execute: jest.fn() },
      getStaleItems: { execute: jest.fn() },
      getDependencyChain: { execute: jest.fn() },
      getResolutionOrder: { execute: jest.fn() },
      suggestDependencies: { execute: jest.fn() },
      getRetrospective: { execute: mockGetRetrospectiveExecute },
      getRetrospectiveStats: { execute: mockGetRetrospectiveStatsExecute },
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

  describe('createGetRetrospectiveHandler', () => {
    it('should return retrospective for an item', async () => {
      const handler = createGetRetrospectiveHandler(mockContainer);

      mockGetRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          impactTimeSaved: 120,
          impactCostSaved: 500,
          effortEstimated: 60,
          effortActual: 90,
          lessonsLearned: 'Good decision',
          completedAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({ item_id: 1 });

      expect(result.success).toBe(true);
      expect(result.retrospective).toBeDefined();
      expect(result.retrospective!.item_id).toBe(1);
      expect(result.retrospective!.outcome).toBe('success');
      expect(result.retrospective!.impact_time_saved).toBe(120);
    });

    it('should include item details when requested', async () => {
      const handler = createGetRetrospectiveHandler(mockContainer);

      mockGetRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          completedAt: new Date('2025-01-15'),
        },
        item: {
          id: 1,
          decision: 'Test decision',
          status: 'done',
          priority: 'high',
          tags: ['test'],
        },
      });

      const result = await handler({
        item_id: 1,
        include_item_details: true,
      });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.decision).toBe('Test decision');
    });

    it('should include analysis when requested', async () => {
      const handler = createGetRetrospectiveHandler(mockContainer);

      mockGetRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          completedAt: new Date('2025-01-15'),
        },
        analysis: {
          estimationAccuracy: 67,
          effortVariance: 30,
          wasUnderestimated: true,
          wasOverestimated: false,
          isPositive: true,
          hasImpact: true,
          hasLessons: true,
        },
      });

      const result = await handler({
        item_id: 1,
        include_analysis: true,
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis!.estimation_accuracy).toBe(67);
      expect(result.analysis!.was_underestimated).toBe(true);
    });

    it('should handle not found error', async () => {
      const handler = createGetRetrospectiveHandler(mockContainer);

      mockGetRetrospectiveExecute.mockResolvedValue({
        success: false,
        error: 'Retrospective not found',
      });

      const result = await handler({ item_id: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createGetRetrospectiveStatsHandler', () => {
    it('should return basic statistics', async () => {
      const handler = createGetRetrospectiveStatsHandler(mockContainer);

      mockGetRetrospectiveStatsExecute.mockResolvedValue({
        success: true,
        stats: {
          total: 10,
          byOutcome: { success: 6, failure: 2, partial: 2 },
          avgAccuracy: 75,
          avgVariance: 20,
        },
      });

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats!.total).toBe(10);
      expect(result.stats!.by_outcome.success).toBe(6);
    });

    it('should include detailed analysis when requested', async () => {
      const handler = createGetRetrospectiveStatsHandler(mockContainer);

      mockGetRetrospectiveStatsExecute.mockResolvedValue({
        success: true,
        stats: {
          total: 10,
          byOutcome: { success: 6, failure: 2, partial: 2 },
          avgAccuracy: 75,
          avgVariance: 20,
        },
        detailedAnalysis: {
          successRate: 60,
          totalTimeSaved: 500,
          totalCostSaved: 2000,
          avgTimeSaved: 50,
          avgCostSaved: 200,
          itemsWithImpact: 8,
          underestimationRate: 40,
          overestimationRate: 20,
          avgEffortVariance: 15,
        },
      });

      const result = await handler({ include_detailed_analysis: true });

      expect(result.success).toBe(true);
      expect(result.detailed_analysis).toBeDefined();
      expect(result.detailed_analysis!.success_rate).toBe(60);
      expect(result.detailed_analysis!.total_time_saved).toBe(500);
    });

    it('should include lessons summary when requested', async () => {
      const handler = createGetRetrospectiveStatsHandler(mockContainer);

      mockGetRetrospectiveStatsExecute.mockResolvedValue({
        success: true,
        stats: {
          total: 5,
          byOutcome: { success: 3, failure: 2 },
          avgAccuracy: 80,
          avgVariance: 10,
        },
        lessonsSummary: {
          totalWithLessons: 3,
          lessons: [
            { itemId: 1, outcome: 'success', lessons: 'Lesson 1' },
            { itemId: 2, outcome: 'failure', lessons: 'Lesson 2' },
          ],
        },
      });

      const result = await handler({ include_lessons_summary: true });

      expect(result.success).toBe(true);
      expect(result.lessons_summary).toBeDefined();
      expect(result.lessons_summary!.total_with_lessons).toBe(3);
      expect(result.lessons_summary!.lessons).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      const handler = createGetRetrospectiveStatsHandler(mockContainer);

      mockGetRetrospectiveStatsExecute.mockResolvedValue({
        success: true,
        stats: {
          total: 3,
          byOutcome: { success: 2, partial: 1 },
          avgAccuracy: 85,
          avgVariance: 5,
        },
      });

      await handler({
        after_date: '2025-01-01',
        before_date: '2025-01-31',
      });

      expect(mockGetRetrospectiveStatsExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          afterDate: expect.any(Date),
          beforeDate: expect.any(Date),
        })
      );
    });
  });

  describe('createUpdateRetrospectiveHandler', () => {
    it('should update lessons learned', async () => {
      const handler = createUpdateRetrospectiveHandler(mockContainer);

      mockUpdateRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          lessonsLearned: 'Updated lessons',
          completedAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 1,
        lessons_learned: 'Updated lessons',
      });

      expect(result.success).toBe(true);
      expect(result.retrospective).toBeDefined();
      expect(result.retrospective!.lessons_learned).toBe('Updated lessons');
    });

    it('should update outcome', async () => {
      const handler = createUpdateRetrospectiveHandler(mockContainer);

      mockUpdateRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'partial',
          completedAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 1,
        outcome: 'partial',
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.outcome).toBe('partial');
    });

    it('should update impact metrics', async () => {
      const handler = createUpdateRetrospectiveHandler(mockContainer);

      mockUpdateRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          impactTimeSaved: 200,
          impactCostSaved: 1000,
          completedAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 1,
        impact_time_saved: 200,
        impact_cost_saved: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.impact_time_saved).toBe(200);
      expect(result.retrospective!.impact_cost_saved).toBe(1000);
    });

    it('should handle not found error', async () => {
      const handler = createUpdateRetrospectiveHandler(mockContainer);

      mockUpdateRetrospectiveExecute.mockResolvedValue({
        success: false,
        error: 'Retrospective not found',
      });

      const result = await handler({
        item_id: 999,
        lessons_learned: 'New lessons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should transform camelCase args to snake_case response', async () => {
      const handler = createUpdateRetrospectiveHandler(mockContainer);

      mockUpdateRetrospectiveExecute.mockResolvedValue({
        success: true,
        retrospective: {
          itemId: 1,
          outcome: 'success',
          effortEstimated: 60,
          effortActual: 90,
          completedAt: new Date('2025-01-15'),
        },
      });

      const result = await handler({
        item_id: 1,
        effort_estimated: 60,
        effort_actual: 90,
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.effort_estimated).toBe(60);
      expect(result.retrospective!.effort_actual).toBe(90);
    });
  });
});
