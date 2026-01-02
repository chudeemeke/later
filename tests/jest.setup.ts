/**
 * Jest Global Setup for Clean Test Output
 *
 * This file configures the test environment for clean output:
 *
 * 1. Logger Suppression:
 *    - Sets log level to "silent" to suppress structured JSON logger output
 *    - Logger code still executes (coverage maintained)
 *    - Error handling logic still runs (functions return proper error responses)
 *
 * 2. Console Suppression:
 *    - Mocks console.log/error/warn/info/debug globally
 *    - Prevents "expected" error messages from cluttering test output
 *    - Tests using OutputWriter DI don't pollute console
 *
 * IMPORTANT: This doesn't hide real bugs - if a test fails due to an actual
 * error, Jest will still show the failure. We only suppress the expected
 * output from our logger and console when testing error handling paths.
 *
 * Design Pattern: Global Test Configuration + Dependency Injection
 * Purpose: Clean test output - only show failures, not expected outputs
 *
 * @see src/cli/output/writer.ts for OutputWriter DI pattern
 * @see ai-dev-environment/templates for reusable template
 */
import { jest, beforeAll, afterAll } from "@jest/globals";
import { setLogLevel } from "../src/utils/logger.js";

// Suppress ALL logger output during tests
// The "silent" level is higher than "error", so nothing is logged
// But the logging code still executes (for coverage) and error handling still works
setLogLevel("silent");

// Store original console methods for restoration if needed
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Suppress console output during tests globally
// This prevents "expected" error messages from cluttering test output
// With OutputWriter DI pattern, tests use MockOutputWriter instead of console
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
});

// Restore console after all tests complete
afterAll(() => {
  jest.restoreAllMocks();
});

// Export original console for tests that need to verify console output
// (though with OutputWriter DI, this should rarely be needed)
export { originalConsole };
