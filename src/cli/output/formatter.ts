/**
 * Plain text output formatter for Phase 1 MVP
 *
 * This provides simple, readable text output without colors or tables.
 * Phase 2+ will add enhanced formatting with colors and better layouts.
 */

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return message;
}

/**
 * Format an error message
 */
export function formatError(error: string): string {
  return `Error: ${error}`;
}

/**
 * Format a deferred item for display
 */
export function formatItem(item: any): string {
  const lines: string[] = [];

  lines.push(`Item #${item.id}`);
  lines.push(`Decision: ${item.decision}`);
  lines.push(`Status: ${item.status}`);
  lines.push(`Priority: ${item.priority}`);

  if (item.tags && item.tags.length > 0) {
    lines.push(`Tags: ${item.tags.join(', ')}`);
  }

  if (item.context) {
    lines.push(`Context: ${item.context}`);
  }

  if (item.created_at) {
    lines.push(`Created: ${new Date(item.created_at).toLocaleString()}`);
  }

  if (item.dependencies && item.dependencies.length > 0) {
    lines.push(`Dependencies: ${item.dependencies.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format a list of items for display
 */
export function formatList(items: any[]): string {
  if (items.length === 0) {
    return 'No items found.';
  }

  const lines: string[] = [];
  lines.push(`Found ${items.length} item(s):\n`);

  for (const item of items) {
    lines.push(`#${item.id} [${item.status}] ${item.decision}`);
    lines.push(`  Priority: ${item.priority} | Created: ${new Date(item.created_at).toLocaleString()}`);
    if (item.tags.length > 0) {
      lines.push(`  Tags: ${item.tags.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
