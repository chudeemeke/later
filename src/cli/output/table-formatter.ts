/**
 * Table formatter with colors for Phase 3 UX
 *
 * Provides beautiful, color-coded table output using chalk and cli-table3.
 * Automatically detects color support and gracefully degrades.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Color support detection
 */
export class ColorSupport {
  private static forceDisabled = false;

  /**
   * Check if colors should be enabled
   *
   * Considers:
   * - NO_COLOR environment variable (industry standard)
   * - --no-color flag (passed via disable())
   * - Terminal capabilities (chalk handles this automatically)
   */
  static isEnabled(): boolean {
    if (this.forceDisabled) return false;
    if (process.env.NO_COLOR) return false;
    return chalk.level > 0;
  }

  /**
   * Disable colors (called when --no-color flag is used)
   */
  static disable(): void {
    this.forceDisabled = true;
    chalk.level = 0;
  }

  /**
   * Enable colors (for testing)
   */
  static enable(): void {
    this.forceDisabled = false;
  }
}

/**
 * Color helpers for consistent styling
 */
export class Colors {
  // Priority colors
  static priority(priority: string): string {
    if (!ColorSupport.isEnabled()) return priority;

    switch (priority.toLowerCase()) {
      case 'high':
        return chalk.red(priority);
      case 'medium':
        return chalk.yellow(priority);
      case 'low':
        return chalk.gray(priority);
      default:
        return priority;
    }
  }

  // Status colors
  static status(status: string): string {
    if (!ColorSupport.isEnabled()) return status;

    switch (status.toLowerCase()) {
      case 'pending':
        return chalk.cyan(status);
      case 'in_progress':
        return chalk.yellow(status);
      case 'done':
        return chalk.green(status);
      case 'archived':
        return chalk.gray(status);
      default:
        return status;
    }
  }

  // ID colors
  static id(id: number | string): string {
    if (!ColorSupport.isEnabled()) return `#${id}`;
    return chalk.bold.blue(`#${id}`);
  }

  // Success messages
  static success(message: string): string {
    if (!ColorSupport.isEnabled()) return `✓ ${message}`;
    return chalk.green(`✓ ${message}`);
  }

  // Error messages
  static error(message: string): string {
    if (!ColorSupport.isEnabled()) return `✗ ${message}`;
    return chalk.red(`✗ ${message}`);
  }

  // Warning messages
  static warning(message: string): string {
    if (!ColorSupport.isEnabled()) return `⚠ ${message}`;
    return chalk.yellow(`⚠ ${message}`);
  }

  // Info messages
  static info(message: string): string {
    if (!ColorSupport.isEnabled()) return `ℹ ${message}`;
    return chalk.blue(`ℹ ${message}`);
  }

  // Dim text (for less important info)
  static dim(text: string): string {
    if (!ColorSupport.isEnabled()) return text;
    return chalk.dim(text);
  }

  // Bold text (for emphasis)
  static bold(text: string): string {
    if (!ColorSupport.isEnabled()) return text;
    return chalk.bold(text);
  }

  // Tags
  static tag(tag: string): string {
    if (!ColorSupport.isEnabled()) return tag;
    return chalk.cyan(tag);
  }
}

/**
 * Text truncation utilities
 */
export class TextUtils {
  /**
   * Truncate text to max length with ellipsis
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Truncate with word boundary awareness
   */
  static truncateWords(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Format date for display
   */
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    return date.toLocaleDateString();
  }

  /**
   * Format tags for display
   */
  static formatTags(tags: string[]): string {
    if (!tags || tags.length === 0) return '-';
    return tags.map(tag => Colors.tag(tag)).join(', ');
  }
}

/**
 * Table formatter for list views
 */
export class TableFormatter {
  /**
   * Format a list of items as a table
   */
  static formatList(items: any[]): string {
    if (items.length === 0) {
      return Colors.dim('No items found.');
    }

    const table = new Table({
      head: [
        Colors.bold('ID'),
        Colors.bold('Decision'),
        Colors.bold('Status'),
        Colors.bold('Priority'),
        Colors.bold('Tags'),
        Colors.bold('Created'),
      ],
      colWidths: [6, 40, 12, 10, 20, 15],
      style: {
        head: [], // Don't apply default colors, we handle it
        border: ColorSupport.isEnabled() ? ['gray'] : [],
      },
      wordWrap: true,
    });

    for (const item of items) {
      table.push([
        Colors.id(item.id),
        TextUtils.truncateWords(item.decision, 38),
        Colors.status(item.status),
        Colors.priority(item.priority),
        TextUtils.formatTags(item.tags),
        Colors.dim(TextUtils.formatDate(item.created_at)),
      ]);
    }

    const header = Colors.bold(`\nFound ${items.length} item(s):\n`);
    return header + table.toString();
  }

