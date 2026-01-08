/**
 * MCP Get Reminders Handler
 *
 * Wraps GetRemindersQuery for MCP tool interface.
 */

import type { Container } from '../../composition-root.js';
import type { TriggerTypeValue } from '../../../domain/value-objects/TriggerType.js';
import type { ReminderMCP } from './create-reminder.js';

/**
 * MCP tool arguments
 */
export interface GetRemindersArgs {
  item_id?: number;
  trigger_type?: TriggerTypeValue;
  include_counts?: boolean;
}

/**
 * Counts by trigger type in MCP format
 */
export interface TriggerCountsMCP {
  time: number;
  dependency: number;
  file_change: number;
  activity: number;
}

/**
 * MCP tool result
 */
export interface GetRemindersResult {
  success: boolean;
  reminders?: ReminderMCP[];
  total?: number;
  counts_by_type?: TriggerCountsMCP;
  error?: string;
}

/**
 * Create a get reminders handler bound to the container
 */
export function createGetRemindersHandler(
  container: Container
): (args: GetRemindersArgs) => Promise<GetRemindersResult> {
  return async (args: GetRemindersArgs): Promise<GetRemindersResult> => {
    // Execute the application query
    const result = await container.queries.getReminders.execute({
      itemId: args.item_id,
      triggerType: args.trigger_type,
      includeCounts: args.include_counts,
    });

    // Transform to MCP-compatible result
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
      };
    }

    const mcpResult: GetRemindersResult = {
      success: true,
      total: result.total,
    };

    // Transform reminders
    if (result.reminders) {
      mcpResult.reminders = result.reminders.map((r) => ({
        id: r.id,
        item_id: r.itemId,
        trigger_type: r.triggerType,
        trigger_config: r.triggerConfig as Record<string, unknown> | undefined,
        triggered_at: r.triggeredAt?.toISOString(),
        dismissed_at: r.dismissedAt?.toISOString(),
        snoozed_until: r.snoozedUntil?.toISOString(),
        created_at: r.createdAt.toISOString(),
      }));
    }

    // Transform counts
    if (result.countsByType) {
      mcpResult.counts_by_type = {
        time: result.countsByType.time,
        dependency: result.countsByType.dependency,
        file_change: result.countsByType.file_change,
        activity: result.countsByType.activity,
      };
    }

    return mcpResult;
  };
}
