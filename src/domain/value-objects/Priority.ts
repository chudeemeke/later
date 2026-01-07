/**
 * Priority Value Object
 *
 * Represents the importance level of a deferred item.
 * Immutable, validates on construction.
 */

export const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;
export type PriorityValue = typeof VALID_PRIORITIES[number];

const PRIORITY_WEIGHTS: Record<PriorityValue, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class Priority {
  private readonly _value: PriorityValue;

  private constructor(value: PriorityValue) {
    this._value = value;
  }

  static create(value: string): Priority {
    if (!Priority.isValid(value)) {
      throw new Error(`Invalid priority: ${value}. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    return new Priority(value as PriorityValue);
  }

  static isValid(value: string): value is PriorityValue {
    return VALID_PRIORITIES.includes(value as PriorityValue);
  }

  static low(): Priority {
    return new Priority('low');
  }

  static medium(): Priority {
    return new Priority('medium');
  }

  static high(): Priority {
    return new Priority('high');
  }

  static default(): Priority {
    return Priority.medium();
  }

  get value(): PriorityValue {
    return this._value;
  }

  get weight(): number {
    return PRIORITY_WEIGHTS[this._value];
  }

  isLow(): boolean {
    return this._value === 'low';
  }

  isMedium(): boolean {
    return this._value === 'medium';
  }

  isHigh(): boolean {
    return this._value === 'high';
  }

  isHigherThan(other: Priority): boolean {
    return this.weight > other.weight;
  }

  isLowerThan(other: Priority): boolean {
    return this.weight < other.weight;
  }

  compare(other: Priority): number {
    return this.weight - other.weight;
  }

  equals(other: Priority): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): PriorityValue {
    return this._value;
  }
}
