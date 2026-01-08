/**
 * DismissReminderCommand
 *
 * Dismisses a reminder permanently.
 * Clears any snooze and marks as dismissed.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { ReminderProps } from '../../domain/entities/Reminder.js';

/**
 * Command input
 */
export interface DismissReminderInput {
  reminderId: number;
}

/**
 * Command result
 */
export interface DismissReminderResult {
  success: boolean;
  reminder?: ReminderProps;
  error?: string;
}

/**
 * DismissReminderCommand Handler
 */
export class DismissReminderCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the command
   */
  async execute(input: DismissReminderInput): Promise<DismissReminderResult> {
    try {
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
          error: 'Reminder is already dismissed',
        };
      }

      // Update reminder with dismissal
      const updated = await this.storage.updateReminder(input.reminderId, {
        dismissedAt: new Date(),
        snoozedUntil: undefined, // Clear any snooze
      });

      return {
        success: true,
        reminder: updated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
