/**
 * Dependency Entity
 *
 * Represents a relationship between two items.
 * Supports blocking, informational, and hierarchical relationships.
 */

import { ItemId } from '../value-objects/ItemId.js';
import { DependencyType, DependencyTypeValue } from '../value-objects/DependencyType.js';

export interface DependencyProps {
  itemId: number;
  dependsOnId: number;
  type: DependencyTypeValue;
  createdAt: Date;
}

export interface CreateDependencyInput {
  itemId: number;
  dependsOnId: number;
  type?: DependencyTypeValue;
}

export class Dependency {
  private readonly _itemId: ItemId;
  private readonly _dependsOnId: ItemId;
  private readonly _type: DependencyType;
  private readonly _createdAt: Date;

  private constructor(props: DependencyProps) {
    this._itemId = ItemId.create(props.itemId);
    this._dependsOnId = ItemId.create(props.dependsOnId);
    this._type = DependencyType.create(props.type);
    this._createdAt = props.createdAt;
  }

  /**
   * Create a new dependency
   */
  static create(input: CreateDependencyInput): Dependency {
    if (input.itemId === input.dependsOnId) {
      throw new Error('Item cannot depend on itself');
    }

    return new Dependency({
      itemId: input.itemId,
      dependsOnId: input.dependsOnId,
      type: input.type || 'blocks',
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute from storage
   */
  static fromProps(props: DependencyProps): Dependency {
    return new Dependency(props);
  }

  // Getters
  get itemId(): ItemId {
    return this._itemId;
  }

  get dependsOnId(): ItemId {
    return this._dependsOnId;
  }

  get type(): DependencyType {
    return this._type;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Domain Methods

  /**
   * Check if this dependency blocks the item from completion
   */
  isBlocking(): boolean {
    return this._type.isBlocking();
  }

  /**
   * Check if this is an informational link only
   */
  isInformational(): boolean {
    return this._type.isInformational();
  }

  /**
   * Check if this creates a parent-child hierarchy
   */
  isHierarchical(): boolean {
    return this._type.isHierarchical();
  }

  /**
   * Check if this dependency should be considered in cycle detection
   */
  requiresCycleDetection(): boolean {
    return this._type.requiresCycleDetection();
  }

  /**
   * Check if this is the same dependency (same item pair and type)
   */
  equals(other: Dependency): boolean {
    return (
      this._itemId.equals(other._itemId) &&
      this._dependsOnId.equals(other._dependsOnId) &&
      this._type.equals(other._type)
    );
  }

  /**
   * Check if this is a dependency between the same items (any direction or type)
   */
  sameItems(other: Dependency): boolean {
    return (
      (this._itemId.equals(other._itemId) && this._dependsOnId.equals(other._dependsOnId)) ||
      (this._itemId.equals(other._dependsOnId) && this._dependsOnId.equals(other._itemId))
    );
  }

  /**
   * Get the composite key for this dependency
   */
  getKey(): string {
    return `${this._itemId.value}-${this._dependsOnId.value}`;
  }

  /**
   * Convert to plain object for storage
   */
  toProps(): DependencyProps {
    return {
      itemId: this._itemId.value,
      dependsOnId: this._dependsOnId.value,
      type: this._type.value,
      createdAt: this._createdAt,
    };
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      item_id: this._itemId.value,
      depends_on_id: this._dependsOnId.value,
      dep_type: this._type.value,
      created_at: this._createdAt.toISOString(),
    };
  }
}
