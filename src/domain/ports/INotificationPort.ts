/**
 * Notification Port
 *
 * Defines the contract for sending notifications.
 * Implemented by adapters: CLI output, system notifications, etc.
 */

import { ItemProps } from '../entities/Item.js';
import { ReminderProps } from '../entities/Reminder.js';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

/**
 * Notification channel types
 */
export type NotificationChannel = 'cli' | 'system' | 'mcp';

/**
 * Base notification options
 */
export interface NotificationOptions {
  /** Severity of the notification */
  severity?: NotificationSeverity;

  /** Specific channel to use (defaults to all configured) */
  channel?: NotificationChannel;

  /** Whether to persist the notification for later viewing */
  persist?: boolean;

  /** Optional action URL or command */
  action?: {
    label: string;
    command?: string;
    url?: string;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Reminder notification context
 */
export interface ReminderNotificationContext {
  reminder: ReminderProps;
  item: ItemProps;
  reason: string;
  daysSinceUpdate?: number;
  triggeredBy?: 'time' | 'dependency' | 'file_change' | 'activity';
}

/**
 * Item notification context
 */
export interface ItemNotificationContext {
  item: ItemProps;
  action: 'created' | 'updated' | 'completed' | 'blocked' | 'unblocked';
  changes?: Record<string, { old: unknown; new: unknown }>;
}

/**
 * Batch notification summary
 */
export interface BatchNotificationSummary {
  items: ItemProps[];
  title: string;
  description?: string;
  groupBy?: 'status' | 'priority' | 'tag';
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  error?: string;
  notificationId?: string;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  enabled: boolean;
  options?: Record<string, unknown>;
}

/**
 * Main notification port interface
 */
export interface INotificationPort {
  // ===========================================
  // Basic Notifications
  // ===========================================

  /**
   * Send a simple text notification
   */
  notify(
    message: string,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send a formatted notification with title and body
   */
  notifyFormatted(
    title: string,
    body: string,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  // ===========================================
  // Domain-Specific Notifications
  // ===========================================

  /**
   * Send reminder notification
   */
  notifyReminder(
    context: ReminderNotificationContext,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send item notification
   */
  notifyItem(
    context: ItemNotificationContext,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send batch summary notification
   */
  notifyBatch(
    summary: BatchNotificationSummary,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send stale items warning
   */
  notifyStaleItems(
    items: ItemProps[],
    thresholdDays: number,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send blocked items warning
   */
  notifyBlockedItems(
    items: ItemProps[],
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  // ===========================================
  // Interactive Notifications
  // ===========================================

  /**
   * Show notification that requires user response
   * @returns User's choice or null if dismissed
   */
  notifyWithChoices(
    title: string,
    body: string,
    choices: Array<{ label: string; value: string }>,
    options?: NotificationOptions
  ): Promise<string | null>;

  /**
   * Show confirmation prompt
   */
  confirm(
    message: string,
    options?: NotificationOptions
  ): Promise<boolean>;

  // ===========================================
  // Channel Management
  // ===========================================

  /**
   * Get available notification channels
   */
  getAvailableChannels(): NotificationChannel[];

  /**
   * Check if a channel is available and configured
   */
  isChannelAvailable(channel: NotificationChannel): boolean;

  /**
   * Configure a notification channel
   */
  configureChannel(
    channel: NotificationChannel,
    config: ChannelConfig
  ): void;

  /**
   * Get channel configuration
   */
  getChannelConfig(channel: NotificationChannel): ChannelConfig | null;

  // ===========================================
  // Notification History
  // ===========================================

  /**
   * Get recent notifications (if persistence is enabled)
   */
  getRecentNotifications(limit?: number): Promise<Array<{
    id: string;
    message: string;
    severity: NotificationSeverity;
    timestamp: Date;
    channel: NotificationChannel;
  }>>;

  /**
   * Clear notification history
   */
  clearNotificationHistory(): Promise<void>;

  /**
   * Dismiss a persistent notification
   */
  dismissNotification(notificationId: string): Promise<void>;

  // ===========================================
  // Lifecycle
  // ===========================================

  /**
   * Initialize notification system
   */
  initialize(): Promise<void>;

  /**
   * Shutdown notification system
   */
  shutdown(): Promise<void>;
}
