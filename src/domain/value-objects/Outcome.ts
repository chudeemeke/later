/**
 * Outcome Value Object
 *
 * Represents the result of a completed decision for retrospectives.
 * Immutable, validates on construction.
 */

export const VALID_OUTCOMES = ['success', 'failure', 'partial'] as const;
export type OutcomeValue = typeof VALID_OUTCOMES[number];

export class Outcome {
  private readonly _value: OutcomeValue;

  private constructor(value: OutcomeValue) {
    this._value = value;
  }

  static create(value: string): Outcome {
    if (!Outcome.isValid(value)) {
      throw new Error(`Invalid outcome: ${value}. Must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }
    return new Outcome(value as OutcomeValue);
  }

  static isValid(value: string): value is OutcomeValue {
    return VALID_OUTCOMES.includes(value as OutcomeValue);
  }

  static success(): Outcome {
    return new Outcome('success');
  }

  static failure(): Outcome {
    return new Outcome('failure');
  }

  static partial(): Outcome {
    return new Outcome('partial');
  }

  get value(): OutcomeValue {
    return this._value;
  }

  isSuccess(): boolean {
    return this._value === 'success';
  }

  isFailure(): boolean {
    return this._value === 'failure';
  }

  isPartial(): boolean {
    return this._value === 'partial';
  }

  isPositive(): boolean {
    return this._value === 'success' || this._value === 'partial';
  }

  equals(other: Outcome): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): OutcomeValue {
    return this._value;
  }
}
