/**
 * CLI Orchestration Tests
 *
 * Comprehensive unit tests for the CLI class using Dependency Injection.
 * Tests all command routing, error handling, and output formatting logic.
 *
 * Coverage Target: 100% of cli.ts orchestration logic
 *
 * Design: Uses mock dependencies to test CLI in isolation without process.exit() or real I/O
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CLI, CLIDependencies } from '../../src/cli/cli.js';
import { McpClient } from '../../src/cli/mcp-client.js';

describe('CLI Orchestration', () => {
  let mockStdout: string[];
  let mockStderr: string[];
  let mockMcpClient: any;
  let deps: CLIDependencies;

  beforeEach(() => {
    // Reset mocks
    mockStdout = [];
    mockStderr = [];

    // Create mock MCP client
    mockMcpClient = {
      callTool: jest.fn(),
      getServerVersion: jest.fn(),
      close: jest.fn(),
    };

    // Create mock dependencies
    const stdoutWrite = jest.fn((chunk: string) => {
      mockStdout.push(chunk);
      return true;
    });

    const stderrWrite = jest.fn((chunk: string) => {
      mockStderr.push(chunk);
      return true;
    });

    deps = {
      argv: [],
      stdout: {
        write: stdoutWrite,
      } as any,
      stderr: {
        write: stderrWrite,
      } as any,
      createMcpClient: jest.fn(() => mockMcpClient),
      version: '1.0.0',
    };
  });

  describe('Global Flags', () => {
    describe('--version flag', () => {
      it('should show CLI version', async () => {
        deps.argv = ['--version'];
        mockMcpClient.getServerVersion.mockResolvedValue('1.0.0');

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        expect(mockStdout.join('')).toContain('later CLI v1.0.0');
        expect(mockStdout.join('')).toContain('later MCP Server v1.0.0');
      });

      it('should warn on version mismatch', async () => {
        deps.argv = ['--version'];
        mockMcpClient.getServerVersion.mockResolvedValue('2.0.0');

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        expect(mockStderr.join('')).toContain('Warning');
        expect(mockStderr.join('')).toContain('may not be compatible');
      });

      it('should handle MCP server not responding', async () => {
        deps.argv = ['--version'];
        mockMcpClient.getServerVersion.mockRejectedValue(new Error('Connection failed'));

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        expect(mockStderr.join('')).toContain('not responding');
      });

      it('should show matching versions without warning', async () => {
        deps.argv = ['--version'];
        mockMcpClient.getServerVersion.mockResolvedValue('1.5.0'); // Same major version

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        expect(mockStderr.length).toBe(0); // No warnings
      });
    });

    describe('--help flag', () => {
      it('should show main help when no subcommand', async () => {
        deps.argv = ['--help'];

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        const output = mockStdout.join('');
        expect(output.length).toBeGreaterThan(0); // Ensure something was written
        expect(output).toContain('later');
        expect(output).toContain('capture');
        expect(output).toContain('list');
      });

      it('should show subcommand help when subcommand provided', async () => {
        deps.argv = ['capture', '--help'];

        const cli = new CLI(deps);
        const exitCode = await cli.run();

        expect(exitCode).toBe(0);
        expect(mockStdout.join('')).toContain('capture');
        expect(mockStdout.join('')).toContain('--priority');
      });

      it('should show help for all commands', async () => {
        const commands = ['list', 'show', 'do', 'update', 'delete', 'bulk-update', 'bulk-delete', 'search'];

        for (const cmd of commands) {
          mockStdout = [];
          deps.argv = [cmd, '--help'];

          const cli = new CLI(deps);
          const exitCode = await cli.run();

          expect(exitCode).toBe(0);
          expect(mockStdout.join('')).toContain(cmd);
        }
      });
    });

    describe('--no-color flag', () => {
      it('should disable colors', async () => {
        deps.argv = ['--no-color', 'list'];
        mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

        const cli = new CLI(deps);
        await cli.run();

        // Verify color support was disabled
        // This is tested indirectly through the createMcpClient call
        expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, false);
      });
    });

    describe('--json flag', () => {
      it('should disable spinner for JSON output', async () => {
        deps.argv = ['--json', 'list'];
        mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

        const cli = new CLI(deps);
        await cli.run();

        // Verify spinner was disabled (showSpinner=false)
        expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, false);
      });
    });
  });

  describe('Command Routing', () => {
    it('should route to capture command', async () => {
      deps.argv = ['capture', 'Test decision'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, item_id: 1 });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, true);
    });

    it('should route to list command', async () => {
      deps.argv = ['list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, true);
    });

    it('should route to show command', async () => {
      deps.argv = ['show', '1'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, item: { id: 1 } });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to do command', async () => {
      deps.argv = ['do', '1'];
      mockMcpClient.callTool.mockResolvedValue({ success: true });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to update command', async () => {
      deps.argv = ['update', '1', '--priority', 'high'];
      mockMcpClient.callTool.mockResolvedValue({ success: true });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to delete command', async () => {
      deps.argv = ['delete', '1'];
      mockMcpClient.callTool.mockResolvedValue({ success: true });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to bulk-update command', async () => {
      deps.argv = ['bulk-update', '1,2,3', '--priority', 'high'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, total: 3, succeeded: 3 });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to bulk-delete command', async () => {
      deps.argv = ['bulk-delete', '1,2,3'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, total: 3, succeeded: 3 });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should route to search command', async () => {
      deps.argv = ['search', 'query'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, results: [] });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should handle unknown command', async () => {
      deps.argv = ['unknown-command'];

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      const stderrOutput = mockStderr.join('');

      // Parser adds error for unknown command
      expect(stderrOutput.length).toBeGreaterThan(0);
      expect(stderrOutput).toContain('Unknown');
      expect(stderrOutput).toContain('unknown-command');
      // Help tip is shown, not full help
      expect(stderrOutput).toContain("Run 'later unknown-command --help'");
    });
  });

  describe('Error Handling', () => {
    it('should return USER_ERROR for validation errors', async () => {
      deps.argv = ['capture']; // Missing required argument

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      expect(mockStderr.join('')).toContain('requires 1 argument');
    });

    it('should return USER_ERROR when no subcommand provided', async () => {
      deps.argv = [];

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      // Parser returns error for no subcommand, so error is in stderr
      expect(mockStderr.join('')).toContain('No subcommand provided');
    });

    it('should error when only flags are provided without subcommand', async () => {
      deps.argv = ['--json']; // Only global flags, no subcommand

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      const stderrOutput = mockStderr.join('');
      // Parser will return error for no subcommand
      expect(stderrOutput).toContain('No subcommand provided');
    });

    it('should show help tip for subcommand errors', async () => {
      deps.argv = ['capture']; // Missing argument

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      expect(mockStderr.join('')).toContain("Run 'later capture --help'");
    });

    it('should handle multiple parsing errors', async () => {
      deps.argv = ['capture', 'Decision', '--priority', 'invalid', '--unknown-flag'];

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      expect(mockStderr.join('')).toContain('priority');
    });

    it('should handle unexpected errors gracefully', async () => {
      deps.argv = ['list'];

      // Mock client factory to throw error
      (deps.createMcpClient as any) = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(2);
      expect(mockStderr.join('')).toContain('Unexpected error');
    });

    it('should handle CliError with proper formatting', async () => {
      const { CliError, ExitCode } = await import('../../src/cli/errors.js');

      deps.argv = ['list'];

      // Mock client factory to throw CliError
      (deps.createMcpClient as any) = jest.fn(() => {
        throw new CliError(
          'Test CLI error',
          ExitCode.USER_ERROR,
          'Try running with --help'
        );
      });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1); // USER_ERROR maps to exit code 1
      const stderrOutput = mockStderr.join('');
      expect(stderrOutput).toContain('Test CLI error');
    });
  });

  describe('Output Modes', () => {
    it('should enable spinner for normal output', async () => {
      deps.argv = ['list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      await cli.run();

      // Verify spinner was enabled (showSpinner=true)
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, true);
    });

    it('should disable spinner for --json output', async () => {
      deps.argv = ['--json', 'list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      await cli.run();

      // Verify spinner was disabled
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, false);
    });

    it('should disable spinner for --no-color output', async () => {
      deps.argv = ['--no-color', 'list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      await cli.run();

      // Verify spinner was disabled
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, false);
    });

    it('should disable spinner for both --json and --no-color', async () => {
      deps.argv = ['--json', '--no-color', 'list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      await cli.run();

      // Verify spinner was disabled
      expect(deps.createMcpClient).toHaveBeenCalledWith(undefined, 5000, false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle flags before subcommand', async () => {
      deps.argv = ['--json', '--no-color', 'list'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, items: [] });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should handle empty argv', async () => {
      deps.argv = [];

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(1);
      // Parser returns error for no subcommand
      expect(mockStderr.join('')).toContain('No subcommand provided');
    });

    it('should handle long decision text', async () => {
      const longText = 'A'.repeat(1000);
      deps.argv = ['capture', longText];
      mockMcpClient.callTool.mockResolvedValue({ success: true, item_id: 1 });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should handle unicode in arguments', async () => {
      deps.argv = ['capture', '決定 🚀 with émojis'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, item_id: 1 });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });

    it('should handle negative numbers as arguments', async () => {
      deps.argv = ['show', '-1'];
      mockMcpClient.callTool.mockResolvedValue({ success: true, item: { id: -1 } });

      const cli = new CLI(deps);
      const exitCode = await cli.run();

      expect(exitCode).toBe(0);
    });
  });

  describe('Integration with createProductionCLI', () => {
    it('should create CLI with production dependencies', async () => {
      // This test imports and calls the factory function
      const module = await import('../../src/cli/cli.js');
      const cli = module.createProductionCLI();

      // Verify it has the run method
      expect(typeof cli.run).toBe('function');

      // Verify it's an instance of the module's CLI class
      expect(cli).toBeInstanceOf(module.CLI);
    });
  });
});
