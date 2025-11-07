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
});
