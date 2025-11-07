import { Colors } from './output/table-formatter.js';

/**
 * CLI Exit Codes
 */
export enum ExitCode {
  SUCCESS = 0,
  USER_ERROR = 1,
  SYSTEM_ERROR = 2,
}

/**
 * Base CLI Error
 */
export class CliError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode,
    public tip?: string
  ) {
    super(message);
    this.name = 'CliError';
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CliError);
    }
  }
}

/**
 * User Error - Invalid input, missing arguments, etc.
 */
export class UserError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.USER_ERROR, tip);
    this.name = 'UserError';
  }
}

/**
 * System Error - Server unavailable, network issues, etc.
 */
export class SystemError extends CliError {
  constructor(message: string, tip?: string) {
    super(message, ExitCode.SYSTEM_ERROR, tip);
    this.name = 'SystemError';
  }
}

/**
 * Error Formatter - Formats errors for display with colors and helpful context
 */
export class ErrorFormatter {
  /**
   * Format error for display with tip and context
   */
  static format(error: Error, subcommand?: string): string {
    const lines: string[] = [];

    // Error header with appropriate icon and color
    lines.push('');
    if (error instanceof UserError) {
      lines.push(Colors.error('⚠  User Error'));
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push('');
      lines.push(error.message);
    } else if (error instanceof SystemError) {
      lines.push(Colors.error('✗  System Error'));
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push('');
      lines.push(error.message);
    } else if (error instanceof CliError) {
      lines.push(Colors.error('✗  Error'));
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push('');
      lines.push(error.message);
    } else {
      lines.push(Colors.error('✗  Unexpected Error'));
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push('');
      lines.push(error.message);
    }

    // Add tip if available
    if (error instanceof CliError && error.tip) {
      lines.push('');
      lines.push(Colors.info('💡 Tip'));
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push('');
      lines.push(error.tip);
    }

    // Add context help for subcommand
    if (subcommand) {
      lines.push('');
      lines.push(Colors.dim('─'.repeat(60)));
      lines.push(Colors.dim(`For more information, run: later ${subcommand} --help`));
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get appropriate exit code for error
   */
  static getExitCode(error: Error): number {
    if (error instanceof CliError) {
      return error.exitCode;
    }
    // Default to system error for unknown errors
    return ExitCode.SYSTEM_ERROR;
  }
}
