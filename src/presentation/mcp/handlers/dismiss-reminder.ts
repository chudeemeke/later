/**
 * MCP Dismiss Reminder Handler
 *
 * Wraps DismissReminderCommand for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { ReminderMCP } from './create-reminder.js';

/**
 * MCP tool arguments
 */
export interface DismissReminderArgs {
  reminder_id: number;
}

/**
 * MCP tool result
 */
export interface DismissReminderResult {
  success: boolean;
  reminder?: ReminderMCP;
  message?: string;
  error?: string;
}

/**
 * Create a dismiss reminder handler bound to the container
 */
export function createDismissReminderHandler(
  container: Container
): (args: DismissReminderArgs) => Promise<DismissReminderResult> {
  return async (args: DismissReminderArgs): Promise<DismissReminderResult> => {
    // Execute the application command
    const result = await container.commands.dismissReminder.execute({
      reminderId: args.reminder_id,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: DismissReminderResult = {
      success: true,
      message: `Reminder #${args.reminder_id} dismissed`,
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
