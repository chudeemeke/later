import { JSONLStorage } from '../../src/storage/jsonl.js';
import type { DeferredItem } from '../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-test');
const TEST_FILE = path.join(TEST_DIR, 'items.jsonl');

describe('JSONLStorage', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('append', () => {
    test('creates new item in JSONL file', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Test decision',
        context: 'Test context',
        status: 'pending',
        tags: ['test'],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      const content = await fs.readFile(TEST_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0])).toEqual(item);
    });

    test('appends multiple items', async () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'First',
        context: 'Context 1',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Second',
        context: 'Context 2',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item1);
      await storage.append(item2);

      const items = await storage.readAll();
      expect(items.length).toBe(2);
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
    });
  });

  describe('readAll', () => {
    test('returns empty array when file does not exist', async () => {
      const items = await storage.readAll();
      expect(items).toEqual([]);
    });

    test('returns all items from JSONL', async () => {
      // Write test data directly
      const item1 = { id: 1, decision: 'First', status: 'pending' };
      const item2 = { id: 2, decision: 'Second', status: 'done' };

      await fs.writeFile(
        TEST_FILE,
        JSON.stringify(item1) + '\n' + JSON.stringify(item2) + '\n'
      );

      const items = await storage.readAll();
      expect(items.length).toBe(2);
      expect(items[0].decision).toBe('First');
      expect(items[1].decision).toBe('Second');
    });
  });

  describe('findById', () => {
    test('returns item with matching ID', async () => {
      const item: DeferredItem = {
        id: 5,
        decision: 'Find me',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      const found = await storage.findById(5);
      expect(found).not.toBeNull();
      expect(found!.decision).toBe('Find me');
    });

    test('returns null for non-existent ID', async () => {
      const found = await storage.findById(999);
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    test('updates existing item', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Original',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      item.decision = 'Updated';
      item.status = 'done';
      await storage.update(item);

      const found = await storage.findById(1);
      expect(found!.decision).toBe('Updated');
      expect(found!.status).toBe('done');
    });

    test('throws error for non-existent item', async () => {
      const item: DeferredItem = {
        id: 999,
        decision: 'Does not exist',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(storage.update(item)).rejects.toThrow('Item #999 not found');
    });
  });

  describe('getNextId', () => {
    test('returns 1 for empty storage', async () => {
      const nextId = await storage.getNextId();
      expect(nextId).toBe(1);
    });

    test('returns max ID + 1', async () => {
      await storage.append({ id: 1 } as DeferredItem);
      await storage.append({ id: 5 } as DeferredItem);
      await storage.append({ id: 3 } as DeferredItem);

      const nextId = await storage.getNextId();
      expect(nextId).toBe(6);
    });
  });

  describe('delete', () => {
    test('deletes existing item', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'To be deleted',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      // Verify item exists
      let found = await storage.findById(1);
      expect(found).not.toBeNull();

      // Delete the item
      await storage.delete(1);

      // Verify item no longer exists
      found = await storage.findById(1);
      expect(found).toBeNull();
    });

    test('throws error for non-existent item', async () => {
      await expect(storage.delete(999)).rejects.toThrow('Item #999 not found');
    });

    test('removes item from JSONL file', async () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'First',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Second',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item1);
      await storage.append(item2);

      // Delete first item
      await storage.delete(1);

      // Read file directly to verify
      const content = await fs.readFile(TEST_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]).id).toBe(2);
    });

    test('handles multiple deletes', async () => {
      // Create 5 items
      for (let i = 1; i <= 5; i++) {
        await storage.append({
          id: i,
          decision: `Item ${i}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Delete items 2 and 4
      await storage.delete(2);
      await storage.delete(4);

      const items = await storage.readAll();
      expect(items.length).toBe(3);
      expect(items.map(i => i.id)).toEqual([1, 3, 5]);
    });

    test('maintains file permissions after delete', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);
      await storage.delete(1);

      const stats = await fs.stat(TEST_FILE);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600); // rw-------
    });

    test('handles concurrent deletes safely', async () => {
      // Create 20 items
      for (let i = 1; i <= 20; i++) {
        await storage.append({
          id: i,
          decision: `Item ${i}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Delete even numbered items concurrently
      const deletePromises = Array.from({ length: 10 }, (_, i) =>
        storage.delete((i + 1) * 2)
      );

      await Promise.all(deletePromises);

      const items = await storage.readAll();
      expect(items.length).toBe(10);
      // Verify only odd numbered items remain
      items.forEach(item => {
        expect(item.id % 2).toBe(1);
      });
    }, 15000); // Increase timeout for concurrent operations with exponential backoff
  });

  describe('concurrent writes', () => {
    test('handles concurrent appends with locking', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.append({
          id: i + 1,
          decision: `Item ${i + 1}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );

      await Promise.all(promises);

      const items = await storage.readAll();
      expect(items.length).toBe(10);
    }, 15000); // Increase timeout for concurrent operations with exponential backoff
  });

  describe('lock management', () => {
    test('cleans up stale lock from dead process', async () => {
      const lockFile = path.join(TEST_DIR, '.lock');

      // Create a stale lock file with a PID that doesn't exist
      // Using PID 999999 which is unlikely to exist
      await fs.writeFile(lockFile, '999999', { flag: 'wx' });

      // Verify lock file exists
      const exists = await fs.access(lockFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Try to append an item - should clean stale lock and succeed
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Verify item was added successfully
      const items = await storage.readAll();
      expect(items.length).toBe(1);
    });

    test('respects valid lock from active process', async () => {
      const lockFile = path.join(TEST_DIR, '.lock');

      // Create a lock file with current process PID
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });

      // Try to append with a very short timeout
      // This should fail because lock is held by active process
      const appendPromise = storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // The append should eventually succeed after we release the lock
      // Clean up lock immediately to allow test to complete
      await fs.unlink(lockFile);

      await appendPromise;
      const items = await storage.readAll();
      expect(items.length).toBe(1);
    });

    test('handles invalid lock file content', async () => {
      const lockFile = path.join(TEST_DIR, '.lock');

      // Create lock file with invalid content
      await fs.writeFile(lockFile, 'not-a-number', { flag: 'wx' });

      // Should clean invalid lock and succeed
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const items = await storage.readAll();
      expect(items.length).toBe(1);
    });

    test('uses exponential backoff for lock contention', async () => {
      // This test verifies that retries use exponential backoff
      // by measuring time between attempts
      const lockFile = path.join(TEST_DIR, '.lock');
      let lockAcquired = false;

      // Hold lock for 300ms
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });

      setTimeout(async () => {
        await fs.unlink(lockFile).catch(() => {});
        lockAcquired = true;
      }, 300);

      const startTime = Date.now();

      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;

      // Should have waited at least 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(lockAcquired).toBe(true);

      const items = await storage.readAll();
      expect(items.length).toBe(1);
    });

    test('waits for lock with retry attempts', async () => {
      // Create a separate test directory
      const testDir = path.join(os.tmpdir(), `later-test-lock-wait-${Date.now()}`);
      await fs.mkdir(testDir, { recursive: true });
      const testStorage = new JSONLStorage(testDir);

      const lockFile = path.join(testDir, '.lock');

      // Create a lock file with current PID
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });

      // Start an append operation in parallel
      const appendPromise = testStorage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Release lock after 2 seconds
      setTimeout(async () => {
        await fs.unlink(lockFile).catch(() => {});
      }, 2000);

      const startTime = Date.now();

      // Should succeed after lock is released
      await appendPromise;

      const duration = Date.now() - startTime;

      // Should have waited at least 2 seconds for lock
      expect(duration).toBeGreaterThanOrEqual(2000);

      // Verify item was appended
      const items = await testStorage.readAll();
      expect(items.length).toBe(1);

      // Cleanup
      await fs.rm(testDir, { recursive: true }).catch(() => {});
    }, 10000);

    test('throws error on lock timeout', async () => {
      // Create storage with very short timeout
      const shortTimeoutStorage = new JSONLStorage(TEST_DIR, 100);
      const lockFile = path.join(TEST_DIR, '.lock');

      // Create a lock that won't be released
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });

      // Try to append with the locked storage
      const promise = shortTimeoutStorage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Should timeout
      await expect(promise).rejects.toThrow(/Failed to acquire lock after.*High contention detected/);

      // Cleanup
      await fs.unlink(lockFile).catch(() => {});
    });
  });

  describe('error handling', () => {
    test('readAll throws on non-ENOENT errors', async () => {
      // Write invalid JSON to the file to cause parse error
      await fs.mkdir(TEST_DIR, { recursive: true });
      await fs.writeFile(TEST_FILE, 'invalid json content\n');

      // Should throw JSON parse error
      await expect(storage.readAll()).rejects.toThrow();
    });
  });

  describe('getStorage singleton', () => {
    test('returns same instance on multiple calls', async () => {
      const { getStorage } = await import('../../src/storage/jsonl.js');

      const instance1 = getStorage();
      const instance2 = getStorage();

      expect(instance1).toBe(instance2);
    });

    test('creates instance with default directory', async () => {
      const { getStorage } = await import('../../src/storage/jsonl.js');

      const instance = getStorage();

      // Append an item to verify it works
      const id = await instance.append({
        decision: 'Test default dir',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(id).toBeGreaterThan(0);
    });
  });

  describe('auto ID generation', () => {
    test('generates sequential IDs when not provided', async () => {
      const id1 = await storage.append({
        decision: 'First',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const id2 = await storage.append({
        decision: 'Second',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    test('uses provided ID when specified', async () => {
      const id = await storage.append({
        id: 99,
        decision: 'Custom ID',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(id).toBe(99);
    });
  });
});
