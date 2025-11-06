import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { DeferredItem } from '../types.js';
import type { Storage } from './interface.js';

export class JSONLStorage implements Storage {
  private laterDir: string;
  private itemsFile: string;
  private lockFile: string;

  constructor(dataDir?: string) {
    this.laterDir = dataDir || path.join(homedir(), '.later');
    this.itemsFile = path.join(this.laterDir, 'items.jsonl');
    this.lockFile = path.join(this.laterDir, '.lock');
  }

  async append(item: DeferredItem): Promise<void> {
    await this.ensureDir();
    await this.withLock(async () => {
      await fs.appendFile(this.itemsFile, JSON.stringify(item) + '\n');
    });
    // Ensure proper permissions after write
    await this.setSecurePermissions();
  }

  async readAll(): Promise<DeferredItem[]> {
    await this.ensureDir();

    try {
      const content = await fs.readFile(this.itemsFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
          items.map((i) => JSON.stringify(i)).join('\n') + '\n'
        );

        // Atomic rename (single syscall)
        await fs.rename(tempFile, this.itemsFile);

        // Ensure proper permissions
        await this.setSecurePermissions();
      } catch (error) {
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
          filteredItems.map((i) => JSON.stringify(i)).join('\n') + '\n'
        );

        // Atomic rename (single syscall)
        await fs.rename(tempFile, this.itemsFile);

        // Ensure proper permissions
        await this.setSecurePermissions();
      } catch (error) {
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Log but don't fail
        console.warn('Failed to set secure permissions:', error);
      }
    }
  }

  /**
   * Clean stale lock files from dead processes
   * @returns void
   */
  private async cleanStaleLock(): Promise<void> {
    try {
      const lockContent = await fs.readFile(this.lockFile, 'utf-8');
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Ignore if lock file doesn't exist, throw other errors
        throw error;
      }
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // File-based locking with exponential backoff and stale lock detection
    const maxRetries = 50; // 5 seconds max wait with exponential backoff
    const baseDelay = 100; // ms
    let retries = 0;
    let acquired = false;

    while (!acquired && retries < maxRetries) {
      try {
        // Check for and clean stale locks before attempting to acquire
        await this.cleanStaleLock();

        // Try to create lock file exclusively
        await fs.writeFile(this.lockFile, String(process.pid), { flag: 'wx' });
        acquired = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          // Lock held by another process, exponential backoff
          const delay = Math.min(baseDelay * Math.pow(1.5, retries), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }

    if (!acquired) {
      throw new Error('Failed to acquire lock after 5 seconds');
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
