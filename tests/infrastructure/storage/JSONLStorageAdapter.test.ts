// @ts-nocheck - Jest mock typing incompatibility with @jest/globals
/**
 * JSONLStorageAdapter Tests
 *
 * Tests the JSONL storage adapter implementing IStoragePort.
 * Uses TDD approach - tests written first.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JSONLStorageAdapter } from '../../../src/infrastructure/storage/JSONLStorageAdapter.js';
import { IStoragePort, ItemFilter, ItemSort } from '../../../src/domain/ports/IStoragePort.js';
import { CreateItemInput, ItemProps } from '../../../src/domain/entities/Item.js';
import { StatusValue } from '../../../src/domain/value-objects/Status.js';
import { PriorityValue } from '../../../src/domain/value-objects/Priority.js';

describe('JSONLStorageAdapter', () => {
  let adapter: IStoragePort;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = path.join(os.tmpdir(), `later-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    adapter = new JSONLStorageAdapter(testDir);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('Item Operations', () => {
    describe('createItem', () => {
      it('should create an item and return it with assigned ID', async () => {
        const input: CreateItemInput = {
          decision: 'Test decision',
          context: 'Test context',
          tags: ['test', 'unit'],
          priority: 'high',
        };

        const result = await adapter.createItem(input);

        expect(result.id).toBe(1);
        expect(result.decision).toBe('Test decision');
        expect(result.context).toBe('Test context');
        expect(result.status).toBe('pending');
        expect(result.tags).toEqual(['test', 'unit']);
        expect(result.priority).toBe('high');
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      it('should auto-increment IDs for multiple items', async () => {
        const item1 = await adapter.createItem({ decision: 'First' });
        const item2 = await adapter.createItem({ decision: 'Second' });
        const item3 = await adapter.createItem({ decision: 'Third' });

        expect(item1.id).toBe(1);
        expect(item2.id).toBe(2);
        expect(item3.id).toBe(3);
      });

      it('should use default values for optional fields', async () => {
        const result = await adapter.createItem({ decision: 'Minimal' });

        expect(result.context).toBe('');
        expect(result.status).toBe('pending');
        expect(result.tags).toEqual([]);
        expect(result.priority).toBe('medium');
      });
    });

    describe('getItem', () => {
      it('should return item by ID', async () => {
        const created = await adapter.createItem({ decision: 'Test' });
        const retrieved = await adapter.getItem(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.decision).toBe('Test');
      });

      it('should return null for non-existent ID', async () => {
        const result = await adapter.getItem(999);
        expect(result).toBeNull();
      });
    });

    describe('getItems', () => {
      it('should return multiple items by IDs', async () => {
        const item1 = await adapter.createItem({ decision: 'First' });
        const item2 = await adapter.createItem({ decision: 'Second' });
        await adapter.createItem({ decision: 'Third' });

        const results = await adapter.getItems([item1.id, item2.id]);

        expect(results).toHaveLength(2);
        expect(results.map(i => i.decision)).toContain('First');
        expect(results.map(i => i.decision)).toContain('Second');
      });

      it('should exclude non-existent IDs', async () => {
        const item1 = await adapter.createItem({ decision: 'Exists' });

        const results = await adapter.getItems([item1.id, 999, 1000]);

        expect(results).toHaveLength(1);
        expect(results[0].decision).toBe('Exists');
      });
    });

    describe('updateItem', () => {
      it('should update item fields', async () => {
        const created = await adapter.createItem({
          decision: 'Original',
          priority: 'low',
        });

        const updated = await adapter.updateItem(created.id, {
          decision: 'Updated',
          priority: 'high',
        });

        expect(updated.decision).toBe('Updated');
        expect(updated.priority).toBe('high');
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
      });

      it('should throw error for non-existent item', async () => {
        await expect(
          adapter.updateItem(999, { decision: 'Updated' })
        ).rejects.toThrow();
      });

      it('should only update specified fields', async () => {
        const created = await adapter.createItem({
          decision: 'Original',
          context: 'Original context',
          priority: 'low',
        });

        const updated = await adapter.updateItem(created.id, {
          decision: 'Updated',
        });

        expect(updated.decision).toBe('Updated');
        expect(updated.context).toBe('Original context');
        expect(updated.priority).toBe('low');
      });
    });

    describe('deleteItem', () => {
      it('should soft delete item by default (archive)', async () => {
        const created = await adapter.createItem({ decision: 'To delete' });
        await adapter.deleteItem(created.id);

        const retrieved = await adapter.getItem(created.id);
        expect(retrieved?.status).toBe('archived');
      });

      it('should hard delete item when specified', async () => {
        const created = await adapter.createItem({ decision: 'To delete' });
        await adapter.deleteItem(created.id, true);

        const retrieved = await adapter.getItem(created.id);
        expect(retrieved).toBeNull();
      });
    });

    describe('listItems', () => {
      beforeEach(async () => {
        // Create test data
        await adapter.createItem({ decision: 'Pending low', priority: 'low', tags: ['a'] });
        await adapter.createItem({ decision: 'Pending high', priority: 'high', tags: ['b'] });
        await adapter.createItem({ decision: 'In progress', priority: 'medium', tags: ['a', 'b'] });
        // Update status
        await adapter.updateItem(3, { status: 'in-progress' });
      });

      it('should return all items without filter', async () => {
        const results = await adapter.listItems();
        expect(results).toHaveLength(3);
      });

      it('should filter by status', async () => {
        const results = await adapter.listItems({ status: 'pending' });
        expect(results).toHaveLength(2);
        expect(results.every(i => i.status === 'pending')).toBe(true);
      });

      it('should filter by multiple statuses', async () => {
        const results = await adapter.listItems({ status: ['pending', 'in-progress'] });
        expect(results).toHaveLength(3);
      });

      it('should filter by priority', async () => {
        const results = await adapter.listItems({ priority: 'high' });
        expect(results).toHaveLength(1);
        expect(results[0].priority).toBe('high');
      });

      it('should filter by tags', async () => {
        const results = await adapter.listItems({ tags: ['a'] });
        expect(results).toHaveLength(2);
      });

      it('should apply pagination', async () => {
        const page1 = await adapter.listItems(undefined, undefined, { limit: 2 });
        const page2 = await adapter.listItems(undefined, undefined, { limit: 2, offset: 2 });

        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(1);
      });
    });

    describe('countItems', () => {
      it('should count all items', async () => {
        await adapter.createItem({ decision: 'One' });
        await adapter.createItem({ decision: 'Two' });
        await adapter.createItem({ decision: 'Three' });

        const count = await adapter.countItems();
        expect(count).toBe(3);
      });

      it('should count filtered items', async () => {
        await adapter.createItem({ decision: 'One', priority: 'high' });
        await adapter.createItem({ decision: 'Two', priority: 'low' });
        await adapter.createItem({ decision: 'Three', priority: 'high' });

        const count = await adapter.countItems({ priority: 'high' });
        expect(count).toBe(2);
      });
    });

    describe('searchItems', () => {
      beforeEach(async () => {
        await adapter.createItem({ decision: 'Optimize database queries', context: 'Performance issue' });
        await adapter.createItem({ decision: 'Fix login bug', context: 'Authentication problem' });
        await adapter.createItem({ decision: 'Add caching layer', context: 'Performance optimization' });
      });

      it('should search by query string', async () => {
        const results = await adapter.searchItems('performance');

        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.every(r => r.score > 0)).toBe(true);
      });

      it('should return results sorted by relevance', async () => {
        const results = await adapter.searchItems('optimize');

        expect(results.length).toBeGreaterThanOrEqual(1);
        // Results should be sorted by score descending
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      });

      it('should return empty array for no matches', async () => {
        const results = await adapter.searchItems('xyznonexistent');
        expect(results).toHaveLength(0);
      });
    });

    describe('bulkUpdateItems', () => {
      it('should update multiple items', async () => {
        const item1 = await adapter.createItem({ decision: 'One', priority: 'low' });
        const item2 = await adapter.createItem({ decision: 'Two', priority: 'low' });
        await adapter.createItem({ decision: 'Three', priority: 'low' });

        const result = await adapter.bulkUpdateItems([item1.id, item2.id], { priority: 'high' });

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);

        const updated1 = await adapter.getItem(item1.id);
        const updated2 = await adapter.getItem(item2.id);
        expect(updated1?.priority).toBe('high');
        expect(updated2?.priority).toBe('high');
      });

      it('should report failed updates', async () => {
        const item1 = await adapter.createItem({ decision: 'One' });

        const result = await adapter.bulkUpdateItems([item1.id, 999], { priority: 'high' });

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].id).toBe(999);
      });
    });

    describe('bulkDeleteItems', () => {
      it('should delete multiple items', async () => {
        const item1 = await adapter.createItem({ decision: 'One' });
        const item2 = await adapter.createItem({ decision: 'Two' });
        const item3 = await adapter.createItem({ decision: 'Three' });

        const result = await adapter.bulkDeleteItems([item1.id, item2.id], true);

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);

        const remaining = await adapter.listItems();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(item3.id);
      });
    });
  });

  describe('Dependency Operations', () => {
    let item1Id: number;
    let item2Id: number;
    let item3Id: number;

    beforeEach(async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });
      const item3 = await adapter.createItem({ decision: 'Item 3' });
      item1Id = item1.id;
      item2Id = item2.id;
      item3Id = item3.id;
    });

    describe('createDependency', () => {
      it('should create a dependency', async () => {
        const dep = await adapter.createDependency({
          itemId: item1Id,
          dependsOnId: item2Id,
          type: 'blocks',
        });

        expect(dep.itemId).toBe(item1Id);
        expect(dep.dependsOnId).toBe(item2Id);
        expect(dep.type).toBe('blocks');
        expect(dep.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('getDependencies', () => {
      it('should get dependencies for an item', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item3Id, type: 'relates-to' });

        const deps = await adapter.getDependencies(item1Id);

        expect(deps).toHaveLength(2);
        expect(deps.map(d => d.dependsOnId)).toContain(item2Id);
        expect(deps.map(d => d.dependsOnId)).toContain(item3Id);
      });
    });

    describe('getDependents', () => {
      it('should get dependents of an item', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });
        await adapter.createDependency({ itemId: item3Id, dependsOnId: item2Id, type: 'blocks' });

        const dependents = await adapter.getDependents(item2Id);

        expect(dependents).toHaveLength(2);
        expect(dependents.map(d => d.itemId)).toContain(item1Id);
        expect(dependents.map(d => d.itemId)).toContain(item3Id);
      });
    });

    describe('wouldCreateCycle', () => {
      it('should detect direct cycle', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });

        const wouldCycle = await adapter.wouldCreateCycle(item2Id, item1Id);
        expect(wouldCycle).toBe(true);
      });

      it('should detect transitive cycle', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });
        await adapter.createDependency({ itemId: item2Id, dependsOnId: item3Id, type: 'blocks' });

        const wouldCycle = await adapter.wouldCreateCycle(item3Id, item1Id);
        expect(wouldCycle).toBe(true);
      });

      it('should return false for non-cycle', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });

        const wouldCycle = await adapter.wouldCreateCycle(item1Id, item3Id);
        expect(wouldCycle).toBe(false);
      });
    });

    describe('deleteDependency', () => {
      it('should delete a dependency', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });

        await adapter.deleteDependency(item1Id, item2Id);

        const deps = await adapter.getDependencies(item1Id);
        expect(deps).toHaveLength(0);
      });
    });

    describe('getBlockedItems', () => {
      it('should return items with unresolved blocking dependencies', async () => {
        // Item 1 depends on Item 2 (blocking)
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });

        const blocked = await adapter.getBlockedItems();

        expect(blocked.map(i => i.id)).toContain(item1Id);
      });

      it('should not return items where blockers are done', async () => {
        await adapter.createDependency({ itemId: item1Id, dependsOnId: item2Id, type: 'blocks' });
        // Mark item2 as done
        await adapter.updateItem(item2Id, { status: 'done' });

        const blocked = await adapter.getBlockedItems();

        expect(blocked.map(i => i.id)).not.toContain(item1Id);
      });
    });
  });

  describe('Retrospective Operations', () => {
    let itemId: number;

    beforeEach(async () => {
      const item = await adapter.createItem({ decision: 'Test decision' });
      itemId = item.id;
    });

    describe('saveRetrospective', () => {
      it('should create a retrospective', async () => {
        const retro = await adapter.saveRetrospective({
          itemId,
          outcome: 'success',
          lessonsLearned: 'Great outcome',
          impactTimeSaved: 120,
          impactCostSaved: 500,
        });

        expect(retro.itemId).toBe(itemId);
        expect(retro.outcome).toBe('success');
        expect(retro.lessonsLearned).toBe('Great outcome');
        expect(retro.impactTimeSaved).toBe(120);
        expect(retro.completedAt).toBeInstanceOf(Date);
      });

      it('should update existing retrospective', async () => {
        await adapter.saveRetrospective({
          itemId,
          outcome: 'success',
          lessonsLearned: 'Initial',
        });

        const updated = await adapter.saveRetrospective({
          itemId,
          outcome: 'partial',
          lessonsLearned: 'Updated lessons',
        });

        expect(updated.outcome).toBe('partial');
        expect(updated.lessonsLearned).toBe('Updated lessons');

        // Should only have one retro for this item
        const all = await adapter.listRetrospectives();
        const forItem = all.filter(r => r.itemId === itemId);
        expect(forItem).toHaveLength(1);
      });
    });

    describe('getRetrospective', () => {
      it('should return retrospective for item', async () => {
        await adapter.saveRetrospective({
          itemId,
          outcome: 'success',
          lessonsLearned: 'Test',
        });

        const retro = await adapter.getRetrospective(itemId);

        expect(retro).not.toBeNull();
        expect(retro?.outcome).toBe('success');
      });

      it('should return null for item without retrospective', async () => {
        const retro = await adapter.getRetrospective(itemId);
        expect(retro).toBeNull();
      });
    });

    describe('getRetrospectiveStats', () => {
      it('should calculate statistics', async () => {
        const item2 = await adapter.createItem({ decision: 'Item 2' });
        const item3 = await adapter.createItem({ decision: 'Item 3' });

        await adapter.saveRetrospective({ itemId, outcome: 'success', effortEstimated: 100, effortActual: 80 });
        await adapter.saveRetrospective({ itemId: item2.id, outcome: 'success', effortEstimated: 50, effortActual: 60 });
        await adapter.saveRetrospective({ itemId: item3.id, outcome: 'failure', effortEstimated: 30, effortActual: 50 });

        const stats = await adapter.getRetrospectiveStats();

        expect(stats.total).toBe(3);
        expect(stats.byOutcome['success']).toBe(2);
        expect(stats.byOutcome['failure']).toBe(1);
      });
    });
  });

  describe('Reminder Operations', () => {
    let itemId: number;

    beforeEach(async () => {
      const item = await adapter.createItem({ decision: 'Test decision' });
      itemId = item.id;
    });

    describe('createReminder', () => {
      it('should create a reminder', async () => {
        const reminder = await adapter.createReminder({
          itemId,
          triggerType: 'time',
          triggerConfig: { date: new Date().toISOString() },
        });

        expect(reminder.id).toBeDefined();
        expect(reminder.itemId).toBe(itemId);
        expect(reminder.triggerType).toBe('time');
        expect(reminder.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('getReminder', () => {
      it('should return reminder by ID', async () => {
        const created = await adapter.createReminder({
          itemId,
          triggerType: 'time',
        });

        const retrieved = await adapter.getReminder(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
      });
    });

    describe('getRemindersForItem', () => {
      it('should return all reminders for an item', async () => {
        await adapter.createReminder({ itemId, triggerType: 'time' });
        await adapter.createReminder({ itemId, triggerType: 'dependency' });

        const reminders = await adapter.getRemindersForItem(itemId);

        expect(reminders).toHaveLength(2);
      });
    });

    describe('getActiveReminders', () => {
      it('should return only active reminders', async () => {
        const active = await adapter.createReminder({ itemId, triggerType: 'time' });
        const dismissed = await adapter.createReminder({ itemId, triggerType: 'dependency' });

        await adapter.updateReminder(dismissed.id, { dismissedAt: new Date() });

        const reminders = await adapter.getActiveReminders();

        expect(reminders).toHaveLength(1);
        expect(reminders[0].id).toBe(active.id);
      });
    });

    describe('updateReminder', () => {
      it('should update reminder fields', async () => {
        const created = await adapter.createReminder({ itemId, triggerType: 'time' });

        const updated = await adapter.updateReminder(created.id, {
          triggeredAt: new Date(),
        });

        expect(updated.triggeredAt).toBeInstanceOf(Date);
      });
    });

    describe('deleteReminder', () => {
      it('should delete a reminder', async () => {
        const created = await adapter.createReminder({ itemId, triggerType: 'time' });
        await adapter.deleteReminder(created.id);

        const retrieved = await adapter.getReminder(created.id);
        expect(retrieved).toBeNull();
      });
    });
  });

  describe('Git Link Operations', () => {
    let itemId: number;

    beforeEach(async () => {
      const item = await adapter.createItem({ decision: 'Test decision' });
      itemId = item.id;
    });

    describe('createGitLink', () => {
      it('should create a git link', async () => {
        const link = await adapter.createGitLink({
          itemId,
          commitHash: 'abc123def456',
          commitMessage: 'feat: implement feature',
          commitDate: new Date(),
          repoPath: '/path/to/repo',
        });

        expect(link.id).toBeDefined();
        expect(link.itemId).toBe(itemId);
        expect(link.commitHash).toBe('abc123def456');
        expect(link.detectedAt).toBeInstanceOf(Date);
      });
    });

    describe('getGitLinksForItem', () => {
      it('should return all git links for an item', async () => {
        await adapter.createGitLink({ itemId, commitHash: 'abc123' });
        await adapter.createGitLink({ itemId, commitHash: 'def456' });

        const links = await adapter.getGitLinksForItem(itemId);

        expect(links).toHaveLength(2);
      });
    });

    describe('getGitLinkByCommit', () => {
      it('should return git link by commit hash', async () => {
        await adapter.createGitLink({ itemId, commitHash: 'abc123' });

        const link = await adapter.getGitLinkByCommit('abc123');

        expect(link).not.toBeNull();
        expect(link?.commitHash).toBe('abc123');
      });

      it('should return null for non-existent commit', async () => {
        const link = await adapter.getGitLinkByCommit('nonexistent');
        expect(link).toBeNull();
      });
    });

    describe('isCommitLinked', () => {
      it('should return true if commit is linked to item', async () => {
        await adapter.createGitLink({ itemId, commitHash: 'abc123' });

        const isLinked = await adapter.isCommitLinked('abc123', itemId);
        expect(isLinked).toBe(true);
      });

      it('should return false if commit is not linked', async () => {
        const isLinked = await adapter.isCommitLinked('abc123', itemId);
        expect(isLinked).toBe(false);
      });
    });

    describe('deleteGitLink', () => {
      it('should delete a git link', async () => {
        const created = await adapter.createGitLink({ itemId, commitHash: 'abc123' });
        await adapter.deleteGitLink(created.id);

        const links = await adapter.getGitLinksForItem(itemId);
        expect(links).toHaveLength(0);
      });
    });
  });

  describe('Transaction Operations', () => {
    describe('withTransaction', () => {
      it('should execute operations within transaction', async () => {
        const result = await adapter.withTransaction(async () => {
          const item = await adapter.createItem({ decision: 'In transaction' });
          return item;
        });

        expect(result.decision).toBe('In transaction');

        // Verify item was persisted
        const retrieved = await adapter.getItem(result.id);
        expect(retrieved).not.toBeNull();
      });

      // Note: JSONL doesn't support true rollback, but the API should exist
      it('should provide transaction API', async () => {
        const txId = await adapter.beginTransaction();
        expect(txId).toBeDefined();

        await adapter.commitTransaction(txId);
        // No error means success
      });
    });
  });

  describe('Export/Import Operations', () => {
    describe('exportToJsonl', () => {
      it('should export all data to JSONL format', async () => {
        await adapter.createItem({ decision: 'Item 1' });
        await adapter.createItem({ decision: 'Item 2' });

        const exported = await adapter.exportToJsonl();

        expect(exported).toContain('Item 1');
        expect(exported).toContain('Item 2');
        expect(exported.trim().split('\n').length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('importFromJsonl', () => {
      it('should import data from JSONL format', async () => {
        const jsonl = JSON.stringify({
          id: 1,
          decision: 'Imported item',
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        const result = await adapter.importFromJsonl(jsonl, false);

        expect(result.success).toBe(1);
        expect(result.failed).toBe(0);

        const items = await adapter.listItems();
        expect(items.some(i => i.decision === 'Imported item')).toBe(true);
      });
    });
  });

  describe('Metadata Operations', () => {
    describe('getMetadata', () => {
      it('should return storage metadata', async () => {
        await adapter.createItem({ decision: 'Test' });

        const metadata = await adapter.getMetadata();

        expect(metadata.version).toBeDefined();
        expect(metadata.itemCount).toBe(1);
        expect(metadata.storageType).toBe('jsonl');
      });
    });
  });
});
