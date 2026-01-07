/**
 * DependencyType Value Object
 *
 * Represents the type of relationship between items.
 * Extensible design for future relationship types.
 * Immutable, validates on construction.
 */

export const VALID_DEPENDENCY_TYPES = ['blocks', 'relates-to', 'duplicates', 'parent-of'] as const;
export type DependencyTypeValue = typeof VALID_DEPENDENCY_TYPES[number];

export class DependencyType {
  private readonly _value: DependencyTypeValue;

  private constructor(value: DependencyTypeValue) {
    this._value = value;
  }

  static create(value: string): DependencyType {
    if (!DependencyType.isValid(value)) {
      throw new Error(`Invalid dependency type: ${value}. Must be one of: ${VALID_DEPENDENCY_TYPES.join(', ')}`);
    }
    return new DependencyType(value as DependencyTypeValue);
  }

  static isValid(value: string): value is DependencyTypeValue {
    return VALID_DEPENDENCY_TYPES.includes(value as DependencyTypeValue);
  }

  static blocks(): DependencyType {
    return new DependencyType('blocks');
  }

  static relatesTo(): DependencyType {
    return new DependencyType('relates-to');
  }

  static duplicates(): DependencyType {
    return new DependencyType('duplicates');
  }

  static parentOf(): DependencyType {
    return new DependencyType('parent-of');
  }

  static default(): DependencyType {
    return DependencyType.blocks();
  }

  get value(): DependencyTypeValue {
    return this._value;
  }

  /**
   * Returns whether this dependency type creates a blocking relationship.
   * Only 'blocks' type prevents item completion.
   */
  isBlocking(): boolean {
    return this._value === 'blocks';
  }

  /**
   * Returns whether this dependency type is informational only.
   */
  isInformational(): boolean {
    return this._value === 'relates-to' || this._value === 'duplicates';
  }

  /**
   * Returns whether this dependency type creates a parent-child hierarchy.
   */
  isHierarchical(): boolean {
    return this._value === 'parent-of';
  }

  /**
   * Returns whether this dependency type should be considered in cycle detection.
   * Only blocking and hierarchical relationships form directed graphs that need cycle detection.
   */
  requiresCycleDetection(): boolean {
    return this._value === 'blocks' || this._value === 'parent-of';
  }

  equals(other: DependencyType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): DependencyTypeValue {
    return this._value;
  }
}
