import { describe, it, expect } from '@jest/globals';
import { parseArgs } from '../../src/cli/parser.js';

describe('CLI Argument Parser', () => {
  describe('parseArgs', () => {
    it('should parse capture command with decision text', () => {
      const result = parseArgs(['capture', 'Test decision']);

      expect(result.subcommand).toBe('capture');
      expect(result.args).toEqual(['Test decision']);
      expect(result.errors).toEqual([]);
    });

    it('should parse list command with no arguments', () => {
      const result = parseArgs(['list']);

      expect(result.subcommand).toBe('list');
      expect(result.args).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should parse show command with ID argument', () => {
      const result = parseArgs(['show', '5']);

      expect(result.subcommand).toBe('show');
      expect(result.args).toEqual(['5']);
      expect(result.errors).toEqual([]);
    });

    it('should handle empty arguments array', () => {
      const result = parseArgs([]);

      expect(result.subcommand).toBeNull();
      expect(result.args).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/No subcommand provided/);
    });

    it('should reject invalid subcommand', () => {
      const result = parseArgs(['invalid', 'arg']);

      expect(result.subcommand).toBe('invalid');
      expect(result.args).toEqual(['arg']);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/Unknown subcommand/);
      expect(result.errors[1]).toMatch(/Valid commands/);
    });

    it('should handle capture with multiple arguments', () => {
      const result = parseArgs(['capture', 'arg1', 'arg2', 'arg3']);

      expect(result.subcommand).toBe('capture');
      expect(result.args).toEqual(['arg1', 'arg2', 'arg3']);
      expect(result.errors).toEqual([]);
    });

    it('should handle commands with special characters in args', () => {
      const result = parseArgs(['capture', 'Decision with "quotes" and symbols!@#']);

      expect(result.subcommand).toBe('capture');
      expect(result.args).toEqual(['Decision with "quotes" and symbols!@#']);
      expect(result.errors).toEqual([]);
    });

    it('should preserve empty string arguments', () => {
      const result = parseArgs(['capture', '']);

      expect(result.subcommand).toBe('capture');
      expect(result.args).toEqual(['']);
      expect(result.errors).toEqual([]);
    });

    it('should validate all Phase 1 subcommands', () => {
      const validCommands = ['capture', 'list', 'show'];

      validCommands.forEach(cmd => {
        const result = parseArgs([cmd]);
        // Should recognize as valid subcommand (no "Unknown subcommand" error)
        // May have validation errors for missing required args, which is correct
        const hasUnknownCommandError = result.errors.some(e => e.includes('Unknown subcommand'));
        expect(hasUnknownCommandError).toBe(false);
      });
    });

    it('should handle case-sensitive subcommand validation', () => {
      const result = parseArgs(['Capture', 'Test']);

      expect(result.subcommand).toBe('Capture');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/Unknown subcommand/);
    });
  });

  describe('flag parsing', () => {
    it('should parse long flags', () => {
      const result = parseArgs(['capture', 'Decision', '--priority', 'high']);

      expect(result.subcommand).toBe('capture');
      expect(result.args).toEqual(['Decision']);
      expect(result.flags).toEqual({ priority: 'high' });
    });

    it('should parse short flags', () => {
      const result = parseArgs(['capture', 'Decision', '-p', 'high']);

      expect(result.subcommand).toBe('capture');
      expect(result.flags).toEqual({ priority: 'high' });
    });

    it('should parse boolean flags', () => {
      const result = parseArgs(['capture', 'Decision', '--high']);

      expect(result.flags).toEqual({ high: true });
    });

    it('should parse array flags', () => {
      const result = parseArgs(['capture', 'Decision', '--tags', 'urgent,review']);

      expect(result.flags).toEqual({ tags: ['urgent', 'review'] });
    });

    it('should parse multiple flags', () => {
      const result = parseArgs(['capture', 'Decision', '--priority', 'high', '--tags', 'test', '--high']);

      expect(result.flags).toHaveProperty('priority', 'high');
      expect(result.flags).toHaveProperty('tags');
      expect(result.flags).toHaveProperty('high', true);
    });

    it('should validate enum values', () => {
      const result = parseArgs(['capture', 'Decision', '--priority', 'invalid']);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('priority'))).toBe(true);
    });

    it('should coerce number flags', () => {
      const result = parseArgs(['list', '--limit', '10']);

      expect(result.flags).toEqual({ limit: 10 });
      expect(typeof result.flags?.limit).toBe('number');
    });

    it('should handle invalid number flags', () => {
      const result = parseArgs(['list', '--limit', 'abc']);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing flag value', () => {
      const result = parseArgs(['capture', 'Decision', '--priority']);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('global flags', () => {
    it('should parse --help flag', () => {
      const result = parseArgs(['--help']);

      expect(result.globalFlags?.help).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should parse -h flag', () => {
      const result = parseArgs(['-h']);

      expect(result.globalFlags?.help).toBe(true);
    });

    it('should parse --version flag', () => {
      const result = parseArgs(['--version']);

      expect(result.globalFlags?.version).toBe(true);
    });

    it('should parse -v flag', () => {
      const result = parseArgs(['-v']);

      expect(result.globalFlags?.version).toBe(true);
    });

    it('should parse --json flag', () => {
      const result = parseArgs(['list', '--json']);

      expect(result.globalFlags?.json).toBe(true);
    });

    it('should parse --no-color flag', () => {
      const result = parseArgs(['list', '--no-color']);

      expect(result.globalFlags?.noColor).toBe(true);
    });

    it('should parse --debug flag', () => {
      const result = parseArgs(['list', '--debug']);

      expect(result.globalFlags?.debug).toBe(true);
    });

    it('should handle multiple global flags', () => {
      const result = parseArgs(['list', '--json', '--debug', '--no-color']);

      expect(result.globalFlags?.json).toBe(true);
      expect(result.globalFlags?.debug).toBe(true);
      expect(result.globalFlags?.noColor).toBe(true);
    });

    it('should not require subcommand when help is present', () => {
      const result = parseArgs(['--help']);

      expect(result.subcommand).toBeNull();
      expect(result.errors).toEqual([]);
    });

    it('should not require subcommand when version is present', () => {
      const result = parseArgs(['--version']);

      expect(result.subcommand).toBeNull();
      expect(result.errors).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle flags before subcommand', () => {
      const result = parseArgs(['--json', 'list']);

      expect(result.subcommand).toBe('list');
      expect(result.globalFlags?.json).toBe(true);
    });

    it('should handle mixed global and command flags', () => {
      const result = parseArgs(['capture', 'Test', '--priority', 'high', '--json']);

      expect(result.subcommand).toBe('capture');
      expect(result.flags).toEqual({ priority: 'high' });
      expect(result.globalFlags?.json).toBe(true);
    });

    it('should handle arguments with equals sign', () => {
      const result = parseArgs(['update', '5', '--priority=high']);

      expect(result.subcommand).toBe('update');
      expect(result.args).toEqual(['5']);
      // Note: Current parser doesn't support --flag=value syntax, so this might fail
    });

    it('should handle whitespace in arguments', () => {
      const result = parseArgs(['capture', '  Decision with spaces  ']);

      expect(result.args).toEqual(['  Decision with spaces  ']);
    });

    it('should handle numeric string arguments', () => {
      const result = parseArgs(['show', '123']);

      expect(result.args).toEqual(['123']);
    });

    it('should handle negative number arguments', () => {
      const result = parseArgs(['show', '-1']);

      expect(result.args).toEqual(['-1']);
    });

    it('should handle negative decimal number arguments', () => {
      const result = parseArgs(['show', '-3.14']);

      expect(result.args).toEqual(['-3.14']);
    });

    it('should validate required positional arguments', () => {
      const result = parseArgs(['capture']);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('requires 1 argument'))).toBe(true);
    });

    it('should handle all Phase 2 commands', () => {
      const commands = ['capture', 'list', 'show', 'do', 'update', 'delete', 'bulk-update', 'bulk-delete', 'search'];

      commands.forEach(cmd => {
        const result = parseArgs([cmd]);
        const hasUnknownCommandError = result.errors.some(e => e.includes('Unknown subcommand'));
        expect(hasUnknownCommandError).toBe(false);
      });
    });

    it('should handle very long argument strings', () => {
      const longText = 'A'.repeat(1000);
      const result = parseArgs(['capture', longText]);

      expect(result.args).toEqual([longText]);
      expect(result.args[0].length).toBe(1000);
    });

    it('should handle unicode characters in arguments', () => {
      const unicode = 'Decision with émojis 🚀 and 中文';
      const result = parseArgs(['capture', unicode]);

      expect(result.args).toEqual([unicode]);
    });

    it('should handle multiple errors simultaneously', () => {
      const result = parseArgs(['capture', '--priority', 'invalid', '--unknown-flag', 'value']);

      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.includes('priority'))).toBe(true);
      expect(result.errors.some(e => e.includes('unknown-flag'))).toBe(true);
    });

    it('should handle bulk-update with all flag types', () => {
      const result = parseArgs([
        'bulk-update',
        '1,2,3',
        '--decision',
        'Updated',
        '--priority',
        'high',
        '--add-tags',
        'new,tag',
      ]);

      expect(result.subcommand).toBe('bulk-update');
      expect(result.args).toEqual(['1,2,3']);
      expect(result.flags).toHaveProperty('decision', 'Updated');
      expect(result.flags).toHaveProperty('priority', 'high');
      expect(result.flags).toHaveProperty('add-tags');
    });

    it('should handle search with fields array', () => {
      const result = parseArgs(['search', 'query', '--fields', 'decision,context']);

      expect(result.subcommand).toBe('search');
      expect(result.args).toEqual(['query']);
      expect(result.flags).toHaveProperty('fields');
      expect(Array.isArray(result.flags?.fields)).toBe(true);
    });

    it('should handle delete with hard flag', () => {
      const result = parseArgs(['delete', '5', '--hard']);

      expect(result.subcommand).toBe('delete');
      expect(result.args).toEqual(['5']);
      expect(result.flags).toEqual({ hard: true });
    });

    it('should handle do command with just ID', () => {
      const result = parseArgs(['do', '10']);

      expect(result.subcommand).toBe('do');
      expect(result.args).toEqual(['10']);
      expect(result.errors).toEqual([]);
    });

    it('should coerce limit to number', () => {
      const result = parseArgs(['list', '--limit', '25']);

      expect(result.flags?.limit).toBe(25);
      expect(typeof result.flags?.limit).toBe('number');
    });

    it('should handle multiple global flags together', () => {
      const result = parseArgs(['--json', '--debug', '--no-color', 'list']);

      expect(result.globalFlags?.json).toBe(true);
      expect(result.globalFlags?.debug).toBe(true);
      expect(result.globalFlags?.noColor).toBe(true);
    });

    it('should handle unknown short flags', () => {
      const result = parseArgs(['capture', 'Decision', '-x']); // -x is not a valid short flag

      expect(result.errors).toContain('Unknown flag: -x');
    });

    it('should handle boolean short flags', () => {
      const result = parseArgs(['delete', '1', '--hard']);

      expect(result.flags?.hard).toBe(true);
    });

    it('should error when short flag is missing value', () => {
      const result = parseArgs(['capture', 'Decision', '-p']); // -p requires a value

      expect(result.errors).toContain('Flag -p requires a value');
    });

    it('should error when short flag value is another flag', () => {
      const result = parseArgs(['capture', 'Decision', '-p', '--tags']);

      expect(result.errors).toContain('Flag -p requires a value');
    });
  });

  describe('required flag validation', () => {
    it('should detect missing required flags', async () => {
      // Import the module dynamically to modify the schema
      const parserModule = await import('../../src/cli/parser.js');
      const { commandSchemas } = parserModule;
      const originalSchema = { ...commandSchemas.capture };

      // Add a required flag for testing
      commandSchemas.capture.flags = {
        ...commandSchemas.capture.flags,
        requiredTest: {
          type: 'string',
          description: 'Required test flag',
          required: true,
        },
      };

      const result = parseArgs(['capture', 'Decision']);

      // Restore original schema
      commandSchemas.capture = originalSchema;

      expect(result.errors.some(e => e.includes('Required flag'))).toBe(true);
    });
  });
});
