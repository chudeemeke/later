/**
 * MCP Snooze Reminder Handler
 *
 * Wraps SnoozeReminderCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { ReminderMCP } from './create-reminder.js';

/**
 * MCP tool arguments
 */
export interface SnoozeReminderArgs {
  reminder_id: number;
  days?: number;
}

/**
 * MCP tool result
 */
export interface SnoozeReminderResult {
  success: boolean;
  reminder?: ReminderMCP;
  message?: string;
  snoozed_until?: string;
  error?: string;
}

/**
 * Create a snooze reminder handler bound to the container
 */
export function createSnoozeReminderHandler(
  container: Container
): (args: SnoozeReminderArgs) => Promise<SnoozeReminderResult> {
  return async (args: SnoozeReminderArgs): Promise<SnoozeReminderResult> => {
    // Execute the application command
    const result = await container.commands.snoozeReminder.execute({
      reminderId: args.reminder_id,
      days: args.days,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: SnoozeReminderResult = {
      success: true,
      message: result.message,
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

      if (result.reminder.snoozedUntil) {
        mcpResult.snoozed_until = result.reminder.snoozedUntil.toISOString();
      }
    }

    return mcpResult;
  };
}
