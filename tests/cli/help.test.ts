import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HelpGenerator } from '../../src/cli/help.js';
import { ColorSupport } from '../../src/cli/output/table-formatter.js';

describe('HelpGenerator', () => {
  beforeEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  afterEach(() => {
    ColorSupport.enable();
    delete process.env.NO_COLOR;
  });

  describe('main help', () => {
    it('should generate main help text', () => {
      const help = HelpGenerator.main('1.0.0');

      expect(help).toContain('later v1.0.0');
      expect(help).toContain('USAGE:');
      expect(help).toContain('COMMANDS:');
      expect(help).toContain('GLOBAL OPTIONS:');
      expect(help).toContain('EXAMPLES:');
    });

    it('should list all 9 commands', () => {
      const help = HelpGenerator.main('1.0.0');

      expect(help).toContain('capture');
      expect(help).toContain('list');
      expect(help).toContain('show');
      expect(help).toContain('do');
      expect(help).toContain('update');
      expect(help).toContain('delete');
      expect(help).toContain('bulk-update');
      expect(help).toContain('bulk-delete');
      expect(help).toContain('search');
    });

    it('should list global options', () => {
      const help = HelpGenerator.main('1.0.0');

      expect(help).toContain('--help');
      expect(help).toContain('--version');
      expect(help).toContain('--json');
      expect(help).toContain('--no-color');
      expect(help).toContain('--debug');
    });

    it('should include examples', () => {
      const help = HelpGenerator.main('1.0.0');

      expect(help).toContain('later capture');
      expect(help).toContain('later list');
      expect(help).toContain('later show');
      expect(help).toContain('later search');
    });

    it('should include help tip', () => {
      const help = HelpGenerator.main('1.0.0');
      expect(help).toContain('later <command> --help');
    });
  });

  describe('subcommand help', () => {
    it('should generate capture help', () => {
      const help = HelpGenerator.subcommand('capture');

      expect(help).toContain('later capture');
      expect(help).toContain('USAGE:');
      expect(help).toContain('<decision>');
      expect(help).toContain('OPTIONS:');
      expect(help).toContain('--context');
      expect(help).toContain('--priority');
      expect(help).toContain('--tags');
      expect(help).toContain('--high');
      expect(help).toContain('EXAMPLES:');
    });

    it('should generate list help', () => {
      const help = HelpGenerator.subcommand('list');

      expect(help).toContain('later list');
      expect(help).toContain('USAGE:');
      expect(help).toContain('OPTIONS:');
      expect(help).toContain('--status');
      expect(help).toContain('--priority');
      expect(help).toContain('--tags');
      expect(help).toContain('--limit');
    });

    it('should generate show help', () => {
      const help = HelpGenerator.subcommand('show');

      expect(help).toContain('later show');
      expect(help).toContain('<id>');
      expect(help).toContain('USAGE:');
    });

    it('should generate do help', () => {
      const help = HelpGenerator.subcommand('do');

      expect(help).toContain('later do');
      expect(help).toContain('<id>');
    });

    it('should generate update help', () => {
      const help = HelpGenerator.subcommand('update');

      expect(help).toContain('later update');
      expect(help).toContain('<id>');
      expect(help).toContain('--decision');
      expect(help).toContain('--priority');
      expect(help).toContain('--status');
      expect(help).toContain('--add-tags');
      expect(help).toContain('--remove-tags');
    });

    it('should generate delete help', () => {
      const help = HelpGenerator.subcommand('delete');

      expect(help).toContain('later delete');
      expect(help).toContain('<id>');
      expect(help).toContain('--hard');
    });

    it('should generate bulk-update help', () => {
      const help = HelpGenerator.subcommand('bulk-update');

      expect(help).toContain('later bulk-update');
      expect(help).toContain('<ids>');
      expect(help.toLowerCase()).toContain('comma');
    });

    it('should generate bulk-delete help', () => {
      const help = HelpGenerator.subcommand('bulk-delete');

      expect(help).toContain('later bulk-delete');
      expect(help).toContain('<ids>');
      expect(help).toContain('--hard');
    });

    it('should generate search help', () => {
      const help = HelpGenerator.subcommand('search');

      expect(help).toContain('later search');
      expect(help).toContain('<query>');
      expect(help).toContain('--fields');
      expect(help).toContain('--limit');
      expect(help).toContain('--min-score');
    });

    it('should handle unknown command', () => {
      const help = HelpGenerator.subcommand('unknown');
      expect(help).toContain('Unknown command');
    });

    it('should include usage line', () => {
      const help = HelpGenerator.subcommand('capture');
      expect(help).toMatch(/USAGE:[\s\S]*later capture/);
    });

    it('should include argument descriptions for commands with args', () => {
      const help = HelpGenerator.subcommand('show');
      expect(help).toContain('ARGUMENTS:');
      expect(help).toContain('Item ID');
    });

    it('should include examples', () => {
      const help = HelpGenerator.subcommand('capture');
      expect(help).toContain('EXAMPLES:');
      expect(help).toContain('later capture');
    });

    it('should show enum values for enum flags', () => {
      const help = HelpGenerator.subcommand('capture');
      expect(help).toContain('low, medium, high');
    });

    it('should show short flags', () => {
      const help = HelpGenerator.subcommand('capture');
      expect(help).toContain('-c');
      expect(help).toContain('-p');
      expect(help).toContain('-t');
    });
  });

  describe('with colors disabled', () => {
    it('should work without colors', () => {
      ColorSupport.disable();

      const mainHelp = HelpGenerator.main('1.0.0');
      const cmdHelp = HelpGenerator.subcommand('capture');

      expect(mainHelp).toContain('later v1.0.0');
      expect(cmdHelp).toContain('later capture');

      // Should still be readable
      expect(mainHelp.length).toBeGreaterThan(100);
      expect(cmdHelp.length).toBeGreaterThan(100);
    });
  });
});
