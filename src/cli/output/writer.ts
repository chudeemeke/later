/**
 * Output Writer Interface
 *
 * Abstracts stdout/stderr for testability using Dependency Injection.
 * All CLI output should go through this interface, enabling:
 * - Clean test output (mock writers capture instead of pollute)
 * - Consistent formatting
 * - Future enhancements (logging, verbosity levels)
 *
 * @example
 * // Production usage
 * const output = createOutputWriter(process.stdout, process.stderr);
 *
 * // Test usage
 * const mockOutput = createMockOutputWriter();
 * // ... run code ...
 * expect(mockOutput.getOutput()).toContain('expected text');
 */

export interface OutputWriter {
  /** Write to stdout (normal output) */
  write(message: string): void;

  /** Write to stdout with newline */
  writeLine(message: string): void;

  /** Write to stderr (errors) */
  error(message: string): void;

  /** Write to stderr with newline */
  errorLine(message: string): void;

  /** Write empty line to stdout */
  newLine(): void;
}

/**
 * Create a production output writer using real streams
 */
export function createOutputWriter(
  stdout: NodeJS.WriteStream,
  stderr: NodeJS.WriteStream,
): OutputWriter {
  return {
    write(message: string): void {
      stdout.write(message);
    },
    writeLine(message: string): void {
      stdout.write(message + "\n");
    },
    error(message: string): void {
      stderr.write(message);
    },
    errorLine(message: string): void {
      stderr.write(message + "\n");
    },
    newLine(): void {
      stdout.write("\n");
    },
  };
}

/**
 * Mock output writer for testing
 *
 * Captures all output for assertions without polluting test console.
 */
export interface MockOutputWriter extends OutputWriter {
  /** Get all captured stdout output */
  getOutput(): string;

  /** Get all captured stderr output */
  getErrors(): string;

  /** Get output as array of lines */
  getOutputLines(): string[];

  /** Get errors as array of lines */
  getErrorLines(): string[];

  /** Clear captured output */
  clear(): void;
}

/**
 * Create a mock output writer for testing
 */
export function createMockOutputWriter(): MockOutputWriter {
  let output = "";
  let errors = "";

  return {
    write(message: string): void {
      output += message;
    },
    writeLine(message: string): void {
      output += message + "\n";
    },
    error(message: string): void {
      errors += message;
    },
    errorLine(message: string): void {
      errors += message + "\n";
    },
    newLine(): void {
      output += "\n";
    },
    getOutput(): string {
      return output;
    },
    getErrors(): string {
      return errors;
    },
    getOutputLines(): string[] {
      return output.split("\n").filter((line) => line.length > 0);
    },
    getErrorLines(): string[] {
      return errors.split("\n").filter((line) => line.length > 0);
    },
    clear(): void {
      output = "";
      errors = "";
    },
  };
}
