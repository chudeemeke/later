import { commandSchemas, CommandSchema, FlagSchema } from './parser.js';

/**
 * Help Generator - Generates help text for commands
 */
export class HelpGenerator {
  /**
   * Generate main help (list of all commands)
   */
  static main(version: string): string {
    const lines: string[] = [];

    lines.push(`later v${version} - Deferred decision management CLI`);
    lines.push('');
    lines.push('USAGE:');
    lines.push('  later <command> [options]');
    lines.push('');
    lines.push('COMMANDS:');
    lines.push('  capture        Capture a new deferred decision');
    lines.push('  list           List deferred items with filtering');
    lines.push('  show           Show full details of a specific item');
    lines.push('  do             Mark item as in-progress and get todo guidance');
    lines.push('  update         Update an existing item');
    lines.push('  delete         Delete an item (soft or hard)');
    lines.push('  bulk-update    Update multiple items at once');
    lines.push('  bulk-delete    Delete multiple items at once');
    lines.push('  search         Full-text search across items');
    lines.push('');
    lines.push('GLOBAL OPTIONS:');
    lines.push('  --help, -h         Show help information');
    lines.push('  --version, -v      Show version information');
    lines.push('  --json             Output in JSON format');
    lines.push('  --no-color         Disable colored output');
    lines.push('  --debug            Enable debug mode');
    lines.push('');
    lines.push('EXAMPLES:');
    lines.push('  later capture "Should we use PostgreSQL or MongoDB?"');
    lines.push('  later list --status pending --priority high');
    lines.push('  later show 5');
    lines.push('  later search "database" --limit 10');
    lines.push('');
    lines.push('Run \'later <command> --help\' for detailed information on a specific command.');

    return lines.join('\n');
  }

  /**
   * Generate command-specific help
   */
  static subcommand(name: string): string {
    const schema = commandSchemas[name];
    if (!schema) {
      return `Unknown command: ${name}`;
    }

    const lines: string[] = [];

    // Header
    lines.push(`later ${name} - ${schema.description}`);
    lines.push('');

    // Usage
    lines.push('USAGE:');
    const usage = this.generateUsage(name, schema);
    lines.push(`  ${usage}`);
    lines.push('');

    // Required positional arguments
    if (schema.requiredPositional) {
      lines.push('ARGUMENTS:');
      const argDescriptions = this.getPositionalDescriptions(name);
      for (const desc of argDescriptions) {
        lines.push(`  ${desc}`);
      }
      lines.push('');
    }

    // Flags/options
    if (schema.flags && Object.keys(schema.flags).length > 0) {
      lines.push('OPTIONS:');
      const flagLines = this.generateFlagHelp(schema.flags);
      for (const line of flagLines) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }

    // Examples
    const examples = this.getExamples(name);
    if (examples.length > 0) {
      lines.push('EXAMPLES:');
      for (const example of examples) {
        lines.push(`  ${example}`);
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
      } else {
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

      // Flag name with short form
      if (schema.short) {
        parts.push(`--${name}, -${schema.short}`);
      } else {
        parts.push(`--${name}`);
      }

      // Value placeholder for non-boolean flags
      if (schema.type !== 'boolean') {
        const valueName = this.getValuePlaceholder(schema);
        parts.push(valueName);
      }

      // Pad to align descriptions
      const flagPart = parts.join(' ').padEnd(25);

      // Description
      let description = schema.description;

      // Add enum values
      if (schema.type === 'enum' && schema.values) {
        description += ` (${schema.values.join(', ')})`;
      }

      // Add default value
      if (schema.default !== undefined) {
        description += ` (default: ${schema.default})`;
      }

      // Add required marker
      if (schema.required) {
        description += ' [required]';
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
