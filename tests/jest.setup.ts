/**
 * Jest setup file - runs before all tests
 *
 * Suppresses info-level logging during tests to keep output clean.
 * The MCP server logs to stderr (required by MCP protocol), which Jest
 * captures and displays as warnings. This clutters test output without
 * adding value since these are expected log messages, not actual warnings.
 */
import { setLogLevel } from "../src/utils/logger.js";

// Suppress info/debug logs during tests - only show warnings and errors
// This keeps test output clean while still showing important messages
setLogLevel("warn");
