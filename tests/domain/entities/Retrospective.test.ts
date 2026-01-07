import { describe, it, expect } from '@jest/globals';
import { Retrospective } from '../../../src/domain/entities/Retrospective.js';

describe('Retrospective Entity', () => {
  describe('creation', () => {
    it('should create retrospective with required fields', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
      });

      expect(retro.itemId.value).toBe(1);
      expect(retro.outcome.value).toBe('success');
    });

    it('should create retrospective with all fields', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'partial',
        impactTimeSaved: 120,
        impactCostSaved: 500.50,
        effortEstimated: 60,
        effortActual: 90,
        lessonsLearned: 'Should have started earlier',
      });

      expect(retro.impactTimeSaved).toBe(120);
      expect(retro.impactCostSaved).toBe(500.50);
      expect(retro.effortEstimated).toBe(60);
      expect(retro.effortActual).toBe(90);
      expect(retro.lessonsLearned).toBe('Should have started earlier');
    });

    it('should set completedAt on creation', () => {
      const before = new Date();
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      const after = new Date();

      expect(retro.completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(retro.completedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should create with failure outcome', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'failure' });
      expect(retro.outcome.value).toBe('failure');
    });
  });

  describe('outcome checks', () => {
    it('should identify positive outcome for success', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      expect(retro.isPositive()).toBe(true);
    });

    it('should identify positive outcome for partial', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'partial' });
      expect(retro.isPositive()).toBe(true);
    });

    it('should identify non-positive outcome for failure', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'failure' });
      expect(retro.isPositive()).toBe(false);
    });
  });

  describe('effort estimation analysis', () => {
    it('should detect underestimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 120,
      });

      expect(retro.wasUnderestimated()).toBe(true);
      expect(retro.wasOverestimated()).toBe(false);
    });

    it('should detect overestimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 120,
        effortActual: 60,
      });

      expect(retro.wasUnderestimated()).toBe(false);
      expect(retro.wasOverestimated()).toBe(true);
    });

    it('should handle exact estimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 60,
      });

      expect(retro.wasUnderestimated()).toBe(false);
      expect(retro.wasOverestimated()).toBe(false);
    });

    it('should return false for missing effort data', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });

      expect(retro.wasUnderestimated()).toBe(false);
      expect(retro.wasOverestimated()).toBe(false);
    });

    it('should return false when only estimated is provided', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
      });

      expect(retro.wasUnderestimated()).toBe(false);
    });

    it('should return false when only actual is provided', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortActual: 90,
      });

      expect(retro.wasOverestimated()).toBe(false);
    });
  });

  describe('estimation accuracy', () => {
    it('should calculate 100% for exact estimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 60,
      });

      expect(retro.estimationAccuracy()).toBe(100);
    });

    it('should calculate 50% for double actual', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 120,
      });

      expect(retro.estimationAccuracy()).toBe(50);
    });

    it('should cap at 100% for overestimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 120,
        effortActual: 60,
      });

      expect(retro.estimationAccuracy()).toBe(100);
    });

    it('should return undefined when data missing', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      expect(retro.estimationAccuracy()).toBeUndefined();
    });

    it('should handle zero actual effort', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 0,
      });

      expect(retro.estimationAccuracy()).toBe(0);
    });

    it('should handle both zero', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 0,
        effortActual: 0,
      });

      expect(retro.estimationAccuracy()).toBe(100);
    });
  });

  describe('effort variance', () => {
    it('should calculate positive variance for underestimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 90,
      });

      expect(retro.effortVariance()).toBe(30);
    });

    it('should calculate negative variance for overestimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 90,
        effortActual: 60,
      });

      expect(retro.effortVariance()).toBe(-30);
    });

    it('should return zero for exact estimation', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 60,
      });

      expect(retro.effortVariance()).toBe(0);
    });

    it('should return undefined when data missing', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      expect(retro.effortVariance()).toBeUndefined();
    });
  });

  describe('impact tracking', () => {
    it('should detect impact with time saved', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        impactTimeSaved: 120,
      });

      expect(retro.hasImpact()).toBe(true);
    });

    it('should detect impact with cost saved', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        impactCostSaved: 500,
      });

      expect(retro.hasImpact()).toBe(true);
    });

    it('should detect no impact when values zero', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        impactTimeSaved: 0,
        impactCostSaved: 0,
      });

      expect(retro.hasImpact()).toBe(false);
    });

    it('should detect no impact when values missing', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      expect(retro.hasImpact()).toBe(false);
    });
  });

  describe('lessons management', () => {
    it('should update lessons', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      retro.updateLessons('New lessons learned');
      expect(retro.lessonsLearned).toBe('New lessons learned');
    });

    it('should detect when lessons exist', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        lessonsLearned: 'Important insight',
      });

      expect(retro.hasLessons()).toBe(true);
    });

    it('should detect when no lessons', () => {
      const retro = Retrospective.create({ itemId: 1, outcome: 'success' });
      expect(retro.hasLessons()).toBe(false);
    });

    it('should detect empty lessons as no lessons', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        lessonsLearned: '',
      });

      expect(retro.hasLessons()).toBe(false);
    });

    it('should detect whitespace-only lessons as no lessons', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        lessonsLearned: '   ',
      });

      expect(retro.hasLessons()).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should convert to props', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'success',
        impactTimeSaved: 60,
        lessonsLearned: 'Test',
      });

      const props = retro.toProps();

      expect(props.itemId).toBe(1);
      expect(props.outcome).toBe('success');
      expect(props.impactTimeSaved).toBe(60);
      expect(props.lessonsLearned).toBe('Test');
      expect(props.completedAt).toBeInstanceOf(Date);
    });

    it('should convert to JSON', () => {
      const retro = Retrospective.create({
        itemId: 1,
        outcome: 'partial',
        effortEstimated: 30,
        effortActual: 45,
      });

      const json = retro.toJSON();

      expect(json.item_id).toBe(1);
      expect(json.outcome).toBe('partial');
      expect(json.effort_estimated).toBe(30);
      expect(json.effort_actual).toBe(45);
      expect(typeof json.completed_at).toBe('string');
    });

    it('should reconstitute from props', () => {
      const completedAt = new Date('2024-01-15');
      const props = {
        itemId: 5,
        outcome: 'failure' as const,
        impactTimeSaved: 0,
        impactCostSaved: 100,
        effortEstimated: 120,
        effortActual: 180,
        lessonsLearned: 'Needed more planning',
        completedAt,
      };

      const retro = Retrospective.fromProps(props);

      expect(retro.itemId.value).toBe(5);
      expect(retro.outcome.value).toBe('failure');
      expect(retro.effortActual).toBe(180);
      expect(retro.completedAt.getTime()).toBe(completedAt.getTime());
    });
  });
});
