/**
 * MCP Create Reminder Handler
 *
 * Wraps CreateReminderCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { TriggerTypeValue } from '../../../domain/value-objects/TriggerType.js';
import type { TriggerConfig } from '../../../domain/entities/Reminder.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface CreateReminderArgs {
  item_id: number;
  trigger_type: TriggerTypeValue;
  threshold_days?: number;
  dependency_ids?: number[];
  file_paths?: string[];
}

/**
 * Reminder in MCP format
 */
export interface ReminderMCP {
  id: number;
  item_id: number;
  trigger_type: TriggerTypeValue;
  trigger_config?: Record<string, unknown>;
  triggered_at?: string;
  dismissed_at?: string;
  snoozed_until?: string;
  created_at: string;
}

/**
 * MCP tool result
 */
export interface CreateReminderResult {
  success: boolean;
  reminder?: ReminderMCP;
  message?: string;
  error?: string;
}

/**
 * Create a create reminder handler bound to the container
 */
export function createCreateReminderHandler(
  container: Container
): (args: CreateReminderArgs) => Promise<CreateReminderResult> {
  return async (args: CreateReminderArgs): Promise<CreateReminderResult> => {
    // Build trigger config from args
    const triggerConfig: TriggerConfig = {};

    if (args.threshold_days !== undefined) {
      triggerConfig.thresholdDays = args.threshold_days;
    }

    if (args.dependency_ids && args.dependency_ids.length > 0) {
      triggerConfig.dependencyIds = args.dependency_ids;
    }

    if (args.file_paths && args.file_paths.length > 0) {
      triggerConfig.filePaths = args.file_paths;
    }

    // Execute the application command
    const result = await container.commands.createReminder.execute({
      itemId: args.item_id,
      triggerType: args.trigger_type,
      triggerConfig,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: CreateReminderResult = {
      success: true,
      message: `Reminder created for item #${args.item_id}`,
    };

    // Transform reminder
    if (result.reminder) {
      mcpResult.reminder = {
        id: result.reminder.id,
        item_id: result.reminder.itemId,
        trigger_type: result.reminder.triggerType,
        trigger_config: result.reminder.triggerConfig as Record<string, unknown> | undefined,
        triggered_at: result.reminder.triggeredAt?.toISOString(),
        dismissed_at: result.reminder.dismissedAt?.toISOString(),
        snoozed_until: result.reminder.snoozedUntil?.toISOString(),
        created_at: result.reminder.createdAt.toISOString(),
      };
    }

    return mcpResult;
  };
}
