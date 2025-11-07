import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ExitCode,
  CliError,
  UserError,
  SystemError,
  ErrorFormatter,
} from '../../src/cli/errors.js';
import { ColorSupport } from '../../src/cli/output/table-formatter.js';

describe('Exit Codes', () => {
  it('should have correct exit code values', () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.USER_ERROR).toBe(1);
    expect(ExitCode.SYSTEM_ERROR).toBe(2);
  });
});

describe('CliError', () => {
  it('should create error with message and exit code', () => {
    const error = new CliError('Test error', ExitCode.USER_ERROR);

    expect(error.message).toBe('Test error');
    expect(error.exitCode).toBe(ExitCode.USER_ERROR);
    expect(error.name).toBe('CliError');
  });

  it('should create error with tip', () => {
    const error = new CliError('Test error', ExitCode.USER_ERROR, 'Try this instead');

    expect(error.message).toBe('Test error');
    expect(error.tip).toBe('Try this instead');
  });

  it('should maintain stack trace', () => {
    const error = new CliError('Test error', ExitCode.USER_ERROR);
    expect(error.stack).toBeDefined();
  });
});

describe('UserError', () => {
  it('should create user error with correct exit code', () => {
    const error = new UserError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.exitCode).toBe(ExitCode.USER_ERROR);
    expect(error.name).toBe('UserError');
  });

  it('should accept tip', () => {
    const error = new UserError('Invalid input', 'Provide a valid ID');

    expect(error.message).toBe('Invalid input');
    expect(error.tip).toBe('Provide a valid ID');
  });
});

describe('SystemError', () => {
  it('should create system error with correct exit code', () => {
    const error = new SystemError('Server unavailable');

    expect(error.message).toBe('Server unavailable');
    expect(error.exitCode).toBe(ExitCode.SYSTEM_ERROR);
    expect(error.name).toBe('SystemError');
  });

  it('should accept tip', () => {
    const error = new SystemError('Server unavailable', 'Check MCP server is running');

    expect(error.message).toBe('Server unavailable');
    expect(error.tip).toBe('Check MCP server is running');
  });
});

describe('ErrorFormatter', () => {
  beforeEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  describe('format', () => {
    it('should format UserError', () => {
      const error = new UserError('Invalid ID', 'ID must be a number');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Invalid ID');
      expect(formatted).toContain('User Error');
      expect(formatted).toContain('ID must be a number');
      expect(formatted).toContain('💡');
    });

    it('should format SystemError', () => {
      const error = new SystemError('Connection failed');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Connection failed');
      expect(formatted).toContain('System Error');
    });

    it('should format generic Error', () => {
      const error = new Error('Something unexpected');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Something unexpected');
      expect(formatted).toContain('Unexpected Error');
    });

    it('should include tip when available', () => {
      const error = new UserError('Missing argument', 'Provide the item ID');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Missing argument');
      expect(formatted).toContain('Provide the item ID');
      expect(formatted).toContain('Tip');
    });

    it('should not include tip section when tip is undefined', () => {
      const error = new UserError('Invalid input');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Invalid input');
      expect(formatted).not.toContain('Tip');
    });

    it('should include subcommand help when provided', () => {
      const error = new UserError('Invalid argument');
      const formatted = ErrorFormatter.format(error, 'show');

      expect(formatted).toContain('Invalid argument');
      expect(formatted).toContain('later show --help');
    });

    it('should not include subcommand help when not provided', () => {
      const error = new UserError('Invalid argument');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Invalid argument');
      expect(formatted).not.toContain('--help');
    });

    it('should work without colors', () => {
      ColorSupport.disable();

      const error = new UserError('Test error', 'Test tip');
      const formatted = ErrorFormatter.format(error);

      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Test tip');
      expect(formatted).toContain('User Error');

      // Should still be readable
      expect(formatted.length).toBeGreaterThan(10);
    });
  });

  describe('getExitCode', () => {
    it('should return correct exit code for UserError', () => {
      const error = new UserError('Test');
      const code = ErrorFormatter.getExitCode(error);

      expect(code).toBe(ExitCode.USER_ERROR);
    });

    it('should return correct exit code for SystemError', () => {
      const error = new SystemError('Test');
      const code = ErrorFormatter.getExitCode(error);

      expect(code).toBe(ExitCode.SYSTEM_ERROR);
    });

    it('should return correct exit code for CliError', () => {
      const error = new CliError('Test', ExitCode.SUCCESS);
      const code = ErrorFormatter.getExitCode(error);

      expect(code).toBe(ExitCode.SUCCESS);
    });

    it('should return SYSTEM_ERROR for generic Error', () => {
      const error = new Error('Unexpected');
      const code = ErrorFormatter.getExitCode(error);

      expect(code).toBe(ExitCode.SYSTEM_ERROR);
    });
  });
});
