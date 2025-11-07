import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Storage } from '../../src/storage/interface.js';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import { handleCapture } from '../../src/tools/core/capture.js';
import { handleList } from '../../src/tools/core/list.js';
import { handleShow } from '../../src/tools/core/show.js';
import { handleUpdate } from '../../src/tools/workflow/update.js';
import { handleDelete } from '../../src/tools/workflow/delete.js';
import { handleDo } from '../../src/tools/workflow/do.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-test-integration');

describe('CRUD Workflow Integration Tests', () => {
  let storage: Storage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    // Cleanup after tests
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Complete CRUD workflow', () => {
    it('should handle full lifecycle: Create → Read → Update → Delete', async () => {
      // 1. CREATE: Capture a new decision
      const captureResult = await handleCapture(
        {
          decision: 'Implement user authentication',
          context: 'Need to add OAuth2 support for GitHub and Google',
          tags: ['security', 'feature'],
          priority: 'high',
        },
        storage
      );

      expect(captureResult.success).toBe(true);
      expect(captureResult.item_id).toBeDefined();
      const itemId = captureResult.item_id!;

      // 2. READ: List all items
      const listResult = await handleList({}, storage);
      expect(listResult.success).toBe(true);
      expect(listResult.items).toHaveLength(1);
      expect(listResult.items[0].id).toBe(itemId);
      expect(listResult.items[0].decision).toBe('Implement user authentication');

      // 3. READ: Show specific item
      const showResult = await handleShow({ id: itemId }, storage);
      expect(showResult.success).toBe(true);
      expect(showResult.item?.decision).toBe('Implement user authentication');
      expect(showResult.item?.tags).toEqual(['security', 'feature']);
      expect(showResult.item?.priority).toBe('high');
      expect(showResult.item?.status).toBe('pending');

      // 4. UPDATE: Modify the item
      const updateResult = await handleUpdate(
        {
          id: itemId,
          decision: 'Implement OAuth2 authentication',
          priority: 'medium',
          tags: ['security', 'feature', 'oauth'],
        },
        storage
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.item?.decision).toBe('Implement OAuth2 authentication');
      expect(updateResult.item?.priority).toBe('medium');
      expect(updateResult.item?.tags).toEqual(['security', 'feature', 'oauth']);

      // 5. UPDATE: Change status
      const doResult = await handleDo({ id: itemId }, storage);
      expect(doResult.success).toBe(true);

      // Verify status changed to in-progress
      const inProgressItem = await storage.findById(itemId);
      expect(inProgressItem?.status).toBe('in-progress');

      // 6. UPDATE: Complete the item
      const completeResult = await handleUpdate(
        {
          id: itemId,
          status: 'done',
        },
        storage
      );

      expect(completeResult.success).toBe(true);
      expect(completeResult.item?.status).toBe('done');

      // 7. DELETE: Soft delete (archive)
      const softDeleteResult = await handleDelete({ id: itemId }, storage);
      expect(softDeleteResult.success).toBe(true);

      // Verify item is archived
      const archivedItem = await storage.findById(itemId);
      expect(archivedItem?.status).toBe('archived');

      // 8. DELETE: Hard delete
      const hardDeleteResult = await handleDelete({ id: itemId, hard: true }, storage);
      expect(hardDeleteResult.success).toBe(true);

      // Verify item is gone
      const deletedItem = await storage.findById(itemId);
      expect(deletedItem).toBeNull();

      // Verify list is empty
      const finalList = await handleList({}, storage);
      expect(finalList.items).toHaveLength(0);
    });

    it('should handle multiple items with filtering and updates', async () => {
      // Create multiple items
      const item1 = await handleCapture(
        {
          decision: 'Fix database performance',
          context: 'Slow queries on user table',
          tags: ['bug', 'performance'],
          priority: 'high',
        },
        storage
      );

      const item2 = await handleCapture(
        {
          decision: 'Add dark mode',
          context: 'User requested feature',
          tags: ['feature', 'ui'],
          priority: 'low',
        },
        storage
      );

      const item3 = await handleCapture(
        {
          decision: 'Update dependencies',
          context: 'Security patches available',
          tags: ['maintenance', 'security'],
          priority: 'high',
        },
        storage
      );

      expect(item1.success).toBe(true);
      expect(item2.success).toBe(true);
      expect(item3.success).toBe(true);

      // List all items
      const allItems = await handleList({}, storage);
      expect(allItems.items).toHaveLength(3);

      // Filter by priority
      const highPriorityItems = await handleList({ priority: 'high' }, storage);
      expect(highPriorityItems.items).toHaveLength(2);
      expect(highPriorityItems.items.every(i => i.priority === 'high')).toBe(true);

      // Filter by tags
      const securityItems = await handleList({ tags: ['security'] }, storage);
      expect(securityItems.items).toHaveLength(1);
      expect(securityItems.items[0].decision).toBe('Update dependencies');

      // Update item1 status to in-progress
      await handleDo({ id: item1.item_id! }, storage);

      // Filter by status
      const pendingItems = await handleList({ status: 'pending' }, storage);
      expect(pendingItems.items).toHaveLength(2);

      const inProgressItems = await handleList({ status: 'in-progress' }, storage);
      expect(inProgressItems.items).toHaveLength(1);
      expect(inProgressItems.items[0].id).toBe(item1.item_id);

      // Complete item1
      await handleUpdate({ id: item1.item_id!, status: 'done' }, storage);

      // Archive item2
      await handleDelete({ id: item2.item_id! }, storage);

      // List active items (excluding archived)
      const activeItems = await handleList({}, storage);
      expect(activeItems.items.filter(i => i.status !== 'archived')).toHaveLength(2);
    });

    it('should handle dependencies workflow', async () => {
      // Create items with dependencies
      const designItem = await handleCapture(
        {
          decision: 'Design API endpoints',
          context: 'Create REST API specification',
          tags: ['design'],
          priority: 'high',
        },
        storage
      );

      const implementItem = await handleCapture(
        {
          decision: 'Implement API endpoints',
          context: 'Build the REST API',
          tags: ['implementation'],
          priority: 'high',
        },
        storage
      );

      const testItem = await handleCapture(
        {
          decision: 'Write API tests',
          context: 'Integration tests for API',
          tags: ['testing'],
          priority: 'medium',
        },
        storage
      );

      expect(designItem.success).toBe(true);
      expect(implementItem.success).toBe(true);
      expect(testItem.success).toBe(true);

      // Add dependencies via update
      await handleUpdate(
        {
          id: implementItem.item_id!,
          dependencies: [designItem.item_id!],
        },
        storage
      );

      await handleUpdate(
        {
          id: testItem.item_id!,
          dependencies: [implementItem.item_id!],
        },
        storage
      );

      // Try to start testItem (should succeed but warn about dependencies)
      const tryStartTest = await handleDo({ id: testItem.item_id! }, storage);
      expect(tryStartTest.success).toBe(true);
      expect(tryStartTest.warnings).toContain('Dependencies not met');

      // Start and complete design
      await handleDo({ id: designItem.item_id! }, storage);
      await handleUpdate({ id: designItem.item_id!, status: 'done' }, storage);

      // Now implementItem can start
      const startImplement = await handleDo({ id: implementItem.item_id! }, storage);
      expect(startImplement.success).toBe(true);

      // Complete implement
      await handleUpdate({ id: implementItem.item_id!, status: 'done' }, storage);

      // Now testItem can start
      const startTest = await handleDo({ id: testItem.item_id! }, storage);
      expect(startTest.success).toBe(true);

      // Verify final state
      const design = await storage.findById(designItem.item_id!);
      const implement = await storage.findById(implementItem.item_id!);
      const test = await storage.findById(testItem.item_id!);

      expect(design?.status).toBe('done');
      expect(implement?.status).toBe('done');
      expect(test?.status).toBe('in-progress');
    });

    it('should prevent circular dependencies', async () => {
      // Create item1
      const item1 = await handleCapture(
        {
          decision: 'Task A',
          context: 'First task',
          tags: [],
          priority: 'medium',
        },
        storage
      );

      // Create item2
      const item2 = await handleCapture(
        {
          decision: 'Task B',
          context: 'Second task',
          tags: [],
          priority: 'medium',
        },
        storage
      );

      // Add dependency: item2 depends on item1
      await handleUpdate(
        {
          id: item2.item_id!,
          dependencies: [item1.item_id!],
        },
        storage
      );

      // Try to update item1 to depend on item2 (would create cycle)
      const updateResult = await handleUpdate(
        {
          id: item1.item_id!,
          dependencies: [item2.item_id!],
        },
        storage
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('cycle');
    });

    it('should handle multiple sequential updates correctly', async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: 'Sequential test item',
          context: 'Testing sequential updates',
          tags: ['test'],
          priority: 'medium',
        },
        storage
      );

      const itemId = item.item_id!;

      // Perform sequential updates to ensure all changes are preserved
      const update1 = await handleUpdate({ id: itemId, priority: 'high' }, storage);
      expect(update1.success).toBe(true);

      const update2 = await handleUpdate({ id: itemId, tags: ['test', 'sequential'] }, storage);
      expect(update2.success).toBe(true);

      const update3 = await handleUpdate({ id: itemId, context: 'Updated context' }, storage);
      expect(update3.success).toBe(true);

      // Verify final state - all changes should be present
      const finalItem = await storage.findById(itemId);
      expect(finalItem).not.toBeNull();
      expect(finalItem?.priority).toBe('high');
      expect(finalItem?.tags).toContain('test');
      expect(finalItem?.tags).toContain('sequential');
      expect(finalItem?.context).toBe('Updated context');
    });
  });

  describe('Error handling workflow', () => {
    it('should handle not found errors gracefully', async () => {
      const showResult = await handleShow({ id: 999 }, storage);
      expect(showResult.success).toBe(false);
      expect(showResult.error).toContain('not found');

      const updateResult = await handleUpdate({ id: 999, priority: 'high' }, storage);
      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('not found');

      const deleteResult = await handleDelete({ id: 999 }, storage);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toContain('not found');
    });

    it('should validate state transitions', async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: 'Test state transitions',
          context: 'Testing',
          tags: [],
          priority: 'medium',
        },
        storage
      );

      const itemId = item.item_id!;

      // Try invalid transition: pending → done (must go through in-progress)
      const invalidTransition = await handleUpdate({ id: itemId, status: 'done' }, storage);
      expect(invalidTransition.success).toBe(false);
      expect(invalidTransition.error).toContain('transition');

      // Valid transitions
      await handleDo({ id: itemId }, storage); // pending → in-progress
      const toDone = await handleUpdate({ id: itemId, status: 'done' }, storage);
      expect(toDone.success).toBe(true);

      // Can archive from done
      const toArchived = await handleUpdate({ id: itemId, status: 'archived' }, storage);
      expect(toArchived.success).toBe(true);

      // Can restore from archived
      const toPending = await handleUpdate({ id: itemId, status: 'pending' }, storage);
      expect(toPending.success).toBe(true);
    });
  });
});
