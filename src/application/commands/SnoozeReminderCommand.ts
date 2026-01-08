/**
 * SnoozeReminderCommand
 *
 * Snoozes a reminder for a specified number of days.
 * Can re-snooze already snoozed reminders.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { ReminderProps } from '../../domain/entities/Reminder.js';

/**
 * Command input
 */
export interface SnoozeReminderInput {
  reminderId: number;
  days?: number; // Default: 1 day
}

/**
 * Command result
 */
export interface SnoozeReminderResult {
  success: boolean;
  reminder?: ReminderProps;
  message?: string;
  error?: string;
}

/**
 * SnoozeReminderCommand Handler
 */
export class SnoozeReminderCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the command
   */
  async execute(input: SnoozeReminderInput): Promise<SnoozeReminderResult> {
    try {
      const days = input.days ?? 1;

      // Validate days
      if (days <= 0) {
        return {
          success: false,
          error: 'Snooze days must be a positive number',
        };
      }

      // Get the reminder
      const reminder = await this.storage.getReminder(input.reminderId);

      if (!reminder) {
        return {
          success: false,
          error: `Reminder #${input.reminderId} not found`,
        };
      }

      // Check if already dismissed
      if (reminder.dismissedAt) {
        return {
          success: false,
          error: 'Cannot snooze a dismissed reminder',
        };
      }

      // Calculate snooze until date
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + days);

      // Update reminder
      const updated = await this.storage.updateReminder(input.reminderId, {
        snoozedUntil,
      });

      return {
        success: true,
        reminder: updated,
        message: `Reminder snoozed for ${days} day${days > 1 ? 's' : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
