/**
 * TriggerType Value Object
 *
 * Represents the type of trigger that activates a reminder.
 * Immutable, validates on construction.
 */

export const VALID_TRIGGER_TYPES = ['time', 'dependency', 'file_change', 'activity'] as const;
export type TriggerTypeValue = typeof VALID_TRIGGER_TYPES[number];

export class TriggerType {
  private readonly _value: TriggerTypeValue;

  private constructor(value: TriggerTypeValue) {
    this._value = value;
  }

  static create(value: string): TriggerType {
    if (!TriggerType.isValid(value)) {
      throw new Error(`Invalid trigger type: ${value}. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`);
    }
    return new TriggerType(value as TriggerTypeValue);
  }

  static isValid(value: string): value is TriggerTypeValue {
    return VALID_TRIGGER_TYPES.includes(value as TriggerTypeValue);
  }

  static time(): TriggerType {
    return new TriggerType('time');
  }

  static dependency(): TriggerType {
    return new TriggerType('dependency');
  }

  static fileChange(): TriggerType {
    return new TriggerType('file_change');
  }

  static activity(): TriggerType {
    return new TriggerType('activity');
  }

  get value(): TriggerTypeValue {
    return this._value;
  }

  isTimeBased(): boolean {
    return this._value === 'time';
  }

  isDependencyBased(): boolean {
    return this._value === 'dependency';
  }

  isFileChangeBased(): boolean {
    return this._value === 'file_change';
  }

  isActivityBased(): boolean {
    return this._value === 'activity';
  }

  /**
   * Returns whether this trigger type requires external monitoring
   * (vs being checkable on-demand)
   */
  requiresMonitoring(): boolean {
    return this._value === 'activity';
  }

  /**
   * Returns whether this trigger type can be evaluated on-demand
   */
  isOnDemandCheckable(): boolean {
    return this._value !== 'activity';
  }

  equals(other: TriggerType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): TriggerTypeValue {
    return this._value;
  }
}
