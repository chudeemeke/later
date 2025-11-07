/**
 * Parsed command-line arguments
 */
export interface ParsedArgs {
  subcommand: string | null;
  args: string[];
  errors: string[];
}

/**
 * Parse command-line arguments
 *
 * This is a minimal manual parser for Phase 1 MVP.
 * It extracts the subcommand and remaining arguments without
 * validation or flag parsing.
 *
 * @param argv - Process argv array (typically process.argv.slice(2))
 * @returns Parsed arguments with subcommand and args
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const errors: string[] = [];

  // If no arguments, return null subcommand
  if (argv.length === 0) {
    return {
      subcommand: null,
      args: [],
      errors: ['No subcommand provided. Try: later capture "text"'],
    };
  }

  // First argument is the subcommand
  const subcommand = argv[0];

  // Validate subcommand (Phase 1 MVP: capture, list, show)
  const validCommands = ['capture', 'list', 'show'];
  if (!validCommands.includes(subcommand)) {
    errors.push(`Unknown subcommand: ${subcommand}`);
    errors.push(`Valid commands: ${validCommands.join(', ')}`);
  }

  // Remaining arguments
  const args = argv.slice(1);

  return {
    subcommand,
    args,
    errors,
  };
}
