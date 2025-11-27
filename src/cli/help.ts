import { commandSchemas, CommandSchema, FlagSchema } from './parser.js';
import { Colors } from './output/table-formatter.js';

/**
 * Help Generator - Generates help text for commands
 */
export class HelpGenerator {
  /**
   * Generate main help (list of all commands)
   */
  static main(version: string): string {
    const lines: string[] = [];

    lines.push(Colors.bold(`later v${version}`) + Colors.dim(' - Deferred decision management CLI'));
    lines.push('');
    lines.push(Colors.bold('USAGE:'));
    lines.push(`  ${Colors.dim('$')} later ${Colors.dim('<command> [options]')}`);
    lines.push('');
    lines.push(Colors.bold('COMMANDS:'));
    lines.push(`  ${Colors.bold('capture')}        Capture a new deferred decision`);
    lines.push(`  ${Colors.bold('list')}           List deferred items with filtering`);
    lines.push(`  ${Colors.bold('show')}           Show full details of a specific item`);
    lines.push(`  ${Colors.bold('do')}             Mark item as in-progress and get todo guidance`);
    lines.push(`  ${Colors.bold('update')}         Update an existing item`);
    lines.push(`  ${Colors.bold('delete')}         Delete an item (soft or hard)`);
    lines.push(`  ${Colors.bold('bulk-update')}    Update multiple items at once`);
    lines.push(`  ${Colors.bold('bulk-delete')}    Delete multiple items at once`);
    lines.push(`  ${Colors.bold('search')}         Full-text search across items`);
    lines.push('');
    lines.push(Colors.bold('GLOBAL OPTIONS:'));
    lines.push(`  ${Colors.dim('--help, -h')}         Show help information`);
    lines.push(`  ${Colors.dim('--version, -v')}      Show version information`);
    lines.push(`  ${Colors.dim('--json')}             Output in JSON format`);
    lines.push(`  ${Colors.dim('--no-color')}         Disable colored output`);
    lines.push(`  ${Colors.dim('--debug')}            Enable debug mode`);
    lines.push('');
    lines.push(Colors.bold('EXAMPLES:'));
    lines.push(`  ${Colors.dim('$')} later capture "Should we use PostgreSQL or MongoDB?"`);
    lines.push(`  ${Colors.dim('$')} later list --status pending --priority high`);
    lines.push(`  ${Colors.dim('$')} later show 5`);
    lines.push(`  ${Colors.dim('$')} later search "database" --limit 10`);
    lines.push('');
    lines.push(Colors.dim('Run \'later <command> --help\' for detailed information on a specific command.'));

    return lines.join('\n');
  }

