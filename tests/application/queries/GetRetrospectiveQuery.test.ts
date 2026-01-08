/**
 * Get Retrospective Query Tests
 *
 * Tests for retrieving retrospective data for completed items.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetRetrospectiveQuery } from '../../../src/application/queries/GetRetrospectiveQuery.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { ItemProps } from '../../../src/domain/entities/Item.js';
import { RetrospectiveProps } from '../../../src/domain/entities/Retrospective.js';

describe('GetRetrospectiveQuery', () => {
  let query: GetRetrospectiveQuery;
  let mockStorage: jest.Mocked<IStoragePort>;

  const mockItem: ItemProps = {
    id: 1,
    decision: 'Implement user authentication',
    context: 'Need to decide between OAuth and custom auth',
    status: 'done',
    priority: 'high',
    tags: ['auth', 'security'],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockRetrospective: RetrospectiveProps = {
    itemId: 1,
    outcome: 'success',
    impactTimeSaved: 120,
    impactCostSaved: 500,
    effortEstimated: 60,
    effortActual: 90,
    lessonsLearned: 'OAuth was the right choice for scalability',
    completedAt: new Date('2025-01-15'),
  };

  beforeEach(() => {
    mockStorage = {
      getItem: jest.fn(),
      getRetrospective: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    query = new GetRetrospectiveQuery(mockStorage);
  });

  describe('execute', () => {
    it('should return retrospective for a completed item', async () => {
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(true);
      expect(result.retrospective).toBeDefined();
      expect(result.retrospective!.itemId).toBe(1);
      expect(result.retrospective!.outcome).toBe('success');
      expect(result.retrospective!.lessonsLearned).toBe('OAuth was the right choice for scalability');
    });

    it('should include item details when requested', async () => {
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);

      const result = await query.execute({ itemId: 1, includeItemDetails: true });

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item!.decision).toBe('Implement user authentication');
    });

    it('should calculate estimation accuracy', async () => {
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);

      const result = await query.execute({ itemId: 1, includeAnalysis: true });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      // 60/90 = 66.67% accuracy
      expect(result.analysis!.estimationAccuracy).toBe(67);
      expect(result.analysis!.wasUnderestimated).toBe(true);
      expect(result.analysis!.effortVariance).toBe(30); // 90 - 60
    });

    it('should handle missing retrospective', async () => {
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(null);

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle non-existent item', async () => {
      mockStorage.getItem.mockResolvedValue(null);

      const result = await query.execute({ itemId: 999 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Item 999 not found');
    });

    it('should validate item ID', async () => {
      const result = await query.execute({ itemId: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID is required');
    });

    it('should handle retrospective without effort data', async () => {
      const retroNoEffort: RetrospectiveProps = {
        ...mockRetrospective,
        effortEstimated: undefined,
        effortActual: undefined,
      };
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(retroNoEffort);

      const result = await query.execute({ itemId: 1, includeAnalysis: true });

      expect(result.success).toBe(true);
      expect(result.analysis!.estimationAccuracy).toBeUndefined();
      expect(result.analysis!.wasUnderestimated).toBe(false);
    });

    it('should detect overestimation', async () => {
      const retroOverestimated: RetrospectiveProps = {
        ...mockRetrospective,
        effortEstimated: 120,
        effortActual: 60,
      };
      mockStorage.getItem.mockResolvedValue(mockItem);
      mockStorage.getRetrospective.mockResolvedValue(retroOverestimated);

      const result = await query.execute({ itemId: 1, includeAnalysis: true });

      expect(result.success).toBe(true);
      expect(result.analysis!.wasOverestimated).toBe(true);
      expect(result.analysis!.wasUnderestimated).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getItem.mockRejectedValue(new Error('Database error'));

      const result = await query.execute({ itemId: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });
});
