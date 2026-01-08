/**
 * Get Retrospective Stats Query Tests
 *
 * Tests for retrieving aggregate retrospective statistics.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetRetrospectiveStatsQuery } from '../../../src/application/queries/GetRetrospectiveStatsQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { RetrospectiveProps } from '../../../src/domain/entities/Retrospective.js';

describe('GetRetrospectiveStatsQuery', () => {
  let query: GetRetrospectiveStatsQuery;
  let mockStorage: jest.Mocked<IStoragePort>;

  const mockRetrospectives: RetrospectiveProps[] = [
    {
      itemId: 1,
      outcome: 'success',
      impactTimeSaved: 120,
      impactCostSaved: 500,
      effortEstimated: 60,
      effortActual: 90,
      lessonsLearned: 'Good decision',
      completedAt: new Date('2025-01-15'),
    },
    {
      itemId: 2,
      outcome: 'success',
      impactTimeSaved: 60,
      effortEstimated: 30,
      effortActual: 25,
      completedAt: new Date('2025-01-16'),
    },
    {
      itemId: 3,
      outcome: 'failure',
      effortEstimated: 120,
      effortActual: 180,
      lessonsLearned: 'Should have planned better',
      completedAt: new Date('2025-01-17'),
    },
    {
      itemId: 4,
      outcome: 'partial',
      impactCostSaved: 200,
      completedAt: new Date('2025-01-18'),
    },
  ];

  beforeEach(() => {
    mockStorage = {
      listRetrospectives: jest.fn(),
      getRetrospectiveStats: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    query = new GetRetrospectiveStatsQuery(mockStorage);
  });

  describe('execute', () => {
    it('should return basic statistics', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 4,
        byOutcome: { success: 2, failure: 1, partial: 1 },
        avgAccuracy: 75,
        avgVariance: 28,
      });

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats!.total).toBe(4);
      expect(result.stats!.byOutcome.success).toBe(2);
      expect(result.stats!.byOutcome.failure).toBe(1);
    });

    it('should include detailed analysis when requested', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 4,
        byOutcome: { success: 2, failure: 1, partial: 1 },
        avgAccuracy: 75,
        avgVariance: 28,
      });
      mockStorage.listRetrospectives.mockResolvedValue(mockRetrospectives);

      const result = await query.execute({ includeDetailedAnalysis: true });

      expect(result.success).toBe(true);
      expect(result.detailedAnalysis).toBeDefined();
      expect(result.detailedAnalysis!.successRate).toBeCloseTo(50, 0); // 2/4
      expect(result.detailedAnalysis!.totalTimeSaved).toBe(180); // 120 + 60
      expect(result.detailedAnalysis!.totalCostSaved).toBe(700); // 500 + 200
    });

    it('should calculate underestimation rate', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 4,
        byOutcome: { success: 2, failure: 1, partial: 1 },
        avgAccuracy: 75,
        avgVariance: 28,
      });
      mockStorage.listRetrospectives.mockResolvedValue(mockRetrospectives);

      const result = await query.execute({ includeDetailedAnalysis: true });

      expect(result.success).toBe(true);
      // Items 1 and 3 were underestimated (actual > estimated)
      // Item 2 was overestimated
      // Item 4 has no effort data
      expect(result.detailedAnalysis!.underestimationRate).toBeCloseTo(66.67, 0);
    });

    it('should include lessons summary when requested', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 4,
        byOutcome: { success: 2, failure: 1, partial: 1 },
        avgAccuracy: 75,
        avgVariance: 28,
      });
      mockStorage.listRetrospectives.mockResolvedValue(mockRetrospectives);

      const result = await query.execute({ includeLessonsSummary: true });

      expect(result.success).toBe(true);
      expect(result.lessonsSummary).toBeDefined();
      expect(result.lessonsSummary!.totalWithLessons).toBe(2);
      expect(result.lessonsSummary!.lessons).toHaveLength(2);
    });

    it('should handle empty data', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 0,
        byOutcome: {},
        avgAccuracy: null,
        avgVariance: null,
      });

      const result = await query.execute({});

      expect(result.success).toBe(true);
      expect(result.stats!.total).toBe(0);
    });

    it('should filter by date range', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 2,
        byOutcome: { success: 1, failure: 1 },
        avgAccuracy: 80,
        avgVariance: 20,
      });

      const result = await query.execute({
        afterDate: new Date('2025-01-16'),
        beforeDate: new Date('2025-01-18'),
      });

      expect(result.success).toBe(true);
      expect(result.stats!.total).toBe(2);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getRetrospectiveStats.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should calculate impact metrics correctly', async () => {
      mockStorage.getRetrospectiveStats.mockResolvedValue({
        total: 4,
        byOutcome: { success: 2, failure: 1, partial: 1 },
        avgAccuracy: 75,
        avgVariance: 28,
      });
      mockStorage.listRetrospectives.mockResolvedValue(mockRetrospectives);

      const result = await query.execute({ includeDetailedAnalysis: true });

      expect(result.success).toBe(true);
      expect(result.detailedAnalysis!.itemsWithImpact).toBe(3); // Items 1, 2, 4 have impact
      expect(result.detailedAnalysis!.avgTimeSaved).toBe(90); // 180/2 items with time saved
    });
  });
});