  /**
   * Generate command-specific help
   */
  static subcommand(name: string): string {
    const schema = commandSchemas[name];
    if (!schema) {
      return Colors.error(`Unknown command: ${name}`);
    }

    const lines: string[] = [];

    // Header
    lines.push(Colors.bold(`later ${name}`) + Colors.dim(` - ${schema.description}`));
    lines.push('');

    // Usage
    lines.push(Colors.bold('USAGE:'));
    const usage = this.generateUsage(name, schema);
    lines.push(`  ${Colors.dim('$')} ${usage}`);
    lines.push('');

    // Required positional arguments
    if (schema.requiredPositional) {
      lines.push(Colors.bold('ARGUMENTS:'));
      const argDescriptions = this.getPositionalDescriptions(name);
      for (const desc of argDescriptions) {
        lines.push(`  ${desc}`);
      }
      lines.push('');
    }

    // Flags/options
    if (schema.flags && Object.keys(schema.flags).length > 0) {
      lines.push(Colors.bold('OPTIONS:'));
      const flagLines = this.generateFlagHelp(schema.flags);
      for (const line of flagLines) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }

    // Examples
    const examples = this.getExamples(name);
    if (examples.length > 0) {
      lines.push(Colors.bold('EXAMPLES:'));
      for (const example of examples) {
        lines.push(`  ${Colors.dim('$')} ${example}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate usage line
   */
  private static generateUsage(name: string, schema: CommandSchema): string {
    const parts: string[] = ['later', name];

    // Positional args
    if (schema.requiredPositional) {
      if (schema.requiredPositional === 1) {
        parts.push(this.getPositionalName(name));
      } /* istanbul ignore next - all current commands have 0 or 1 positional arg */ else {
        for (let i = 0; i < schema.requiredPositional; i++) {
          parts.push(`<arg${i + 1}>`);
        }
      }
    }

    // Flags
    if (schema.flags && Object.keys(schema.flags).length > 0) {
      parts.push('[options]');
    }

    return parts.join(' ');
  }

  /**
   * Get positional argument name
   */
  private static getPositionalName(command: string): string {
    const names: Record<string, string> = {
      capture: '<decision>',
      show: '<id>',
      do: '<id>',
      update: '<id>',
      delete: '<id>',
      'bulk-update': '<ids>',
      'bulk-delete': '<ids>',
      search: '<query>',
    };
    return names[command] || '<arg>';
  }

  /**
   * Get positional argument descriptions
   */
  private static getPositionalDescriptions(command: string): string[] {
    const descriptions: Record<string, string[]> = {
      capture: ['<decision>          Decision text to defer (required, max 500 chars)'],
      show: ['<id>                Item ID to show (required, number)'],
      do: ['<id>                Item ID to start working on (required, number)'],
      update: ['<id>                Item ID to update (required, number)'],
      delete: ['<id>                Item ID to delete (required, number)'],
      'bulk-update': ['<ids>               Comma-separated item IDs (e.g., 1,2,3)'],
      'bulk-delete': ['<ids>               Comma-separated item IDs (e.g., 1,2,3)'],
      search: ['<query>             Search query text (required)'],
    };
    return descriptions[command] || [];
  }

  /**
   * Generate flag help lines
   */
  private static generateFlagHelp(flags: Record<string, FlagSchema>): string[] {
    const lines: string[] = [];

    for (const [name, schema] of Object.entries(flags)) {
      const parts: string[] = [];

      // Flag name with short form (colored)
      if (schema.short) {
        parts.push(Colors.dim(`--${name}, -${schema.short}`));
      } else {
        parts.push(Colors.dim(`--${name}`));
      }

      // Value placeholder for non-boolean flags
      if (schema.type !== 'boolean') {
        const valueName = this.getValuePlaceholder(schema);
        parts.push(Colors.dim(valueName));
      }

      // Pad to align descriptions (need to calculate based on original length without colors)
      const originalLength = schema.short
        ? `--${name}, -${schema.short}`.length + (schema.type !== 'boolean' ? this.getValuePlaceholder(schema).length + 1 : 0)
        : `--${name}`.length + (schema.type !== 'boolean' ? this.getValuePlaceholder(schema).length + 1 : 0);
      const paddingNeeded = Math.max(0, 25 - originalLength);
      const flagPart = parts.join(' ') + ' '.repeat(paddingNeeded);

      // Description
      let description = schema.description;

      // Add enum values
      if (schema.type === 'enum' && schema.values) {
        description += Colors.dim(` (${schema.values.join(', ')})`);
      }

      // Add default value
      if (schema.default !== undefined) {
        description += Colors.dim(` (default: ${schema.default})`);
      }

      // Add required marker
      /* istanbul ignore if - no current command flags are marked required */
      if (schema.required) {
        description += Colors.warning(' [required]');
      }

      lines.push(`${flagPart} ${description}`);
    }

    return lines;
  }

  /**
   * Get value placeholder for flag
   */
  private static getValuePlaceholder(schema: FlagSchema): string {
    switch (schema.type) {
      case 'number':
        return '<number>';
      case 'array':
        return '<list>';
      case 'enum':
        return '<value>';
      case 'string':
      default:
        return '<text>';
    }
  }

  /**
   * Get command examples
   */
  private static getExamples(command: string): string[] {
    const examples: Record<string, string[]> = {
      capture: [
        'later capture "Should we use PostgreSQL or MongoDB?"',
        'later capture "Optimize CLAUDE.md" --context "Currently 3343 words" --priority high',
        'later capture "API design decisions" --tags "api,architecture"',
      ],
      list: [
        'later list',
        'later list --status pending',
        'later list --priority high --tags "urgent"',
        'later list --limit 10',
      ],
      show: [
        'later show 5',
        'later show 1',
      ],
      do: [
        'later do 3',
        'later do 1',
      ],
      update: [
        'later update 5 --priority high',
        'later update 3 --status done',
        'later update 1 --add-tags "urgent,review"',
        'later update 2 --decision "Updated decision text"',
      ],
      delete: [
        'later delete 5',
        'later delete 3 --hard',
      ],
      'bulk-update': [
        'later bulk-update 1,2,3 --priority high',
        'later bulk-update 5,6,7 --status done',
        'later bulk-update 1,2 --add-tags "urgent"',
      ],
      'bulk-delete': [
        'later bulk-delete 10,11,12',
        'later bulk-delete 5,6 --hard',
      ],
      search: [
        'later search "database"',
        'later search "optimization" --limit 5',
        'later search "api" --fields decision,tags',
      ],
    };

    return examples[command] || [];
  }
}
