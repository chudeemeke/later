import { JSONLStorage } from '../../src/storage/jsonl.js';
import type { DeferredItem } from '../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
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
    });
  });
});
