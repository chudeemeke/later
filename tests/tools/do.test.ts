import { handleDo } from '../../src/tools/workflow/do.js';
import type { DoArgs, DeferredItem } from '../../src/types.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-do-test');

describe('later_do Tool', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic do', () => {
    test('marks item as in-progress', async () => {
      await storage.append({
        id: 1,
        decision: 'Migrate to TypeScript',
        context: 'Need better type safety',
        status: 'pending',
        tags: [],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.success).toBe(true);

      const updated = await storage.findById(1);
      expect(updated?.status).toBe('in-progress');
    });

    test('updates updated_at timestamp', async () => {
      const oldTime = '2025-01-01T10:00:00Z';
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: oldTime,
        updated_at: oldTime,
      });

      await handleDo({ id: 1 }, storage);

      const updated = await storage.findById(1);
      expect(updated?.updated_at).not.toBe(oldTime);
    });

    test('provides todo guidance in output', async () => {
      await storage.append({
        id: 1,
        decision: 'Implement feature',
        context: 'Add user authentication',
        status: 'pending',
        tags: [],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance).toBeDefined();
      expect(result.todo_guidance).toContain('Implement feature');
    });

    test('returns error when item not found', async () => {
      const result = await handleDo({ id: 999 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('preserves other item properties', async () => {
      await storage.append({
        id: 1,
        decision: 'Test decision',
        context: 'Test context',
        status: 'pending',
        tags: ['tag1', 'tag2'],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await handleDo({ id: 1 }, storage);

      const updated = await storage.findById(1);
      expect(updated?.decision).toBe('Test decision');
      expect(updated?.context).toBe('Test context');
      expect(updated?.tags).toEqual(['tag1', 'tag2']);
      expect(updated?.priority).toBe('high');
    });
  });

  describe('status transitions', () => {
    test('can mark pending item as in-progress', async () => {
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

      const result = await handleDo({ id: 1 }, storage);

      expect(result.success).toBe(true);
      const item = await storage.findById(1);
      expect(item?.status).toBe('in-progress');
    });

    test('warns if item already in-progress', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'in-progress',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('already in-progress');
    });

    test('warns if item already done', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'done',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('already done');
    });
  });

  describe('todo guidance', () => {
    test('includes item decision in guidance', async () => {
      await storage.append({
        id: 1,
        decision: 'Refactor authentication module',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance).toContain('Refactor authentication module');
    });

    test('includes context in guidance', async () => {
      await storage.append({
        id: 1,
        decision: 'Optimize database queries',
        context: 'Focus on N+1 query problems',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance).toContain('N+1 query');
    });

    test('suggests creating TodoWrite items', async () => {
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

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance?.toLowerCase()).toContain('todo');
    });

    test('includes priority in guidance', async () => {
      await storage.append({
        id: 1,
        decision: 'Critical fix',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance?.toLowerCase()).toContain('high');
    });

    test('includes tags in guidance', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: ['refactoring', 'urgent'],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 1 }, storage);

      expect(result.todo_guidance).toContain('refactoring');
      expect(result.todo_guidance).toContain('urgent');
    });
  });

  describe('error handling', () => {
    test('validates ID is positive', async () => {
      const result = await handleDo({ id: 0 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    test('validates ID is not negative', async () => {
      const result = await handleDo({ id: -1 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    test('handles storage errors', async () => {
      const brokenStorage = {
        findById: async () => {
          throw new Error('Storage error');
        },
      } as any;

      const result = await handleDo({ id: 1 }, brokenStorage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('formatted output', () => {
    test('provides clear success message', async () => {
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

      const result = await handleDo({ id: 1 }, storage);

      expect(result.message).toBeDefined();
      expect(result.message).toContain('in-progress');
    });

    test('includes link back to item', async () => {
      await storage.append({
        id: 5,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 5 }, storage);

      expect(result.message).toContain('#5');
    });
  });

  describe('dependencies', () => {
    test('warns about unmet dependencies', async () => {
      await storage.append({
        id: 1,
        decision: 'Dependency',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await storage.append({
        id: 2,
        decision: 'Dependent task',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        dependencies: [1],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 2 }, storage);

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Dependencies');
    });

    test('does not warn when dependencies are met', async () => {
      await storage.append({
        id: 1,
        decision: 'Dependency',
        context: '',
        status: 'done',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await storage.append({
        id: 2,
        decision: 'Dependent task',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        dependencies: [1],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleDo({ id: 2 }, storage);

      if (result.warnings) {
        expect(result.warnings).not.toContain('Dependencies');
      }
    });
  });
});
