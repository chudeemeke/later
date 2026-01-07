/**
 * Item Entity
 *
 * Aggregate root representing a deferred decision.
 * Contains business rules for item lifecycle management.
 */

import { ItemId } from '../value-objects/ItemId.js';
import { Status, StatusValue } from '../value-objects/Status.js';
import { Priority, PriorityValue } from '../value-objects/Priority.js';

export interface ItemProps {
  id: number;
  decision: string;
  context: string;
  status: StatusValue;
  tags: string[];
  priority: PriorityValue;
  createdAt: Date;
  updatedAt: Date;
  conversationId?: string;
  dependencies?: number[];
  contextTokens?: Record<string, string>;
  contextPiiTypes?: Record<string, number>;
  contextHash?: string;
  contextFiles?: string[];
}

export interface CreateItemInput {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: PriorityValue;
  conversationId?: string;
  dependencies?: number[];
}

export class Item {
  private readonly _id: ItemId;
  private readonly _decision: string;
  private _context: string;
  private _status: Status;
  private _tags: string[];
  private _priority: Priority;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _conversationId?: string;
  private _dependencies: number[];
  private _contextTokens?: Record<string, string>;
  private _contextPiiTypes?: Record<string, number>;
  private _contextHash?: string;
  private _contextFiles?: string[];

  private constructor(props: ItemProps) {
    this._id = ItemId.create(props.id);
    this._decision = props.decision;
    this._context = props.context;
    this._status = Status.create(props.status);
    this._tags = [...props.tags];
    this._priority = Priority.create(props.priority);
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._conversationId = props.conversationId;
    this._dependencies = props.dependencies ? [...props.dependencies] : [];
    this._contextTokens = props.contextTokens;
    this._contextPiiTypes = props.contextPiiTypes;
    this._contextHash = props.contextHash;
    this._contextFiles = props.contextFiles ? [...props.contextFiles] : undefined;
  }

  /**
   * Create a new item (for capture use case)
   */
  static create(id: number, input: CreateItemInput): Item {
    if (!input.decision || input.decision.trim().length === 0) {
      throw new Error('Decision cannot be empty');
    }

    const now = new Date();
    return new Item({
      id,
      decision: input.decision.trim(),
      context: input.context || '',
      status: 'pending',
      tags: input.tags || [],
      priority: input.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      conversationId: input.conversationId,
      dependencies: input.dependencies || [],
    });
  }

  /**
   * Reconstitute from storage
   */
  static fromProps(props: ItemProps): Item {
    return new Item(props);
  }

  // Getters
  get id(): ItemId {
    return this._id;
  }

  get decision(): string {
    return this._decision;
  }

  get context(): string {
    return this._context;
  }

  get status(): Status {
    return this._status;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get priority(): Priority {
    return this._priority;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get conversationId(): string | undefined {
    return this._conversationId;
  }

  get dependencies(): readonly number[] {
    return this._dependencies;
  }

  get contextTokens(): Record<string, string> | undefined {
    return this._contextTokens;
  }

  get contextPiiTypes(): Record<string, number> | undefined {
    return this._contextPiiTypes;
  }

  get contextHash(): string | undefined {
    return this._contextHash;
  }

  get contextFiles(): readonly string[] | undefined {
    return this._contextFiles;
  }

  // Domain Methods

  /**
   * Transition to new status
   */
  transitionTo(newStatus: Status): void {
    if (!this._status.canTransitionTo(newStatus)) {
      throw new Error(
        `Cannot transition from ${this._status.value} to ${newStatus.value}`
      );
    }
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  /**
   * Mark as in progress
   */
  start(): void {
    this.transitionTo(Status.inProgress());
  }

  /**
   * Mark as done
   */
  complete(): void {
    this.transitionTo(Status.done());
  }

  /**
   * Archive the item
   */
  archive(): void {
    this.transitionTo(Status.archived());
  }

  /**
   * Update priority
   */
  setPriority(priority: Priority): void {
    this._priority = priority;
    this._updatedAt = new Date();
  }

  /**
   * Update context
   */
  updateContext(context: string, contextHash?: string, contextFiles?: string[]): void {
    this._context = context;
    this._contextHash = contextHash;
    this._contextFiles = contextFiles;
    this._updatedAt = new Date();
  }

  /**
   * Set PII tokenization data
   */
  setContextTokenization(
    tokens: Record<string, string>,
    piiTypes: Record<string, number>
  ): void {
    this._contextTokens = tokens;
    this._contextPiiTypes = piiTypes;
  }

  /**
   * Add a tag
   */
  addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !this._tags.includes(normalizedTag)) {
      this._tags.push(normalizedTag);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove a tag
   */
  removeTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    const index = this._tags.indexOf(normalizedTag);
    if (index !== -1) {
      this._tags.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  /**
   * Set all tags
   */
  setTags(tags: string[]): void {
    this._tags = tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0);
    this._updatedAt = new Date();
  }

  /**
   * Check if has specific tag
   */
  hasTag(tag: string): boolean {
    return this._tags.includes(tag.toLowerCase().trim());
  }

  /**
   * Add dependency
   */
  addDependency(dependsOnId: number): void {
    if (dependsOnId === this._id.value) {
      throw new Error('Item cannot depend on itself');
    }
    if (!this._dependencies.includes(dependsOnId)) {
      this._dependencies.push(dependsOnId);
      this._updatedAt = new Date();
    }
  }

  /**
   * Remove dependency
   */
  removeDependency(dependsOnId: number): void {
    const index = this._dependencies.indexOf(dependsOnId);
    if (index !== -1) {
      this._dependencies.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  /**
   * Check if blocked by dependencies
   */
  hasDependencies(): boolean {
    return this._dependencies.length > 0;
  }

  /**
   * Check if item is active (can be worked on)
   */
  isActive(): boolean {
    return this._status.isActive();
  }

  /**
   * Check if item is complete
   */
  isComplete(): boolean {
    return this._status.isComplete();
  }

  /**
   * Calculate days since creation
   */
  daysSinceCreation(): number {
    const now = new Date();
    const diffMs = now.getTime() - this._createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days since last update
   */
  daysSinceUpdate(): number {
    const now = new Date();
    const diffMs = now.getTime() - this._updatedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if stale (not updated in N days)
   */
  isStale(thresholdDays: number = 30): boolean {
    return this.daysSinceUpdate() >= thresholdDays;
  }

  /**
   * Convert to plain object for storage
   */
  toProps(): ItemProps {
    return {
      id: this._id.value,
      decision: this._decision,
      context: this._context,
      status: this._status.value,
      tags: [...this._tags],
      priority: this._priority.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      conversationId: this._conversationId,
      dependencies: this._dependencies.length > 0 ? [...this._dependencies] : undefined,
      contextTokens: this._contextTokens,
      contextPiiTypes: this._contextPiiTypes,
      contextHash: this._contextHash,
      contextFiles: this._contextFiles ? [...this._contextFiles] : undefined,
    };
  }

  /**
   * Convert to JSON-serializable object for storage
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id.value,
      decision: this._decision,
      context: this._context,
      status: this._status.value,
      tags: this._tags,
      priority: this._priority.value,
      created_at: this._createdAt.toISOString(),
      updated_at: this._updatedAt.toISOString(),
      conversation_id: this._conversationId,
      dependencies: this._dependencies.length > 0 ? this._dependencies : undefined,
      context_tokens: this._contextTokens,
      context_pii_types: this._contextPiiTypes,
      context_hash: this._contextHash,
      context_files: this._contextFiles,
    };
  }
}