  /**
   * Format a single item with all details
   */
  static formatItem(item: any): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(Colors.bold(`Item ${Colors.id(item.id)}`));
    lines.push('─'.repeat(60));

    // Decision (main content)
    lines.push('');
    lines.push(Colors.bold('Decision:'));
    lines.push(`  ${item.decision}`);

    // Metadata table
    const metaTable = new Table({
      colWidths: [15, 45],
      style: {
        border: ColorSupport.isEnabled() ? ['gray'] : [],
      },
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' ',
      },
    });

    metaTable.push(
      [Colors.dim('Status'), Colors.status(item.status)],
      [Colors.dim('Priority'), Colors.priority(item.priority)],
      [Colors.dim('Tags'), TextUtils.formatTags(item.tags)],
      [Colors.dim('Created'), TextUtils.formatDate(item.created_at)]
    );

    if (item.updated_at && item.updated_at !== item.created_at) {
      metaTable.push([Colors.dim('Updated'), TextUtils.formatDate(item.updated_at)]);
    }

    if (item.dependencies && item.dependencies.length > 0) {
      metaTable.push([
        Colors.dim('Blocks on'),
        item.dependencies.map((id: number) => Colors.id(id)).join(', '),
      ]);
    }

    lines.push('');
    lines.push(metaTable.toString());

    // Context (if present)
    if (item.context) {
      lines.push('');
      lines.push(Colors.bold('Context:'));
      lines.push(`  ${item.context}`);
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format search results with scores
   */
  static formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return Colors.dim('No matching items found.');
    }

    const table = new Table({
      head: [
        Colors.bold('Score'),
        Colors.bold('ID'),
        Colors.bold('Decision'),
        Colors.bold('Match Details'),
      ],
      colWidths: [8, 6, 35, 30],
      style: {
        head: [],
        border: ColorSupport.isEnabled() ? ['gray'] : [],
      },
      wordWrap: true,
    });

    for (const result of results) {
      const score = result.score ? result.score.toFixed(2) : '-';
      const scoreColored = ColorSupport.isEnabled()
        ? result.score >= 0.8
          ? chalk.green(score)
          : result.score >= 0.5
          ? chalk.yellow(score)
          : chalk.gray(score)
        : score;

      const matchDetails = result.matchedFields
        ? result.matchedFields.join(', ')
        : '-';

      table.push([
        scoreColored,
        Colors.id(result.item.id),
        TextUtils.truncateWords(result.item.decision, 33),
        Colors.dim(matchDetails),
      ]);
    }

    const header = Colors.bold(`\nFound ${results.length} matching item(s):\n`);
    return header + table.toString();
  }

  /**
   * Format bulk operation results
   */
  static formatBulkResults(
    operation: string,
    successful: number[],
    failed: Array<{ id: number; error: string }>
  ): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(Colors.bold(`Bulk ${operation} Results:`));
    lines.push('─'.repeat(60));

    if (successful.length > 0) {
      lines.push('');
      lines.push(Colors.success(`Successfully ${operation}d ${successful.length} item(s):`));
      lines.push(`  ${successful.map(id => Colors.id(id)).join(', ')}`);
    }

    if (failed.length > 0) {
      lines.push('');
      lines.push(Colors.error(`Failed to ${operation} ${failed.length} item(s):`));
      for (const failure of failed) {
        lines.push(`  ${Colors.id(failure.id)}: ${failure.error}`);
      }
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format a simple message with appropriate styling
   */
  static formatMessage(type: 'success' | 'error' | 'warning' | 'info', message: string): string {
    switch (type) {
      case 'success':
        return Colors.success(message);
      case 'error':
        return Colors.error(message);
      case 'warning':
        return Colors.warning(message);
      case 'info':
        return Colors.info(message);
    }
  }
}
