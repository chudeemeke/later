/**
 * CreateReminderCommand
 *
 * Creates a reminder for an item with specified trigger type.
 * Validates item exists and is not completed before creating.
 */

import { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { ReminderProps, TriggerConfig, CreateReminderInput as DomainCreateReminderInput } from '../../domain/entities/Reminder.js';
import { TriggerType, TriggerTypeValue, VALID_TRIGGER_TYPES } from '../../domain/value-objects/TriggerType.js';

/**
 * Command input
 */
export interface CreateReminderInput {
  itemId: number;
  triggerType: TriggerTypeValue;
  triggerConfig?: TriggerConfig;
}

/**
 * Command result
 */
export interface CreateReminderResult {
  success: boolean;
  reminder?: ReminderProps;
  error?: string;
}

/**
 * CreateReminderCommand Handler
 */
export class CreateReminderCommand {
  constructor(private readonly storage: IStoragePort) {}

  /**
   * Execute the command
   */
  async execute(input: CreateReminderInput): Promise<CreateReminderResult> {
    try {
      // Validate trigger type
      if (!VALID_TRIGGER_TYPES.includes(input.triggerType)) {
        return {
          success: false,
          error: `Invalid trigger type: ${input.triggerType}. Must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
        };
      }

      // Validate trigger config based on type
      const configError = this.validateTriggerConfig(input.triggerType, input.triggerConfig);
      if (configError) {
        return { success: false, error: configError };
      }

      // Check item exists
      const item = await this.storage.getItem(input.itemId);
      if (!item) {
        return {
          success: false,
          error: `Item #${input.itemId} not found`,
        };
      }

      // Check item is not completed
      if (item.status === 'done' || item.status === 'archived') {
        return {
          success: false,
          error: `Cannot create reminder for completed or archived item`,
        };
      }

      // Create reminder
      const createInput: DomainCreateReminderInput = {
        itemId: input.itemId,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig,
      };

      const reminder = await this.storage.createReminder(createInput);

      return {
        success: true,
        reminder,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate trigger config based on trigger type
   */
  private validateTriggerConfig(
    triggerType: TriggerTypeValue,
    config?: TriggerConfig
  ): string | null {
    switch (triggerType) {
      case 'time':
        if (!config?.thresholdDays || config.thresholdDays <= 0) {
          return 'Time-based reminders require thresholdDays > 0';
        }
        break;

      case 'dependency':
        if (!config?.dependencyIds || config.dependencyIds.length === 0) {
          return 'Dependency-based reminders require dependencyIds array';
        }
        break;

      case 'file_change':
        if (!config?.filePaths || config.filePaths.length === 0) {
          return 'File change reminders require filePaths array';
        }
        break;

      case 'activity':
        // Activity reminders don't require specific config
        break;
    }

    return null;
  }
}
