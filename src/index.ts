#!/usr/bin/env node

/**
 * Later MCP Server V2.0
 * Token-Efficient Progressive Disclosure Architecture
 *
 * MCP 2025-06 Specification Compliant:
 * - Progressive tool disclosure (90% token reduction)
 * - Automatic PII tokenization (95%+ detection)
 * - On-demand tool loading
 * - Structured error responses with isError pattern
 * - Graceful shutdown handling
 * - All logging to stderr (stdout reserved for protocol)
 * - Backward compatible with V1.0.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getStorage, closeStorage } from "./storage/jsonl.js";
import { toolRegistry } from "./registry.js";
import { createLogger, setLogLevel, LogLevel } from "./utils/logger.js";

// Import and register all tools
import "./tools/meta/index.js"; // search_tools (always visible)
import "./tools/core/index.js"; // capture, list, show
import "./tools/workflow/index.js"; // do, update, delete
import "./tools/batch/index.js"; // bulk_update, bulk_delete
import "./tools/search/index.js"; // search

// Configure log level from environment (CLI sets LATER_LOG_LEVEL=silent)
const envLogLevel = process.env.LATER_LOG_LEVEL as LogLevel | undefined;
if (
  envLogLevel &&
  ["debug", "info", "warn", "error", "silent"].includes(envLogLevel)
) {
  setLogLevel(envLogLevel);
}

const log = createLogger("later:server");

// Initialize storage
const storage = getStorage();

// Server instance (module-level for graceful shutdown)
let isShuttingDown = false;

// Create MCP server
const server = new Server(
  {
    name: "later",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * V2.0: Progressive Disclosure
 * Only expose search_tools initially, reducing token overhead by 90%
 * Other tools are discovered on-demand via search_tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return only search_tools for progressive disclosure
  const searchTool = toolRegistry.get("search_tools");

  if (!searchTool) {
    log.error("search_tools_not_found", {
      message: "Critical: search_tools not in registry",
    });
    throw new Error("search_tools not found in registry");
  }

  return {
    tools: [
      {
        name: searchTool.name,
        description: searchTool.description,
        inputSchema: searchTool.inputSchema,
      },
    ],
  };
});

/**
 * V2.0: Dynamic Tool Execution with MCP-compliant error handling
 *
 * Following MCP best practices:
 * - Return { isError: true, content: [...] } instead of throwing
 * - Structured error responses help LLMs understand failures
 * - Enables retry logic and maintains connection stability
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Get tool from registry
  const tool = toolRegistry.get(name);

  if (!tool) {
    log.warn("tool_not_found", { tool: name });
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "TOOL_NOT_FOUND",
              message: `Tool '${name}' not found. Use search_tools to discover available tools.`,
              available_tools: toolRegistry.getAll().map((t) => t.name),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  try {
    // Execute tool handler
    const result = await tool.handler(args, storage);

    // Format response with structured content
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("tool_execution_error", { tool: name, error: errorMessage });

    // Return structured error per MCP guidelines (isError: true)
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "TOOL_EXECUTION_ERROR",
              tool: name,
              message: errorMessage,
              hint: "Check the tool arguments and try again. Use search_tools for help.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }
});

/**
 * Graceful shutdown handler
 * Per MCP best practices:
 * 1. Stop accepting new requests
 * 2. Complete in-flight requests
 * 3. Close resources
 * 4. Exit cleanly
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.warn("shutdown_already_in_progress", { signal });
    return;
  }

  isShuttingDown = true;
  log.info("shutdown_initiated", { signal });

  try {
    // Close server connection
    if (server) {
      await server.close();
    }

    // Close storage (release file locks)
    await closeStorage();

    log.info("shutdown_complete", { signal });
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("shutdown_error", { signal, error: errorMessage });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log.error("uncaught_exception", { error: error.message, stack: error.stack });
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log.error("unhandled_rejection", { reason: message });
  gracefulShutdown("unhandledRejection");
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol)
  log.info("server_started", {
    version: "2.0.0",
    tools_registered: toolRegistry.getAll().length,
    features: [
      "progressive_disclosure",
      "pii_tokenization",
      "graceful_shutdown",
    ],
  });
}

main().catch((error) => {
  log.error("fatal_error", { error: error.message });
  process.exit(1);
});
