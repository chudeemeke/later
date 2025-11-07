#!/usr/bin/env node

import { parseArgs } from './parser.js';
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
import { HelpGenerator } from './help.js';
import { ErrorFormatter, CliError, UserError } from './errors.js';
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
 * Main CLI entry point
 *
 * Phase 2 - Full command support with help system and error handling
 */
async function main() {
  try {
    // Parse command line arguments (skip node and script path)
    const parsed = parseArgs(process.argv.slice(2));

    // Handle global flags
    if (parsed.globalFlags?.version) {
      console.log(`later v${VERSION}`);
      // TODO: Add MCP server version check
      process.exit(0);
    }

    if (parsed.globalFlags?.help && !parsed.subcommand) {
      console.log(HelpGenerator.main(VERSION));
      process.exit(0);
    }

    // Handle subcommand help
    if (parsed.globalFlags?.help && parsed.subcommand) {
      console.log(HelpGenerator.subcommand(parsed.subcommand));
      process.exit(0);
    }

    // Check for parsing errors
    if (parsed.errors.length > 0) {
      parsed.errors.forEach(error => console.error(formatError(error)));
      if (parsed.subcommand) {
        console.error(`\nRun 'later ${parsed.subcommand} --help' for usage information.`);
      }
      process.exit(1);
    }

    // Require a subcommand
    if (!parsed.subcommand) {
      console.log(HelpGenerator.main(VERSION));
      process.exit(1);
    }

    // Route to command handler with full parsed object
    let exitCode: number;

    switch (parsed.subcommand) {
      case 'capture': {
        const client = new McpClient();
        exitCode = await handleCapture(parsed, client);
        break;
      }

      case 'list': {
        const client = new McpClient();
        exitCode = await handleList(parsed, client);
        break;
      }

      case 'show': {
        const client = new McpClient();
        exitCode = await handleShow(parsed, client);
        break;
      }

      case 'do': {
        const client = new McpClient();
        exitCode = await handleDo(parsed.args, client);
        break;
      }

      case 'update': {
        const client = new McpClient();
        exitCode = await handleUpdate(parsed, client);
        break;
      }

      case 'delete': {
        const client = new McpClient();
        exitCode = await handleDelete(parsed, client);
        break;
      }

      case 'bulk-update': {
        const client = new McpClient();
        exitCode = await handleBulkUpdate(parsed, client);
        break;
      }

      case 'bulk-delete': {
        const client = new McpClient();
        exitCode = await handleBulkDelete(parsed, client);
        break;
      }

      case 'search': {
        const client = new McpClient();
        exitCode = await handleSearch(parsed, client);
        break;
      }

      default:
        console.error(formatError(`Unknown command: ${parsed.subcommand}`));
        console.log('\n' + HelpGenerator.main(VERSION));
        exitCode = 1;
    }

    process.exit(exitCode);
  } catch (error) {
    // Handle CLI errors with proper formatting
    if (error instanceof CliError) {
      const formatted = ErrorFormatter.format(error);
      console.error(formatted);
      process.exit(ErrorFormatter.getExitCode(error));
    }

    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    process.exit(2);
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error(formatError(`Uncaught exception: ${error.message}`));
  process.exit(2);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(formatError(`Unhandled rejection: ${message}`));
  process.exit(2);
});

// Run CLI
main();
