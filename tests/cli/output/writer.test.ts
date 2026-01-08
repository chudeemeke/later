/**
 * Output Writer Tests
 *
 * Tests for the output writer abstraction used for CLI output.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createOutputWriter,
  createMockOutputWriter,
  type OutputWriter,
  type MockOutputWriter,
} from '../../../src/cli/output/writer.js';

describe('Output Writer', () => {
  describe('createMockOutputWriter', () => {
    let mockWriter: MockOutputWriter;

    beforeEach(() => {
      mockWriter = createMockOutputWriter();
    });

    it('should capture write() output', () => {
      mockWriter.write('Hello');
      mockWriter.write(' World');

      expect(mockWriter.getOutput()).toBe('Hello World');
    });

    it('should capture writeLine() output with newline', () => {
      mockWriter.writeLine('Line 1');
      mockWriter.writeLine('Line 2');

      expect(mockWriter.getOutput()).toBe('Line 1\nLine 2\n');
    });

    it('should capture error() output', () => {
      mockWriter.error('Error 1');
      mockWriter.error(' Error 2');

      expect(mockWriter.getErrors()).toBe('Error 1 Error 2');
    });

    it('should capture errorLine() output with newline', () => {
      mockWriter.errorLine('Error line 1');
      mockWriter.errorLine('Error line 2');

      expect(mockWriter.getErrors()).toBe('Error line 1\nError line 2\n');
    });

    it('should add newline with newLine()', () => {
      mockWriter.write('Before');
      mockWriter.newLine();
      mockWriter.write('After');

      expect(mockWriter.getOutput()).toBe('Before\nAfter');
    });

    it('should return output lines array', () => {
      mockWriter.writeLine('Line 1');
      mockWriter.writeLine('Line 2');
      mockWriter.writeLine('Line 3');

      expect(mockWriter.getOutputLines()).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines in getOutputLines()', () => {
      mockWriter.writeLine('Line 1');
      mockWriter.newLine();
      mockWriter.writeLine('Line 2');

      const lines = mockWriter.getOutputLines();
      expect(lines).toEqual(['Line 1', 'Line 2']);
    });

    it('should return error lines array', () => {
      mockWriter.errorLine('Error 1');
      mockWriter.errorLine('Error 2');

      expect(mockWriter.getErrorLines()).toEqual(['Error 1', 'Error 2']);
    });

    it('should filter empty error lines in getErrorLines()', () => {
      mockWriter.errorLine('Error 1');
      mockWriter.error('\n');
      mockWriter.errorLine('Error 2');

      const lines = mockWriter.getErrorLines();
      // Note: error() doesn't add newline, so '\n' will create empty entries
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('Error 1');
      expect(lines[1]).toBe('Error 2');
    });

    it('should clear all output', () => {
      mockWriter.writeLine('Output');
      mockWriter.errorLine('Error');

      mockWriter.clear();

      expect(mockWriter.getOutput()).toBe('');
      expect(mockWriter.getErrors()).toBe('');
    });

    it('should separate stdout and stderr', () => {
      mockWriter.writeLine('Standard output');
      mockWriter.errorLine('Standard error');

      expect(mockWriter.getOutput()).toBe('Standard output\n');
      expect(mockWriter.getErrors()).toBe('Standard error\n');
    });
  });

  describe('createOutputWriter', () => {
    it('should create writer with stdout and stderr streams', () => {
      const stdoutWrites: string[] = [];
      const stderrWrites: string[] = [];

      const mockStdout = {
        write: (msg: string) => {
          stdoutWrites.push(msg);
          return true;
        },
      } as NodeJS.WriteStream;

      const mockStderr = {
        write: (msg: string) => {
          stderrWrites.push(msg);
          return true;
        },
      } as NodeJS.WriteStream;

      const writer = createOutputWriter(mockStdout, mockStderr);

      writer.write('Hello');
      expect(stdoutWrites).toEqual(['Hello']);

      writer.writeLine('World');
      expect(stdoutWrites).toEqual(['Hello', 'World\n']);

      writer.error('Err');
      expect(stderrWrites).toEqual(['Err']);

      writer.errorLine('Error line');
      expect(stderrWrites).toEqual(['Err', 'Error line\n']);

      writer.newLine();
      expect(stdoutWrites).toEqual(['Hello', 'World\n', '\n']);
    });
  });

  describe('OutputWriter interface compliance', () => {
    it('should implement write method', () => {
      const writer: OutputWriter = createMockOutputWriter();
      expect(typeof writer.write).toBe('function');
    });

    it('should implement writeLine method', () => {
      const writer: OutputWriter = createMockOutputWriter();
      expect(typeof writer.writeLine).toBe('function');
    });

    it('should implement error method', () => {
      const writer: OutputWriter = createMockOutputWriter();
      expect(typeof writer.error).toBe('function');
    });

    it('should implement errorLine method', () => {
      const writer: OutputWriter = createMockOutputWriter();
      expect(typeof writer.errorLine).toBe('function');
    });

    it('should implement newLine method', () => {
      const writer: OutputWriter = createMockOutputWriter();
      expect(typeof writer.newLine).toBe('function');
    });
  });
});
