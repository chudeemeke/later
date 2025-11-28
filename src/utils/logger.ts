/**
 * Structured logger utility for /later MCP server
 * Provides hierarchical log levels with JSON-formatted output
 *
 * CRITICAL MCP REQUIREMENT: All output goes to stderr, NEVER stdout
 * stdout is reserved exclusively for MCP protocol messages
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

interface LogContext {
  [key: string]: any;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4, // Higher than error - suppresses ALL log output
};

let currentLogLevel: LogLevel = "info";

/**
 * Set global log level
 * @param level - Minimum log level to output
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Safe JSON stringifier that handles circular references
 */
function safeStringify(obj: any): string {
  const seen = new WeakSet();

  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  });
}

/**
 * Format log entry as structured JSON
 */
function formatLogEntry(
  level: LogLevel,
  namespace: string,
  message: string,
  context?: LogContext,
): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    namespace,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };

  try {
    return safeStringify(entry);
  } catch (error) {
    // Fallback if JSON stringification fails
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      namespace,
      message,
      error: "Failed to stringify context",
    });
  }
}

/**
 * Check if message should be logged based on current log level
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

/**
 * Create a namespaced logger instance
 *
 * CRITICAL: All log output goes to stderr to avoid interfering with MCP protocol.
 * stdout is reserved exclusively for JSON-RPC messages.
 *
 * @param namespace - Logger namespace (e.g., 'later:storage', 'later:tools')
 * @returns Logger instance with debug, info, warn, error methods
 *
 * @example
 * const log = createLogger('later:update');
 * log.info('update_success', { id: 123, duration_ms: 45 });
 * log.error('update_failed', { id: 123, error: 'Item not found' });
 */
export function createLogger(namespace: string): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog("debug")) {
        const formatted = formatLogEntry("debug", namespace, message, context);
        // CRITICAL: Use stderr for ALL log levels in MCP servers
        console.error(formatted);
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog("info")) {
        const formatted = formatLogEntry("info", namespace, message, context);
        // CRITICAL: Use stderr for ALL log levels in MCP servers
        console.error(formatted);
      }
    },

    warn(message: string, context?: LogContext): void {
      if (shouldLog("warn")) {
        const formatted = formatLogEntry("warn", namespace, message, context);
        console.error(formatted);
      }
    },

    error(message: string, context?: LogContext): void {
      if (shouldLog("error")) {
        const formatted = formatLogEntry("error", namespace, message, context);
        console.error(formatted);
      }
    },
  };
}

/**
 * Default logger for general use
 */
export const defaultLogger = createLogger("later");
