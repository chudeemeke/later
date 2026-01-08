/**
 * GetRemindersQuery
 *
 * Retrieves reminders with optional filtering.
 * Can get reminders for a specific item or all active reminders.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { ReminderProps } from '../../domain/entities/Reminder.js';
import { TriggerTypeValue, VALID_TRIGGER_TYPES } from '../../domain/value-objects/TriggerType.js';

/**
 * Query input
 */
export interface GetRemindersInput {
  itemId?: number;
  triggerType?: TriggerTypeValue;
  includeInactive?: boolean;
  includeCounts?: boolean;
}

/**
 * Query result
 */
export interface GetRemindersResult {
  success: boolean;
  reminders?: ReminderProps[];
  total?: number;
  countsByType?: Record<TriggerTypeValue, number>;
  error?: string;
}

/**
 * GetRemindersQuery Handler
 */
export class GetRemindersQuery {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the query
   */
  async execute(input: GetRemindersInput): Promise<GetRemindersResult> {
    try {
      let reminders: ReminderProps[];

      // Get reminders based on input
      if (input.itemId !== undefined) {
        reminders = await this.storage.getRemindersForItem(input.itemId);
      } else {
        reminders = await this.storage.getActiveReminders();
      }

      // Filter by trigger type if specified
      if (input.triggerType) {
        reminders = reminders.filter((r) => r.triggerType === input.triggerType);
      }

      // Build result
      const result: GetRemindersResult = {
        success: true,
        reminders,
        total: reminders.length,
      };

      // Add counts by type if requested
      if (input.includeCounts) {
        result.countsByType = {
          time: reminders.filter((r) => r.triggerType === 'time').length,
          dependency: reminders.filter((r) => r.triggerType === 'dependency').length,
          file_change: reminders.filter((r) => r.triggerType === 'file_change').length,
          activity: reminders.filter((r) => r.triggerType === 'activity').length,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
