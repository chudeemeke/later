/**
 * Status Value Object
 *
 * Represents the lifecycle state of a deferred item.
 * Immutable, validates on construction.
 */

export const VALID_STATUSES = ['pending', 'in-progress', 'done', 'archived'] as const;
export type StatusValue = typeof VALID_STATUSES[number];

export class Status {
  private readonly _value: StatusValue;

  private constructor(value: StatusValue) {
    this._value = value;
  }

  static create(value: string): Status {
    if (!Status.isValid(value)) {
      throw new Error(`Invalid status: ${value}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    return new Status(value as StatusValue);
  }

  static isValid(value: string): value is StatusValue {
    return VALID_STATUSES.includes(value as StatusValue);
  }

  static pending(): Status {
    return new Status('pending');
  }

  static inProgress(): Status {
    return new Status('in-progress');
  }

  static done(): Status {
    return new Status('done');
  }

  static archived(): Status {
    return new Status('archived');
  }

  get value(): StatusValue {
    return this._value;
  }

  isPending(): boolean {
    return this._value === 'pending';
  }

  isInProgress(): boolean {
    return this._value === 'in-progress';
  }

  isDone(): boolean {
    return this._value === 'done';
  }

  isArchived(): boolean {
    return this._value === 'archived';
  }

  isActive(): boolean {
    return this._value === 'pending' || this._value === 'in-progress';
  }

  isComplete(): boolean {
    return this._value === 'done' || this._value === 'archived';
  }

  canTransitionTo(target: Status): boolean {
    const transitions: Record<StatusValue, StatusValue[]> = {
      'pending': ['in-progress', 'done', 'archived'],
      'in-progress': ['pending', 'done', 'archived'],
      'done': ['archived'],
      'archived': [],
    };
    return transitions[this._value].includes(target.value);
  }

  equals(other: Status): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): StatusValue {
    return this._value;
  }
}
