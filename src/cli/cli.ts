#!/usr/bin/env node

import { parseArgs } from './parser.js';
import { McpClient } from './mcp-client.js';
import { handleCapture } from './commands/capture.js';
import { handleList } from './commands/list.js';
import { handleShow } from './commands/show.js';
import { formatError } from './output/formatter.js';

/**
 * Main CLI entry point
 *
 * Phase 1 MVP - Basic command routing with zero business logic
 */
async function main() {
  try {
    // Parse command line arguments (skip node and script path)
    const parsed = parseArgs(process.argv.slice(2));

    // Check for parsing errors
    if (parsed.errors.length > 0) {
      parsed.errors.forEach(error => console.error(formatError(error)));
      process.exit(1);
    }

    // Route to command handler
    let exitCode: number;

    switch (parsed.subcommand) {
      case 'capture': {
        const client = new McpClient();
        exitCode = await handleCapture(parsed.args, client);
        break;
      }

      case 'list': {
        const client = new McpClient();
        exitCode = await handleList(parsed.args, client);
        break;
      }

      case 'show': {
        const client = new McpClient();
        exitCode = await handleShow(parsed.args, client);
        break;
      }

      default:
        console.error(formatError(`Unknown command: ${parsed.subcommand}`));
        exitCode = 1;
    }

    process.exit(exitCode);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(errorMessage));
    process.exit(1);
  }
}

// Run CLI
main();
