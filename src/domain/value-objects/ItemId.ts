/**
 * ItemId Value Object
 *
 * Represents a unique identifier for a deferred item.
 * Immutable, validates positive integer on construction.
 */

export class ItemId {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  static create(value: number): ItemId {
    if (!ItemId.isValid(value)) {
      throw new Error(`Invalid item ID: ${value}. Must be a positive integer.`);
    }
    return new ItemId(value);
  }

  static isValid(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  static fromString(value: string): ItemId {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid item ID string: ${value}. Must be a numeric string.`);
    }
    return ItemId.create(parsed);
  }

  get value(): number {
    return this._value;
  }

  equals(other: ItemId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return String(this._value);
  }

  toJSON(): number {
    return this._value;
  }

  /**
   * Returns display format with hash prefix (e.g., "#123")
   */
  toDisplayString(): string {
    return `#${this._value}`;
  }
}
