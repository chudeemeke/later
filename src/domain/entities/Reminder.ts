/**
 * Reminder Entity
 *
 * Represents a scheduled notification for an item.
 * Supports multiple trigger types and lifecycle management.
 */

import { ItemId } from '../value-objects/ItemId.js';
import { TriggerType, TriggerTypeValue } from '../value-objects/TriggerType.js';

export interface TriggerConfig {
  // Time-based trigger
  thresholdDays?: number;

  // Dependency-based trigger
  dependencyIds?: number[];

  // File change trigger
  filePaths?: string[];
  fileHashes?: Record<string, string>;

  // Activity trigger
  codePatterns?: string[];
  relatedTags?: string[];
}

export interface ReminderProps {
  id: number;
  itemId: number;
  triggerType: TriggerTypeValue;
  triggerConfig?: TriggerConfig;
  triggeredAt?: Date;
  dismissedAt?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
}

export interface CreateReminderInput {
  id?: number; // Optional - assigned by storage if not provided
  itemId: number;
  triggerType: TriggerTypeValue;
  triggerConfig?: TriggerConfig;
}

export class Reminder {
  private readonly _id: number;
  private readonly _itemId: ItemId;
  private readonly _triggerType: TriggerType;
  private readonly _triggerConfig?: TriggerConfig;
  private _triggeredAt?: Date;
  private _dismissedAt?: Date;
  private _snoozedUntil?: Date;
  private readonly _createdAt: Date;

  private constructor(props: ReminderProps) {
    this._id = props.id;
    this._itemId = ItemId.create(props.itemId);
    this._triggerType = TriggerType.create(props.triggerType);
    this._triggerConfig = props.triggerConfig;
    this._triggeredAt = props.triggeredAt;
    this._dismissedAt = props.dismissedAt;
    this._snoozedUntil = props.snoozedUntil;
    this._createdAt = props.createdAt;
  }

  /**
   * Create a new reminder
   * @param input Creation input. If id is not provided, caller must provide it.
   */
  static create(input: CreateReminderInput & { id: number }): Reminder {
    return new Reminder({
      id: input.id,
      itemId: input.itemId,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute from storage
   */
  static fromProps(props: ReminderProps): Reminder {
    return new Reminder(props);
  }

  // Getters
  get id(): number {
    return this._id;
  }

  get itemId(): ItemId {
    return this._itemId;
  }

  get triggerType(): TriggerType {
    return this._triggerType;
  }

  get triggerConfig(): TriggerConfig | undefined {
    return this._triggerConfig;
  }

  get triggeredAt(): Date | undefined {
    return this._triggeredAt;
  }

  get dismissedAt(): Date | undefined {
    return this._dismissedAt;
  }

  get snoozedUntil(): Date | undefined {
    return this._snoozedUntil;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Domain Methods

  /**
   * Mark reminder as triggered
   */
  trigger(): void {
    this._triggeredAt = new Date();
  }

  /**
   * Dismiss the reminder
   */
  dismiss(): void {
    this._dismissedAt = new Date();
  }

  /**
   * Snooze the reminder
   */
  snooze(days: number): void {
    if (days <= 0) {
      throw new Error('Snooze days must be positive');
    }
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    this._snoozedUntil = snoozedUntil;
  }

  /**
   * Clear snooze
   */
  clearSnooze(): void {
    this._snoozedUntil = undefined;
  }

  /**
   * Check if reminder has been triggered
   */
  hasTriggered(): boolean {
    return this._triggeredAt !== undefined;
  }

  /**
   * Check if reminder has been dismissed
   */
  isDismissed(): boolean {
    return this._dismissedAt !== undefined;
  }

  /**
   * Check if reminder is currently snoozed
   */
  isSnoozed(): boolean {
    if (!this._snoozedUntil) {
      return false;
    }
    return new Date() < this._snoozedUntil;
  }

  /**
   * Check if reminder is active (not dismissed, not snoozed)
   */
  isActive(): boolean {
    return !this.isDismissed() && !this.isSnoozed();
  }

  /**
   * Check if snooze has expired
   */
  snoozeExpired(): boolean {
    if (!this._snoozedUntil) {
      return false;
    }
    return new Date() >= this._snoozedUntil;
  }

  /**
   * Get days remaining on snooze
   */
  snoozeDaysRemaining(): number {
    if (!this._snoozedUntil) {
      return 0;
    }
    const now = new Date();
    const diffMs = this._snoozedUntil.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Check if this reminder should fire based on time threshold
   */
  shouldTriggerByTime(daysSinceUpdate: number): boolean {
    if (!this._triggerType.isTimeBased() || !this._triggerConfig?.thresholdDays) {
      return false;
    }
    return daysSinceUpdate >= this._triggerConfig.thresholdDays;
  }

  /**
   * Check if this reminder should fire based on dependency completion
   */
  shouldTriggerByDependency(completedDependencyId: number): boolean {
    if (!this._triggerType.isDependencyBased() || !this._triggerConfig?.dependencyIds) {
      return false;
    }
    return this._triggerConfig.dependencyIds.includes(completedDependencyId);
  }

  /**
   * Check if this reminder should fire based on file changes
   */
  shouldTriggerByFileChange(changedFiles: string[]): boolean {
    if (!this._triggerType.isFileChangeBased() || !this._triggerConfig?.filePaths) {
      return false;
    }
    return this._triggerConfig.filePaths.some(fp => changedFiles.includes(fp));
  }

  /**
   * Convert to plain object for storage
   */
  toProps(): ReminderProps {
    return {
      id: this._id,
      itemId: this._itemId.value,
      triggerType: this._triggerType.value,
      triggerConfig: this._triggerConfig,
      triggeredAt: this._triggeredAt,
      dismissedAt: this._dismissedAt,
      snoozedUntil: this._snoozedUntil,
      createdAt: this._createdAt,
    };
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      item_id: this._itemId.value,
      trigger_type: this._triggerType.value,
      trigger_config: this._triggerConfig ? JSON.stringify(this._triggerConfig) : undefined,
      triggered_at: this._triggeredAt?.toISOString(),
      dismissed_at: this._dismissedAt?.toISOString(),
      snoozed_until: this._snoozedUntil?.toISOString(),
      created_at: this._createdAt.toISOString(),
    };
  }
}
