import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";
import type { DeferredItem } from "../types.js";
import type { Storage } from "./interface.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("later:storage");

export class JSONLStorage implements Storage {
  private laterDir: string;
  private itemsFile: string;
  private lockFile: string;
  private lockTimeoutMs: number; // Lock timeout in milliseconds

  constructor(dataDir?: string, lockTimeoutMs: number = 30000) {
    this.laterDir = dataDir || path.join(homedir(), ".later");
    this.itemsFile = path.join(this.laterDir, "items.jsonl");
    this.lockFile = path.join(this.laterDir, ".lock");
    this.lockTimeoutMs = lockTimeoutMs; // Default 30 seconds for high concurrency
  }

  async append(
    item: Omit<DeferredItem, "id"> & { id?: number },
  ): Promise<number> {
    await this.ensureDir();

    let assignedId: number = 0;

    await this.withLock(async () => {
      // If ID not provided, generate it atomically within the lock
      if (item.id === undefined) {
        const items = await this.readAll();
        assignedId =
          items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1;
      } else {
        assignedId = item.id;
      }

      // Create full item with assigned ID
      const fullItem: DeferredItem = {
        ...item,
        id: assignedId,
      } as DeferredItem;

      await fs.appendFile(this.itemsFile, JSON.stringify(fullItem) + "\n");
    });

    // Ensure proper permissions after write
    await this.setSecurePermissions();

    return assignedId;
  }

  async readAll(): Promise<DeferredItem[]> {
    await this.ensureDir();

    try {
      const content = await fs.readFile(this.itemsFile, "utf-8");
      return content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async findById(id: number): Promise<DeferredItem | null> {
    const items = await this.readAll();
    return items.find((item) => item.id === id) || null;
  }

  async update(item: DeferredItem): Promise<void> {
    await this.withLock(async () => {
      const items = await this.readAll();
      const index = items.findIndex((i) => i.id === item.id);

      if (index === -1) {
        throw new Error(`Item #${item.id} not found`);
      }

      items[index] = item;

      // Atomic write: write to temp file, then rename
      const tempFile = `${this.itemsFile}.tmp.${process.pid}`;
      try {
        await fs.writeFile(
          tempFile,
          items.map((i) => JSON.stringify(i)).join("\n") + "\n",
        );

        // Atomic rename (single syscall)
        await fs.rename(tempFile, this.itemsFile);

        // Ensure proper permissions
        await this.setSecurePermissions();
      } catch (error) /* istanbul ignore next - rare fs error during atomic write */ {
        // Clean up temp file on error
        await fs.unlink(tempFile).catch(() => {});
        throw error;
      }
    });
  }

  async delete(id: number): Promise<void> {
    await this.withLock(async () => {
      const items = await this.readAll();
      const index = items.findIndex((i) => i.id === id);

      if (index === -1) {
        throw new Error(`Item #${id} not found`);
      }

      // Remove item from array
      const filteredItems = items.filter((i) => i.id !== id);

      // Atomic write: write to temp file, then rename
      const tempFile = `${this.itemsFile}.tmp.${process.pid}`;
      try {
        await fs.writeFile(
          tempFile,
          filteredItems.map((i) => JSON.stringify(i)).join("\n") + "\n",
        );

        // Atomic rename (single syscall)
        await fs.rename(tempFile, this.itemsFile);

        // Ensure proper permissions
        await this.setSecurePermissions();
      } catch (error) /* istanbul ignore next - rare fs error during atomic write */ {
        // Clean up temp file on error
        await fs.unlink(tempFile).catch(() => {});
        throw error;
      }
    });
  }

  async getNextId(): Promise<number> {
    const items = await this.readAll();
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.id)) + 1;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.laterDir, { recursive: true, mode: 0o700 });
  }

  private async setSecurePermissions(): Promise<void> {
    try {
      // Set file permissions to 600 (user read/write only)
      await fs.chmod(this.itemsFile, 0o600);
      // Set directory permissions to 700 (user access only)
      await fs.chmod(this.laterDir, 0o700);
    } catch (error) {
      // Ignore permission errors in test environments
      /* istanbul ignore if - rare chmod errors other than ENOENT */
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Log but don't fail
        log.warn("secure_permissions_failed", {
          file: this.itemsFile,
          dir: this.laterDir,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Clean stale lock files from dead processes
   * @returns void
   */
  private async cleanStaleLock(): Promise<void> {
    try {
      const lockContent = await fs.readFile(this.lockFile, "utf-8");
      const lockPid = parseInt(lockContent.trim());

      if (isNaN(lockPid)) {
        // Invalid lock file content, remove it
        await fs.unlink(this.lockFile);
        return;
      }

      // Check if process is still alive
      try {
        process.kill(lockPid, 0); // Signal 0 = test if process exists
        // Process is alive, lock is valid
      } catch {
        // Process is dead, remove stale lock
        await fs.unlink(this.lockFile);
      }
    } catch (error) {
      /* istanbul ignore if - rare fs errors other than ENOENT */
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Ignore if lock file doesn't exist, throw other errors
        throw error;
      }
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // File-based locking with exponential backoff and stale lock detection
    const baseDelay = 50; // ms - start with smaller delay
    const maxDelay = 1000; // ms - cap individual delay at 1 second
    const startTime = Date.now();
    let retries = 0;
    let acquired = false;

    while (!acquired && Date.now() - startTime < this.lockTimeoutMs) {
      try {
        // Check for and clean stale locks before attempting to acquire
        await this.cleanStaleLock();

        // Try to create lock file exclusively
        await fs.writeFile(this.lockFile, String(process.pid), { flag: "wx" });
        acquired = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          // Lock held by another process, exponential backoff with jitter
          const exponentialDelay = Math.min(
            baseDelay * Math.pow(1.5, retries),
            maxDelay,
          );
          const jitter = Math.random() * exponentialDelay * 0.3; // Add 30% jitter
          const delay = exponentialDelay + jitter;
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries++;
        } /* istanbul ignore next - rare fs error other than EEXIST */ else {
          throw error;
        }
      }
    }

    if (!acquired) {
      throw new Error(
        `Failed to acquire lock after ${this.lockTimeoutMs}ms (${retries} attempts). ` +
          `High contention detected.`,
      );
    }

    try {
      return await fn();
    } finally {
      // Always release lock
      await fs.unlink(this.lockFile).catch(() => {});
    }
  }
}

// Singleton for easy access
let storageInstance: Storage | null = null;

export function getStorage(dataDir?: string): Storage {
  if (!storageInstance) {
    storageInstance = new JSONLStorage(dataDir);
  }
  return storageInstance;
}

/**
 * Close storage and release resources
 * Called during graceful shutdown
 */
export async function closeStorage(): Promise<void> {
  if (storageInstance) {
    // Clear singleton reference
    storageInstance = null;
  }
}
