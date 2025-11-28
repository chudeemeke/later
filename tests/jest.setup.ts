/**
 * Jest setup file - runs before all tests
 *
 * Sets log level to "silent" to suppress all logger output during tests.
 * This keeps test output clean while:
 *
 * 1. Logger code still executes (coverage maintained)
 * 2. Error handling logic still runs (functions return proper error responses)
 * 3. Actual Jest errors still show (console.error from Jest itself is unaffected)
 * 4. Only our structured JSON logger output is suppressed
 *
 * The MCP server logs to stderr (required by MCP protocol), which Jest
 * captures and displays. Many tests intentionally trigger error conditions
 * (validation failures, item not found, etc.), so these logs are expected
 * but clutter the output.
 *
 * IMPORTANT: This doesn't hide real bugs - if a test fails due to an actual
 * error, Jest will still show the failure. We only suppress the expected
 * log output from our logger when testing error handling paths.
 */
import { setLogLevel } from "../src/utils/logger.js";

// Suppress ALL logger output during tests
// The "silent" level is higher than "error", so nothing is logged
// But the logging code still executes (for coverage) and error handling still works
setLogLevel("silent");
