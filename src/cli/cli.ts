import { parseArgs, ParsedArgs } from './parser.js';
import { McpClient } from './mcp-client.js';
import { handleCapture } from './commands/capture.js';
import { handleList } from './commands/list.js';
import { handleShow } from './commands/show.js';
import { handleDo } from './commands/do.js';
import { handleUpdate } from './commands/update.js';
import { handleDelete } from './commands/delete.js';
import { handleBulkUpdate } from './commands/bulk-update.js';
import { handleBulkDelete } from './commands/bulk-delete.js';
import { handleSearch } from './commands/search.js';
import { formatError } from './output/formatter.js';
import { ColorSupport } from './output/table-formatter.js';
import { HelpGenerator } from './help.js';
import { ErrorFormatter, CliError } from './errors.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version || '1.0.0';

/**
 * CLI Dependencies interface for testability (Dependency Injection pattern)
 *
 * This allows the CLI to be fully testable by injecting mock dependencies
 * during testing while using real implementations in production.
 */
export interface CLIDependencies {
  /** Command line arguments (e.g., process.argv.slice(2)) */
  argv: string[];

  /** Standard output stream (e.g., process.stdout) */
  stdout: NodeJS.WriteStream;

  /** Standard error stream (e.g., process.stderr) */
  stderr: NodeJS.WriteStream;

  /** Factory function to create MCP clients */
  createMcpClient: (dataDir?: string, timeout?: number, showSpinner?: boolean) => McpClient;

  /** CLI version string */
  version: string;
}

/**
 * CLI Orchestration Class
 *
 * Implements the Dependency Injection pattern for full testability.
 * All I/O and side effects are injected via CLIDependencies interface.
 *
 * Design Pattern: Dependency Injection + Factory Pattern
 * Architecture: Testable, maintainable, follows SOLID principles
 *
 * Phase 3 Enhancement: Refactored for 100% test coverage
 */
export class CLI {
  constructor(private deps: CLIDependencies) {}

  /**
   * Main CLI execution method
   *
   * Returns exit code instead of calling process.exit() for testability:
   * - 0: Success
   * - 1: User error (invalid input, validation failure)
   * - 2: System error (unexpected exception, MCP failure)
   *
   * @returns Promise<number> Exit code
   */
  async run(): Promise<number> {
    try {
      // Parse command line arguments
      const parsed = parseArgs(this.deps.argv);

      // Handle --no-color flag
      if (parsed.globalFlags?.noColor) {
        ColorSupport.disable();
      }

      // Handle global flags
      if (parsed.globalFlags?.version) {
        return await this.handleVersion();
      }

      if (parsed.globalFlags?.help && !parsed.subcommand) {
        return this.handleMainHelp();
      }

      // Handle subcommand help
      if (parsed.globalFlags?.help && parsed.subcommand) {
        return this.handleSubcommandHelp(parsed.subcommand);
      }

      // Check for parsing errors
      if (parsed.errors.length > 0) {
        return this.handleParsingErrors(parsed);
      }

      // Require a subcommand
      /* istanbul ignore if - parser catches missing subcommand first */
      if (!parsed.subcommand) {
        this.deps.stdout.write(HelpGenerator.main(this.deps.version) + '\n');
        return 1;
      }

      // Execute command
      return await this.executeCommand(parsed);
    } catch (error) {
      return this.handleUnexpectedError(error);
    }
  }

  /**
   * Handle --version flag
   * Shows CLI and MCP server versions with compatibility check
   */
  private async handleVersion(): Promise<number> {
    this.deps.stdout.write(`later CLI v${this.deps.version}\n`);

    try {
      const client = this.deps.createMcpClient(undefined, 5000, false);
      const serverVersion = await client.getServerVersion();
      this.deps.stdout.write(`later MCP Server v${serverVersion}\n`);

      if (!McpClient.isVersionCompatible(this.deps.version, serverVersion)) {
        this.deps.stderr.write(
          `\nWarning: CLI version (${this.deps.version}) may not be compatible with server version (${serverVersion})\n`
        );
      }
    } catch (error) {
      this.deps.stderr.write('\nMCP server not responding. Ensure the server is installed correctly.\n');
    }

    return 0;
  }

  /**
   * Handle main help (no subcommand)
   */
  private handleMainHelp(): number {
    this.deps.stdout.write(HelpGenerator.main(this.deps.version) + '\n');
    return 0;
  }

  /**
   * Handle subcommand help
   */
  private handleSubcommandHelp(subcommand: string): number {
    this.deps.stdout.write(HelpGenerator.subcommand(subcommand) + '\n');
    return 0;
  }

  /**
   * Handle parsing errors
   */
  private handleParsingErrors(parsed: ParsedArgs): number {
    parsed.errors.forEach(error => this.deps.stderr.write(formatError(error) + '\n'));
    if (parsed.subcommand) {
      this.deps.stderr.write(`\nRun 'later ${parsed.subcommand} --help' for usage information.\n`);
    }
    return 1;
  }

  /**
   * Execute the parsed command
   */
  private async executeCommand(parsed: ParsedArgs): Promise<number> {
    // Determine whether to show spinner
    const showSpinner = !parsed.globalFlags?.json && !parsed.globalFlags?.noColor;

    // Route to appropriate command handler
    switch (parsed.subcommand) {
      case 'capture': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleCapture(parsed, client);
      }

      case 'list': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleList(parsed, client);
      }

      case 'show': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleShow(parsed, client);
      }

      case 'do': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleDo(parsed.args, client);
      }

      case 'update': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleUpdate(parsed, client);
      }

      case 'delete': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleDelete(parsed, client);
      }

      case 'bulk-update': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleBulkUpdate(parsed, client);
      }

      case 'bulk-delete': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleBulkDelete(parsed, client);
      }

      case 'search': {
        const client = this.deps.createMcpClient(undefined, 5000, showSpinner);
        return await handleSearch(parsed, client);
      }

      /* istanbul ignore next - parser validates commands first, this is defensive */
      default:
        this.deps.stderr.write(formatError(`Unknown command: ${parsed.subcommand}`) + '\n');
        this.deps.stdout.write('\n' + HelpGenerator.main(this.deps.version) + '\n');
        return 1;
    }
  }

  /**
   * Handle unexpected errors
   */
  private handleUnexpectedError(error: unknown): number {
    // Handle CLI errors with proper formatting
    if (error instanceof CliError) {
      const formatted = ErrorFormatter.format(error);
      this.deps.stderr.write(formatted + '\n');
      return ErrorFormatter.getExitCode(error);
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.deps.stderr.write(formatError(errorMessage) + '\n');
    return 2;
  }
}

/**
 * Create CLI instance with production dependencies
 * Used by bin/later entry point
 */
export function createProductionCLI(): CLI {
  return new CLI({
    argv: process.argv.slice(2),
    stdout: process.stdout,
    stderr: process.stderr,
    createMcpClient: (dataDir, timeout, showSpinner) =>
      new McpClient(undefined, dataDir, timeout, showSpinner),
    version: VERSION,
  });
}
