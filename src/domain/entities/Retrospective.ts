/**
 * Retrospective Entity
 *
 * Tracks the outcome and lessons learned from completed decisions.
 * Enables decision quality analysis over time.
 */

import { ItemId } from '../value-objects/ItemId.js';
import { Outcome, OutcomeValue } from '../value-objects/Outcome.js';

export interface RetrospectiveProps {
  itemId: number;
  outcome: OutcomeValue;
  impactTimeSaved?: number;      // minutes saved
  impactCostSaved?: number;      // currency amount
  effortEstimated?: number;      // minutes estimated
  effortActual?: number;         // minutes actual
  lessonsLearned?: string;
  completedAt: Date;
}

export interface CreateRetrospectiveInput {
  itemId: number;
  outcome: OutcomeValue;
  impactTimeSaved?: number;
  impactCostSaved?: number;
  effortEstimated?: number;
  effortActual?: number;
  lessonsLearned?: string;
}

export class Retrospective {
  private readonly _itemId: ItemId;
  private readonly _outcome: Outcome;
  private readonly _impactTimeSaved?: number;
  private readonly _impactCostSaved?: number;
  private readonly _effortEstimated?: number;
  private readonly _effortActual?: number;
  private _lessonsLearned?: string;
  private readonly _completedAt: Date;

  private constructor(props: RetrospectiveProps) {
    this._itemId = ItemId.create(props.itemId);
    this._outcome = Outcome.create(props.outcome);
    this._impactTimeSaved = props.impactTimeSaved;
    this._impactCostSaved = props.impactCostSaved;
    this._effortEstimated = props.effortEstimated;
    this._effortActual = props.effortActual;
    this._lessonsLearned = props.lessonsLearned;
    this._completedAt = props.completedAt;
  }

  /**
   * Create a new retrospective
   */
  static create(input: CreateRetrospectiveInput): Retrospective {
    return new Retrospective({
      itemId: input.itemId,
      outcome: input.outcome,
      impactTimeSaved: input.impactTimeSaved,
      impactCostSaved: input.impactCostSaved,
      effortEstimated: input.effortEstimated,
      effortActual: input.effortActual,
      lessonsLearned: input.lessonsLearned,
      completedAt: new Date(),
    });
  }

  /**
   * Reconstitute from storage
   */
  static fromProps(props: RetrospectiveProps): Retrospective {
    return new Retrospective(props);
  }

  // Getters
  get itemId(): ItemId {
    return this._itemId;
  }

  get outcome(): Outcome {
    return this._outcome;
  }

  get impactTimeSaved(): number | undefined {
    return this._impactTimeSaved;
  }

  get impactCostSaved(): number | undefined {
    return this._impactCostSaved;
  }

  get effortEstimated(): number | undefined {
    return this._effortEstimated;
  }

  get effortActual(): number | undefined {
    return this._effortActual;
  }

  get lessonsLearned(): string | undefined {
    return this._lessonsLearned;
  }

  get completedAt(): Date {
    return this._completedAt;
  }

  // Domain Methods

  /**
   * Update lessons learned
   */
  updateLessons(lessons: string): void {
    this._lessonsLearned = lessons;
  }

  /**
   * Check if effort was underestimated
   */
  wasUnderestimated(): boolean {
    if (this._effortEstimated === undefined || this._effortActual === undefined) {
      return false;
    }
    return this._effortActual > this._effortEstimated;
  }

  /**
   * Check if effort was overestimated
   */
  wasOverestimated(): boolean {
    if (this._effortEstimated === undefined || this._effortActual === undefined) {
      return false;
    }
    return this._effortActual < this._effortEstimated;
  }

  /**
   * Calculate estimation accuracy (percentage)
   */
  estimationAccuracy(): number | undefined {
    if (this._effortEstimated === undefined || this._effortActual === undefined) {
      return undefined;
    }
    if (this._effortActual === 0) {
      return this._effortEstimated === 0 ? 100 : 0;
    }
    const ratio = this._effortEstimated / this._effortActual;
    return Math.min(100, Math.round(ratio * 100));
  }

  /**
   * Get effort variance (actual - estimated)
   */
  effortVariance(): number | undefined {
    if (this._effortEstimated === undefined || this._effortActual === undefined) {
      return undefined;
    }
    return this._effortActual - this._effortEstimated;
  }

  /**
   * Check if this was a positive outcome
   */
  isPositive(): boolean {
    return this._outcome.isPositive();
  }

  /**
   * Check if decision had measurable impact
   */
  hasImpact(): boolean {
    return (
      (this._impactTimeSaved !== undefined && this._impactTimeSaved > 0) ||
      (this._impactCostSaved !== undefined && this._impactCostSaved > 0)
    );
  }

  /**
   * Check if has lessons documented
   */
  hasLessons(): boolean {
    return !!this._lessonsLearned && this._lessonsLearned.trim().length > 0;
  }

  /**
   * Convert to plain object for storage
   */
  toProps(): RetrospectiveProps {
    return {
      itemId: this._itemId.value,
      outcome: this._outcome.value,
      impactTimeSaved: this._impactTimeSaved,
      impactCostSaved: this._impactCostSaved,
      effortEstimated: this._effortEstimated,
      effortActual: this._effortActual,
      lessonsLearned: this._lessonsLearned,
      completedAt: this._completedAt,
    };
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      item_id: this._itemId.value,
      outcome: this._outcome.value,
      impact_time_saved: this._impactTimeSaved,
      impact_cost_saved: this._impactCostSaved,
      effort_estimated: this._effortEstimated,
      effort_actual: this._effortActual,
      lessons_learned: this._lessonsLearned,
      completed_at: this._completedAt.toISOString(),
    };
  }
}
