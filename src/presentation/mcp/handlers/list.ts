/**
 * MCP List Handler
 *
 * Wraps ListItemsQuery for MCP tool interface.
 * Maintains backward compatibility with existing tool API.
 */

import type { Container } from '../../composition-root.js';
import type { StatusValue } from '../../../domain/value-objects/Status.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';
import type { ItemProps } from '../../../domain/entities/Item.js';

/**
 * MCP tool arguments (snake_case for MCP compatibility)
 */
export interface ListArgs {
  status?: StatusValue;
  priority?: PriorityValue;
  tags?: string[];
  limit?: number;
}

/**
 * MCP item format (snake_case for MCP compatibility)
 */
export interface ListItem {
  id: number;
  decision: string;
  context?: string;
  status: StatusValue;
  priority: PriorityValue;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface ListResult {
  success: boolean;
  items: ListItem[];
  total_count: number;
  showing_count?: number;
  formatted_output?: string;
  message?: string;
  error?: string;
}

const STATUS_ICONS: Record<StatusValue, string> = {
  pending: '(pending)',
  'in-progress': '(in-progress)',
  done: '(done)',
  archived: '(archived)',
};

const PRIORITY_MARKERS: Record<PriorityValue, string> = {
  high: '[HIGH]',
  medium: '',
  low: '[low]',
};

/**
 * Format relative time
 */
function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

/**
 * Format a single item for display
 */
function formatItem(item: ItemProps): string {
  const statusIcon = STATUS_ICONS[item.status];
  const priorityMarker = PRIORITY_MARKERS[item.priority];
  const age = getRelativeTime(item.createdAt.toISOString());

  let line = `${statusIcon} #${item.id}: ${item.decision}`;

  if (priorityMarker) {
    line += ` ${priorityMarker}`;
  }

  if (item.tags.length > 0) {
    line += ` [${item.tags.join(', ')}]`;
  }

  line += ` (${age})`;

  return line;
}

/**
 * Transform ItemProps to ListItem (MCP format)
 */
function toListItem(props: ItemProps): ListItem {
  return {
    id: props.id,
    decision: props.decision,
    context: props.context,
    status: props.status,
    priority: props.priority,
    tags: props.tags,
    created_at: props.createdAt.toISOString(),
    updated_at: props.updatedAt.toISOString(),
  };
}

/**
 * Create a list handler bound to the container
 */
export function createListHandler(
  container: Container
): (args: ListArgs) => Promise<ListResult> {
  return async (args: ListArgs): Promise<ListResult> => {
    // Execute the application query
    const result = await container.queries.listItems.execute({
      status: args.status,
      priority: args.priority,
      tags: args.tags,
      limit: args.limit,
    });

    // Handle errors
    if (!result.success) {
      return {
        success: false,
        items: [],
        total_count: 0,
        error: result.error || 'Unknown error',
      };
    }

    const items = result.items || [];

    // Transform to MCP format
    const listItems = items.map(toListItem);

    // Format output
    const formattedLines = items.map(formatItem);
    let formattedOutput = formattedLines.join('\n');

    // Add summary footer
    if (args.limit && listItems.length < (result.total || 0)) {
      formattedOutput += `\n\nShowing ${listItems.length} of ${result.total} items`;
    } else {
      formattedOutput += `\n\nTotal: ${listItems.length} item${listItems.length === 1 ? '' : 's'}`;
    }

    return {
      success: true,
      items: listItems,
      total_count: result.total || listItems.length,
      showing_count: listItems.length,
      formatted_output: formattedOutput,
      message: `Found ${result.total || listItems.length} item${(result.total || listItems.length) === 1 ? '' : 's'}`,
    };
  };
}
