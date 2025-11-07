import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

// Use a unique temp directory for each test run
const TEST_BASE_DIR = path.join('/tmp', `later-cli-test-${Date.now()}`);
const TEST_DATA_DIR = path.join(TEST_BASE_DIR, '.later');
const CLI_PATH = path.join(process.cwd(), 'bin', 'later');

describe('CLI Integration Tests', () => {
  beforeEach(async () => {
    // Clean and create test directories
    await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_BASE_DIR, { recursive: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup after tests
    await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
  });

  describe('capture command', () => {
    it('should capture a decision successfully', async () => {
      const { stdout, stderr } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Integration test decision"`
      );

      expect(stdout).toContain('Captured as item');
      expect(stdout).toMatch(/#\d+/);
      expect(stderr).toContain('Later MCP server running');
    }, 15000);

    it('should show error when decision is missing', async () => {
      try {
        await execAsync(`HOME=${TEST_BASE_DIR} ${CLI_PATH} capture`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
        expect(error.stdout || error.stderr).toContain('Decision text is required');
      }
    }, 15000);

    it('should handle decisions with special characters', async () => {
      const { stdout } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Test with \\"quotes\\" and symbols!@#"`
      );

      expect(stdout).toContain('Captured as item');
    }, 15000);
  });

  describe('list command', () => {
    it('should list items successfully', async () => {
      // First create an item
      await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "List test item"`
      );

      // Then list
      const { stdout } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} list`
      );

      expect(stdout).toContain('Found');
      expect(stdout).toContain('item(s)');
      expect(stdout).toContain('List test item');
    }, 20000);

    it('should show "No items found" for empty list', async () => {
      const { stdout } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} list`
      );

      expect(stdout).toContain('No items found');
    }, 15000);

    it('should display multiple items', async () => {
      // Create multiple items
      await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "First item"`
      );
      await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Second item"`
      );
      await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Third item"`
      );

      const { stdout } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} list`
      );

      expect(stdout).toContain('Found 3 item(s)');
      expect(stdout).toContain('First item');
      expect(stdout).toContain('Second item');
      expect(stdout).toContain('Third item');
    }, 25000);
  });

  describe('show command', () => {
    it('should show item details successfully', async () => {
      // Create an item
      const { stdout: captureOut } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Show test item"`
      );

      // Extract ID from capture output
      const match = captureOut.match(/#(\d+)/);
      expect(match).not.toBeNull();
      const id = match![1];

      // Show the item
      const { stdout } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} show ${id}`
      );

      expect(stdout).toContain(`Item #${id}`);
      expect(stdout).toContain('Decision: Show test item');
      expect(stdout).toContain('Status: pending');
      expect(stdout).toContain('Priority: medium');
      expect(stdout).toContain('Created:');
    }, 20000);

    it('should show error for non-existent item', async () => {
      try {
        await execAsync(
          `HOME=${TEST_BASE_DIR} ${CLI_PATH} show 99999`
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
      }
    }, 15000);

    it('should show error for invalid ID', async () => {
      try {
        await execAsync(
          `HOME=${TEST_BASE_DIR} ${CLI_PATH} show abc`
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
        expect(error.stdout || error.stderr).toContain('Invalid ID');
      }
    }, 15000);

    it('should show error when ID is missing', async () => {
      try {
        await execAsync(
          `HOME=${TEST_BASE_DIR} ${CLI_PATH} show`
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
        expect(error.stdout || error.stderr).toContain('Item ID is required');
      }
    }, 15000);
  });

  describe('error handling', () => {
    it('should handle invalid subcommand', async () => {
      try {
        await execAsync(
          `HOME=${TEST_BASE_DIR} ${CLI_PATH} invalid`
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
        expect(error.stdout || error.stderr).toContain('Unknown subcommand');
      }
    }, 15000);

    it('should handle no subcommand', async () => {
      try {
        await execAsync(
          `HOME=${TEST_BASE_DIR} ${CLI_PATH}`
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain('Error');
        expect(error.stdout || error.stderr).toContain('No subcommand provided');
      }
    }, 15000);
  });

  describe('end-to-end workflow', () => {
    it('should support complete capture->list->show workflow', async () => {
      // 1. Capture an item
      const { stdout: captureOut } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "E2E test workflow"`
      );

      expect(captureOut).toContain('Captured as item');
      const match = captureOut.match(/#(\d+)/);
      const id = match![1];

      // 2. List items
      const { stdout: listOut } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} list`
      );

      expect(listOut).toContain('E2E test workflow');
      expect(listOut).toContain(`#${id}`);

      // 3. Show specific item
      const { stdout: showOut } = await execAsync(
        `HOME=${TEST_BASE_DIR} ${CLI_PATH} show ${id}`
      );

      expect(showOut).toContain(`Item #${id}`);
      expect(showOut).toContain('E2E test workflow');
      expect(showOut).toContain('Status: pending');
    }, 30000);
  });
});
