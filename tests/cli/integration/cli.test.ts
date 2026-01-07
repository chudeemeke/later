import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Cross-platform exec with environment variables
// Uses exec options.env instead of Unix shell syntax (HOME=value cmd)
function execWithEnv(
  command: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        const enhancedError = error as Error & {
          stdout: string;
          stderr: string;
          code: number;
        };
        enhancedError.stdout = stdout;
        enhancedError.stderr = stderr;
        reject(enhancedError);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Use cross-platform temp directory (os.tmpdir() instead of hardcoded /tmp)
const TEST_BASE_DIR = path.join(os.tmpdir(), `later-cli-test-${Date.now()}`);
const TEST_DATA_DIR = path.join(TEST_BASE_DIR, ".later");

// On Windows, we need to run node explicitly since shebangs don't work
// Quote the path for paths with spaces (e.g., "AI Tools", "Anthropic Solution")
const CLI_SCRIPT = path.resolve(process.cwd(), "bin", "later");
const CLI_PATH =
  process.platform === "win32" ? `node "${CLI_SCRIPT}"` : CLI_SCRIPT;

// Environment for all CLI calls
// On Windows, os.homedir() uses USERPROFILE, not HOME
// Set both to ensure test isolation across platforms
const TEST_ENV = {
  ...process.env,
  HOME: TEST_BASE_DIR,
  USERPROFILE: TEST_BASE_DIR,
};

describe("CLI Integration Tests", () => {
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

  describe("capture command", () => {
    it("should capture a decision successfully", async () => {
      const { stdout } = await execWithEnv(
        `${CLI_PATH} capture "Integration test decision"`,
        TEST_ENV,
      );

      expect(stdout).toContain("Captured as item");
      expect(stdout).toMatch(/#\d+/);
      // Note: stderr startup message is platform-specific and may be suppressed
    }, 15000);

    it("should show error when decision is missing", async () => {
      try {
        await execWithEnv(`${CLI_PATH} capture`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
        expect(error.stdout || error.stderr).toContain("requires 1 argument");
      }
    }, 15000);

    it("should handle decisions with special characters", async () => {
      const { stdout } = await execWithEnv(
        `${CLI_PATH} capture "Test with \\"quotes\\" and symbols!@#"`,
        TEST_ENV,
      );

      expect(stdout).toContain("Captured as item");
    }, 15000);
  });

  describe("list command", () => {
    it("should list items successfully", async () => {
      // First create an item
      await execWithEnv(`${CLI_PATH} capture "List test item"`, TEST_ENV);

      // Then list
      const { stdout } = await execWithEnv(`${CLI_PATH} list`, TEST_ENV);

      expect(stdout).toContain("Found");
      expect(stdout).toContain("item(s)");
      expect(stdout).toContain("List test item");
    }, 20000);

    it('should show "No items found" for empty list', async () => {
      const { stdout } = await execWithEnv(`${CLI_PATH} list`, TEST_ENV);

      expect(stdout).toContain("No items found");
    }, 15000);

    it("should display multiple items", async () => {
      // Create multiple items
      await execWithEnv(`${CLI_PATH} capture "First item"`, TEST_ENV);
      await execWithEnv(`${CLI_PATH} capture "Second item"`, TEST_ENV);
      await execWithEnv(`${CLI_PATH} capture "Third item"`, TEST_ENV);

      const { stdout } = await execWithEnv(`${CLI_PATH} list`, TEST_ENV);

      expect(stdout).toContain("Found 3 item(s)");
      expect(stdout).toContain("First item");
      expect(stdout).toContain("Second item");
      expect(stdout).toContain("Third item");
    }, 25000);
  });

  describe("show command", () => {
    it("should show item details successfully", async () => {
      // Create an item
      const { stdout: captureOut } = await execWithEnv(
        `${CLI_PATH} capture "Show test item"`,
        TEST_ENV,
      );

      // Extract ID from capture output
      const match = captureOut.match(/#(\d+)/);
      expect(match).not.toBeNull();
      const id = match![1];

      // Show the item
      const { stdout } = await execWithEnv(`${CLI_PATH} show ${id}`, TEST_ENV);

      expect(stdout).toContain(`Item #${id}`);
      expect(stdout).toContain("Show test item");
      expect(stdout).toContain("pending");
      expect(stdout).toContain("medium");
      expect(stdout).toContain("Created");
    }, 20000);

    it("should show error for non-existent item", async () => {
      try {
        await execWithEnv(`${CLI_PATH} show 99999`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
      }
    }, 15000);

    it("should show error for invalid ID", async () => {
      try {
        await execWithEnv(`${CLI_PATH} show abc`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
        expect(error.stdout || error.stderr).toContain("Invalid ID");
      }
    }, 15000);

    it("should show error when ID is missing", async () => {
      try {
        await execWithEnv(`${CLI_PATH} show`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
        expect(error.stdout || error.stderr).toContain("requires 1 argument");
      }
    }, 15000);
  });

  describe("error handling", () => {
    it("should handle invalid subcommand", async () => {
      try {
        await execWithEnv(`${CLI_PATH} invalid`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
        expect(error.stdout || error.stderr).toContain("Unknown subcommand");
      }
    }, 15000);

    it("should handle no subcommand", async () => {
      try {
        await execWithEnv(`${CLI_PATH}`, TEST_ENV);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Error");
        expect(error.stdout || error.stderr).toContain(
          "No subcommand provided",
        );
      }
    }, 15000);
  });

  describe("end-to-end workflow", () => {
    it("should support complete capture->list->show workflow", async () => {
      // 1. Capture an item
      const { stdout: captureOut } = await execWithEnv(
        `${CLI_PATH} capture "E2E test workflow"`,
        TEST_ENV,
      );

      expect(captureOut).toContain("Captured as item");
      const match = captureOut.match(/#(\d+)/);
      const id = match![1];

      // 2. List items
      const { stdout: listOut } = await execWithEnv(
        `${CLI_PATH} list`,
        TEST_ENV,
      );

      expect(listOut).toContain("E2E test workflow");
      expect(listOut).toContain(`#${id}`);

      // 3. Show specific item
      const { stdout: showOut } = await execWithEnv(
        `${CLI_PATH} show ${id}`,
        TEST_ENV,
      );

      expect(showOut).toContain(`Item #${id}`);
      expect(showOut).toContain("E2E test workflow");
      expect(showOut).toContain("pending");
    }, 30000);
  });
});
