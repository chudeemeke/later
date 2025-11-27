import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createLogger, setLogLevel, LogLevel } from '../../src/utils/logger.js';

describe('Logger Utility', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset log level to default
    setLogLevel('info');
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('createLogger', () => {
    it('should create logger with namespace', () => {
      const log = createLogger('test:namespace');
      expect(log).toBeDefined();
      expect(typeof log.info).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.debug).toBe('function');
    });

    it('should include namespace in log output', () => {
      const log = createLogger('test:app');
      log.info('test_message', { data: 'value' });

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('test:app');
    });
  });

  describe('info logging', () => {
    it('should log info messages', () => {
      const log = createLogger('test');
      log.info('operation_success', { id: 123 });

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include structured data in info logs', () => {
      const log = createLogger('test');
      log.info('user_action', { userId: 'abc', action: 'create' });

      // MCP compliance: all logging goes to stderr (console.error)
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('abc');
    });

    it('should include timestamp in info logs', () => {
      const log = createLogger('test');
      log.info('timestamp_test');

      // MCP compliance: all logging goes to stderr (console.error)
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('error logging', () => {
    it('should log error messages', () => {
      const log = createLogger('test');
      log.error('operation_failed', { error: 'Something went wrong' });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include error details in structured format', () => {
      const log = createLogger('test');
      const error = new Error('Test error');
      log.error('error_occurred', { error: error.message, stack: error.stack });

      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('error_occurred');
      expect(logOutput).toContain('Test error');
    });

    it('should log at error level even when log level is warn', () => {
      setLogLevel('warn');
      const log = createLogger('test');
      log.error('critical_error');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('warn logging', () => {
    it('should log warning messages', () => {
      const log = createLogger('test');
      log.warn('potential_issue', { severity: 'medium' });

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include context in warnings', () => {
      const log = createLogger('test');
      log.warn('deprecated_api', { api: 'oldMethod', replacement: 'newMethod' });

      // MCP compliance: all logging goes to stderr (console.error)
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('oldMethod');
      expect(logOutput).toContain('newMethod');
    });
  });

  describe('debug logging', () => {
    it('should not log debug messages by default (info level)', () => {
      setLogLevel('info');
      const log = createLogger('test');
      log.debug('debug_info', { details: 'verbose' });

      // Debug should not be called at info level
      // Note: debug also uses stderr for MCP compliance
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when log level is debug', () => {
      setLogLevel('debug');
      const log = createLogger('test');
      log.debug('debug_info', { details: 'verbose' });

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include detailed context in debug logs', () => {
      setLogLevel('debug');
      const log = createLogger('test');
      log.debug('function_entry', { function: 'handleUpdate', args: { id: 1 } });

      // MCP compliance: all logging goes to stderr (console.error)
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('function_entry');
      expect(logOutput).toContain('handleUpdate');
    });
  });

  describe('log levels', () => {
    it('should respect error log level (only errors)', () => {
      setLogLevel('error');
      const log = createLogger('test');

      log.debug('debug_msg');
      log.info('info_msg');
      log.warn('warn_msg');
      log.error('error_msg');

      // MCP compliance: all logging goes to stderr (console.error)
      // At error level, only error messages are logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect warn log level (warn and error)', () => {
      setLogLevel('warn');
      const log = createLogger('test');

      log.debug('debug_msg');
      log.info('info_msg');
      log.warn('warn_msg');
      log.error('error_msg');

      // MCP compliance: all logging goes to stderr (console.error)
      // At warn level, warn + error messages are logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should respect info log level (info, warn, error)', () => {
      setLogLevel('info');
      const log = createLogger('test');

      log.debug('debug_msg');
      log.info('info_msg');
      log.warn('warn_msg');
      log.error('error_msg');

      // MCP compliance: all logging goes to stderr (console.error)
      // At info level, info + warn + error messages are logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('should respect debug log level (all messages)', () => {
      setLogLevel('debug');
      const log = createLogger('test');

      log.debug('debug_msg');
      log.info('info_msg');
      log.warn('warn_msg');
      log.error('error_msg');

      // MCP compliance: all logging goes to stderr (console.error)
      // At debug level, all messages are logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('performance', () => {
    it('should not block when logging', () => {
      const log = createLogger('test');
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        log.info('performance_test', { iteration: i });
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('edge cases', () => {
    it('should handle logging without context', () => {
      const log = createLogger('test');
      log.info('simple_message');

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle logging with null context', () => {
      const log = createLogger('test');
      log.info('null_context', null as any);

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle logging with undefined context', () => {
      const log = createLogger('test');
      log.info('undefined_context', undefined as any);

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle logging circular references', () => {
      const log = createLogger('test');
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        log.info('circular_test', circular);
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const log = createLogger('test');
      const longMessage = 'a'.repeat(10000);

      expect(() => {
        log.info('long_message', { data: longMessage });
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const log = createLogger('test');
      log.info('special_chars', { message: 'Test\n\t\r"quotes"\'apostrophes\'' });

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('multiple loggers', () => {
    it('should support multiple logger instances with different namespaces', () => {
      const log1 = createLogger('module:storage');
      const log2 = createLogger('module:tools');

      log1.info('storage_operation');
      log2.info('tool_execution');

      // MCP compliance: all logging goes to stderr (console.error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      const log1Output = consoleErrorSpy.mock.calls[0][0] as string;
      const log2Output = consoleErrorSpy.mock.calls[1][0] as string;

      expect(log1Output).toContain('module:storage');
      expect(log2Output).toContain('module:tools');
    });
  });
});
