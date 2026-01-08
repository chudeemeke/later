/**
 * MCP Show Handler
 *
 * Wraps GetItemQuery for MCP tool interface.
 * Maintains backward compatibility with existing tool API.
 */

import type { Container } from '../../composition-root.js';
import type { StatusValue } from '../../../domain/value-objects/Status.js';
import type { PriorityValue } from '../../../domain/value-objects/Priority.js';

/**
 * MCP tool arguments
 */
export interface ShowArgs {
  id: number;
  include_deps?: boolean;
  include_retro?: boolean;
}

/**
 * MCP item format (snake_case for MCP compatibility)
 */
export interface ShowItem {
  id: number;
  decision: string;
  context?: string;
  status: StatusValue;
  priority: PriorityValue;
  tags: string[];
  created_at: string;
  updated_at: string;
  dependencies?: number[];
  dependents?: number[];
  retrospective?: {
    outcome: string;
    lessons_learned?: string;
    completed_at: string;
  };
}

/**
 * MCP tool result (snake_case for MCP compatibility)
 */
export interface ShowResult {
  success: boolean;
  item?: ShowItem;
  formatted_output?: string;
  error?: string;
}

/**
 * Create a show handler bound to the container
 */
export function createShowHandler(
  container: Container
): (args: ShowArgs) => Promise<ShowResult> {
  return async (args: ShowArgs): Promise<ShowResult> => {
    // Validate ID
    if (!args.id || args.id <= 0) {
      return {
        success: false,
        error: 'Valid item ID is required',
      };
    }

    // Execute the application query
    const result = await container.queries.getItem.execute({
      id: args.id,
      includeDependencies: args.include_deps,
      includeRetrospective: args.include_retro,
    });

    // Handle errors
    if (!result.success || !result.item) {
      return {
        success: false,
        error: result.error || `Item ${args.id} not found`,
      };
    }

    const props = result.item;

    // Build MCP format item
    const item: ShowItem = {
      id: props.id,
      decision: props.decision,
      context: props.context,
      status: props.status,
      priority: props.priority,
      tags: props.tags,
      created_at: props.createdAt.toISOString(),
      updated_at: props.updatedAt.toISOString(),
    };

    // Add dependencies if included
    if (result.dependencies) {
      item.dependencies = result.dependencies.map((d) => d.dependsOnId);
    }
    if (result.dependents) {
      item.dependents = result.dependents.map((d) => d.itemId);
    }

    // Add retrospective if included
    if (result.retrospective) {
      item.retrospective = {
        outcome: result.retrospective.outcome,
        lessons_learned: result.retrospective.lessonsLearned,
        completed_at: result.retrospective.completedAt.toISOString(),
      };
    }

    // Format output
    const formattedOutput = formatItemDetails(item);

    return {
      success: true,
      item,
      formatted_output: formattedOutput,
    };
  };
}

/**
 * Format item details for display
 */
function formatItemDetails(item: ShowItem): string {
  const lines: string[] = [];

  lines.push(`Item #${item.id}`);
  lines.push('─'.repeat(40));
  lines.push(`Decision: ${item.decision}`);
  lines.push(`Status: ${item.status}`);
  lines.push(`Priority: ${item.priority}`);

  if (item.tags.length > 0) {
    lines.push(`Tags: ${item.tags.join(', ')}`);
  }

  lines.push(`Created: ${item.created_at}`);
  lines.push(`Updated: ${item.updated_at}`);

  if (item.context) {
    lines.push('');
    lines.push('Context:');
    lines.push(item.context);
  }

  if (item.dependencies && item.dependencies.length > 0) {
    lines.push('');
    lines.push(`Depends on: #${item.dependencies.join(', #')}`);
  }

  if (item.dependents && item.dependents.length > 0) {
    lines.push(`Blocking: #${item.dependents.join(', #')}`);
  }

  if (item.retrospective) {
    lines.push('');
    lines.push('Retrospective:');
    lines.push(`  Outcome: ${item.retrospective.outcome}`);
    if (item.retrospective.lessons_learned) {
      lines.push(`  Lessons: ${item.retrospective.lessons_learned}`);
    }
    lines.push(`  Completed: ${item.retrospective.completed_at}`);
  }

  return lines.join('\n');
}
