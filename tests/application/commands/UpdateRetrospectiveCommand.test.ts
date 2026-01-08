/**
 * Update Retrospective Command Tests
 *
 * Tests for updating retrospective data after completion.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateRetrospectiveCommand } from '../../../src/application/commands/UpdateRetrospectiveCommand.js';
import { IStoragePort } from '../../../src/domain/ports/IStoragePort.js';
import { RetrospectiveProps } from '../../../src/domain/entities/Retrospective.js';

describe('UpdateRetrospectiveCommand', () => {
  let command: UpdateRetrospectiveCommand;
  let mockStorage: jest.Mocked<IStoragePort>;

  const mockRetrospective: RetrospectiveProps = {
    itemId: 1,
    outcome: 'success',
    impactTimeSaved: 120,
    impactCostSaved: 500,
    effortEstimated: 60,
    effortActual: 90,
    lessonsLearned: 'Original lessons',
    completedAt: new Date('2025-01-15'),
  };

  beforeEach(() => {
    mockStorage = {
      getRetrospective: jest.fn(),
      saveRetrospective: jest.fn(),
    } as unknown as jest.Mocked<IStoragePort>;

    command = new UpdateRetrospectiveCommand(mockStorage);
  });

  describe('execute', () => {
    it('should update lessons learned', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);
      mockStorage.saveRetrospective.mockResolvedValue({
        ...mockRetrospective,
        lessonsLearned: 'Updated lessons with more detail',
      });

      const result = await command.execute({
        itemId: 1,
        lessonsLearned: 'Updated lessons with more detail',
      });

      expect(result.success).toBe(true);
      expect(result.retrospective).toBeDefined();
      expect(result.retrospective!.lessonsLearned).toBe('Updated lessons with more detail');
    });

    it('should update outcome', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);
      mockStorage.saveRetrospective.mockResolvedValue({
        ...mockRetrospective,
        outcome: 'partial',
      });

      const result = await command.execute({
        itemId: 1,
        outcome: 'partial',
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.outcome).toBe('partial');
    });

    it('should update impact metrics', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);
      mockStorage.saveRetrospective.mockResolvedValue({
        ...mockRetrospective,
        impactTimeSaved: 150,
        impactCostSaved: 750,
      });

      const result = await command.execute({
        itemId: 1,
        impactTimeSaved: 150,
        impactCostSaved: 750,
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.impactTimeSaved).toBe(150);
      expect(result.retrospective!.impactCostSaved).toBe(750);
    });

    it('should update effort metrics', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);
      mockStorage.saveRetrospective.mockResolvedValue({
        ...mockRetrospective,
        effortActual: 100,
      });

      const result = await command.execute({
        itemId: 1,
        effortActual: 100,
      });

      expect(result.success).toBe(true);
      expect(result.retrospective!.effortActual).toBe(100);
    });

    it('should handle non-existent retrospective', async () => {
      mockStorage.getRetrospective.mockResolvedValue(null);

      const result = await command.execute({
        itemId: 999,
        lessonsLearned: 'New lessons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate item ID', async () => {
      const result = await command.execute({
        itemId: -1,
        lessonsLearned: 'Lessons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Valid item ID is required');
    });

    it('should require at least one field to update', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);

      const result = await command.execute({
        itemId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one field');
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getRetrospective.mockRejectedValue(new Error('Database error'));

      const result = await command.execute({
        itemId: 1,
        lessonsLearned: 'Lessons',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should preserve unchanged fields', async () => {
      mockStorage.getRetrospective.mockResolvedValue(mockRetrospective);
      mockStorage.saveRetrospective.mockImplementation(async (input) => ({
        ...mockRetrospective,
        ...input,
      }));

      const result = await command.execute({
        itemId: 1,
        lessonsLearned: 'New lessons only',
      });

      expect(result.success).toBe(true);
      // Original values preserved
      expect(result.retrospective!.impactTimeSaved).toBe(120);
      expect(result.retrospective!.impactCostSaved).toBe(500);
      // New value updated
      expect(result.retrospective!.lessonsLearned).toBe('New lessons only');
    });
  });
});
