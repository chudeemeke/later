import { handleShow } from '../../src/tools/core/show.js';
import type { ShowArgs, DeferredItem } from '../../src/types.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-show-test');

describe('later_show Tool', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('basic show', () => {
    test('displays item with all details', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Migrate to TypeScript',
        context: 'Need to improve type safety and reduce runtime errors',
        status: 'pending',
        tags: ['refactoring', 'typescript'],
        priority: 'high',
        created_at: '2025-01-15T10:30:00Z',
        updated_at: '2025-01-15T10:30:00Z',
      };

      await storage.append(item);

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.item).toEqual(item);
      expect(result.formatted_output).toBeDefined();
    });

    test('returns error when item not found', async () => {
      const result = await handleShow({ id: 999 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.item).toBeUndefined();
    });

    test('formatted output includes decision', async () => {
      await storage.append({
        id: 1,
        decision: 'Test Decision',
        context: 'Test Context',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain('Test Decision');
    });

    test('formatted output includes context', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Important context information',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain('Important context information');
    });

    test('formatted output includes status', async () => {
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

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output?.toLowerCase()).toMatch(/in.?progress/);
    });

    test('formatted output includes priority', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output?.toLowerCase()).toContain('high');
    });

    test('formatted output includes tags', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: ['optimization', 'performance'],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain('optimization');
      expect(result.formatted_output).toContain('performance');
    });

    test('formatted output includes timestamps', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: '2025-01-15T10:30:00Z',
        updated_at: '2025-01-15T15:45:00Z',
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toMatch(/2025|Created|Updated/);
    });
  });

  describe('dependencies', () => {
    test('shows dependencies when present', async () => {
      await storage.append({
        id: 1,
        decision: 'Task 1',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await storage.append({
        id: 2,
        decision: 'Task 2',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        dependencies: [1],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 2 }, storage);

      expect(result.formatted_output).toContain('Dependencies');
      expect(result.formatted_output).toContain('#1');
    });

    test('does not show dependencies section when none exist', async () => {
      await storage.append({
        id: 1,
        decision: 'Independent task',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).not.toContain('Dependencies');
    });

    test('resolves dependency details', async () => {
      await storage.append({
        id: 1,
        decision: 'Dependency task',
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

      const result = await handleShow({ id: 2 }, storage);

      expect(result.formatted_output).toContain('Dependency task');
      expect(result.formatted_output?.toLowerCase()).toContain('done');
    });

    test('shows not found for missing dependencies', async () => {
      await storage.append({
        id: 2,
        decision: 'Task 2',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        dependencies: [999],  // Non-existent dependency
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 2 }, storage);

      expect(result.formatted_output).toContain('Dependencies');
      expect(result.formatted_output).toContain('#999');
      expect(result.formatted_output).toContain('(not found)');
    });
  });

  describe('conversation linking', () => {
    test('shows conversation ID when present', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        conversation_id: 'conv-12345',
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain('conv-12345');
    });

    test('does not show conversation section when no ID', async () => {
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

      const result = await handleShow({ id: 1 }, storage);

      // Should not have empty conversation section
      expect(result.formatted_output).not.toMatch(/Conversation:\s*$/m);
    });
  });

  describe('error handling', () => {
    test('handles storage errors', async () => {
      const brokenStorage = {
        findById: async () => {
          throw new Error('Storage error');
        },
      } as any;

      const result = await handleShow({ id: 1 }, brokenStorage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    test('validates ID is positive', async () => {
      const result = await handleShow({ id: 0 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });

    test('validates ID is not negative', async () => {
      const result = await handleShow({ id: -1 }, storage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ID');
    });
  });

  describe('formatting', () => {
    test('uses sections for organization', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Test context',
        status: 'pending',
        tags: ['test'],
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      // Should have clear section markers
      expect(result.formatted_output).toMatch(/Decision:|Status:|Priority:|Tags:|Context:/);
    });

    test('handles empty context gracefully', async () => {
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

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.formatted_output).toBeDefined();
    });

    test('handles empty tags gracefully', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain('Tags: (none)');
    });

    test('wraps long context for readability', async () => {
      const longContext = 'a'.repeat(200);

      await storage.append({
        id: 1,
        decision: 'Test',
        context: longContext,
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain(longContext);
      expect(result.success).toBe(true);
    });

    test('handles context with very long words', async () => {
      const longWord = 'x'.repeat(100);  // Single word longer than line width
      const context = `Short word ${longWord} another word`;

      await storage.append({
        id: 1,
        decision: 'Test',
        context,
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.formatted_output).toContain(longWord);
      expect(result.success).toBe(true);
    });
  });

  describe('PII detokenization (V2.0)', () => {
    test('detokenizes context when tokens present', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Email: [PII_TOKEN_1]',
        context_tokens: { PII_TOKEN_1: 'test@example.com' },
        context_pii_types: { email: 1 },
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.formatted_output).toContain('test@example.com');
      expect(result.formatted_output).not.toContain('[PII_TOKEN_1]');
    });

    test('handles items without context tokens', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'No PII here',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.formatted_output).toContain('No PII here');
    });

    test('handles empty context_tokens object', async () => {
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Test context',
        context_tokens: {},
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.formatted_output).toContain('Test context');
    });

    test('handles context_tokens without context_pii_types', async () => {
      // Item has context_tokens but no context_pii_types (undefined)
      await storage.append({
        id: 1,
        decision: 'Test',
        context: 'Email: [PII_TOKEN_1]',
        context_tokens: { PII_TOKEN_1: 'user@test.com' },
        // Intentionally omit context_pii_types to test the || {} fallback
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await handleShow({ id: 1 }, storage);

      expect(result.success).toBe(true);
      expect(result.formatted_output).toContain('user@test.com');
    });
  });
});
