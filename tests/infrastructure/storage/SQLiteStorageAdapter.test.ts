/**
 * SQLite Storage Adapter Tests
 *
 * TDD tests for SQLiteStorageAdapter implementing IStoragePort.
 * Uses Bun's native SQLite module with FTS5 for full-text search.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SQLiteStorageAdapter } from '../../../src/infrastructure/storage/SQLiteStorageAdapter.js';
import type { ItemFilter, ItemSort, PaginationOptions } from '../../../src/domain/ports/IStoragePort.js';
import type { StatusValue } from '../../../src/domain/value-objects/Status.js';
import type { PriorityValue } from '../../../src/domain/value-objects/Priority.js';

describe('SQLiteStorageAdapter', () => {
  let adapter: SQLiteStorageAdapter;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = path.join(os.tmpdir(), `later-sqlite-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
    adapter = new SQLiteStorageAdapter(testDir);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  // ===========================================
  // Initialization & Lifecycle
  // ===========================================

  describe('initialization', () => {
    it('should create database file on initialize', async () => {
      const dbPath = path.join(testDir, 'later.db');
      const stat = await fs.stat(dbPath);
      expect(stat.isFile()).toBe(true);
    });

    it('should create all required tables', async () => {
      // Verify metadata indicates sqlite storage
      const metadata = await adapter.getMetadata();
      expect(metadata.storageType).toBe('sqlite');
      expect(metadata.itemCount).toBe(0);
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      await adapter.initialize();
      await adapter.initialize();
      const metadata = await adapter.getMetadata();
      expect(metadata.storageType).toBe('sqlite');
    });

    it('should close without error', async () => {
      await expect(adapter.close()).resolves.not.toThrow();
    });
  });

  // ===========================================
  // Item CRUD Operations
  // ===========================================

  describe('createItem', () => {
    it('should create item with auto-generated ID', async () => {
      const item = await adapter.createItem({
        decision: 'Test decision',
        context: 'Test context',
      });

      expect(item.id).toBe(1);
      expect(item.decision).toBe('Test decision');
      expect(item.context).toBe('Test context');
      expect(item.status).toBe('pending');
      expect(item.priority).toBe('medium');
      expect(item.tags).toEqual([]);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('should auto-increment IDs', async () => {
      const item1 = await adapter.createItem({ decision: 'Decision 1' });
      const item2 = await adapter.createItem({ decision: 'Decision 2' });
      const item3 = await adapter.createItem({ decision: 'Decision 3' });

      expect(item1.id).toBe(1);
      expect(item2.id).toBe(2);
      expect(item3.id).toBe(3);
    });

    it('should save all optional fields', async () => {
      const item = await adapter.createItem({
        decision: 'Test decision',
        context: 'Test context',
        tags: ['tag1', 'tag2'],
        priority: 'high',
        conversationId: 'conv-123',
        dependencies: [1, 2, 3],
      });

      expect(item.tags).toEqual(['tag1', 'tag2']);
      expect(item.priority).toBe('high');
      expect(item.conversationId).toBe('conv-123');
      expect(item.dependencies).toEqual([1, 2, 3]);
    });
  });

  describe('getItem', () => {
    it('should retrieve item by ID', async () => {
      const created = await adapter.createItem({
        decision: 'Test decision',
        context: 'Test context',
      });

      const retrieved = await adapter.getItem(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.decision).toBe('Test decision');
    });

    it('should return null for non-existent item', async () => {
      const retrieved = await adapter.getItem(9999);
      expect(retrieved).toBeNull();
    });
  });

  describe('getItems', () => {
    it('should retrieve multiple items by IDs', async () => {
      const item1 = await adapter.createItem({ decision: 'Decision 1' });
      const item2 = await adapter.createItem({ decision: 'Decision 2' });
      await adapter.createItem({ decision: 'Decision 3' });

      const items = await adapter.getItems([item1.id, item2.id]);

      expect(items).toHaveLength(2);
      expect(items.map(i => i.id)).toContain(item1.id);
      expect(items.map(i => i.id)).toContain(item2.id);
    });

    it('should skip non-existent IDs', async () => {
      const item1 = await adapter.createItem({ decision: 'Decision 1' });

      const items = await adapter.getItems([item1.id, 9999]);

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(item1.id);
    });

    it('should return empty array for empty input', async () => {
      const items = await adapter.getItems([]);
      expect(items).toEqual([]);
    });
  });

  describe('updateItem', () => {
    it('should update item fields', async () => {
      const created = await adapter.createItem({
        decision: 'Original decision',
        context: 'Original context',
      });

      const updated = await adapter.updateItem(created.id, {
        decision: 'Updated decision',
        context: 'Updated context',
        status: 'in-progress' as StatusValue,
        priority: 'high' as PriorityValue,
        tags: ['updated'],
      });

      expect(updated.decision).toBe('Updated decision');
      expect(updated.context).toBe('Updated context');
      expect(updated.status).toBe('in-progress');
      expect(updated.priority).toBe('high');
      expect(updated.tags).toEqual(['updated']);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        adapter.updateItem(9999, { decision: 'Updated' })
      ).rejects.toThrow('not found');
    });

    it('should only update specified fields', async () => {
      const created = await adapter.createItem({
        decision: 'Original',
        context: 'Original context',
        tags: ['original'],
      });

      const updated = await adapter.updateItem(created.id, {
        decision: 'Updated',
      });

      expect(updated.decision).toBe('Updated');
      expect(updated.context).toBe('Original context'); // Unchanged
      expect(updated.tags).toEqual(['original']); // Unchanged
    });
  });

  describe('deleteItem', () => {
    it('should soft delete by default (archive)', async () => {
      const item = await adapter.createItem({ decision: 'To be deleted' });

      await adapter.deleteItem(item.id);

      const retrieved = await adapter.getItem(item.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.status).toBe('archived');
    });

    it('should hard delete when specified', async () => {
      const item = await adapter.createItem({ decision: 'To be deleted' });

      await adapter.deleteItem(item.id, true);

      const retrieved = await adapter.getItem(item.id);
      expect(retrieved).toBeNull();
    });
  });

  // ===========================================
  // Listing & Filtering
  // ===========================================

  describe('listItems', () => {
    beforeEach(async () => {
      // Create test data
      await adapter.createItem({ decision: 'High priority pending', priority: 'high', tags: ['work'] });
      await adapter.createItem({ decision: 'Medium priority pending', priority: 'medium', tags: ['personal'] });
      await adapter.createItem({ decision: 'Low priority pending', priority: 'low', tags: ['work', 'urgent'] });

      // Update one to in-progress
      const items = await adapter.listItems();
      await adapter.updateItem(items[0].id, { status: 'in-progress' });
    });

    it('should list all items without filters', async () => {
      const items = await adapter.listItems();
      expect(items.length).toBe(3);
    });

    it('should filter by status', async () => {
      const filter: ItemFilter = { status: 'pending' };
      const items = await adapter.listItems(filter);

      expect(items.length).toBe(2);
      expect(items.every(i => i.status === 'pending')).toBe(true);
    });

    it('should filter by multiple statuses', async () => {
      const filter: ItemFilter = { status: ['pending', 'in-progress'] };
      const items = await adapter.listItems(filter);

      expect(items.length).toBe(3);
    });

    it('should filter by priority', async () => {
      const filter: ItemFilter = { priority: 'high' };
      const items = await adapter.listItems(filter);

      expect(items.length).toBe(1);
      expect(items[0].priority).toBe('high');
    });

    it('should filter by tag', async () => {
      const filter: ItemFilter = { hasTag: 'work' };
      const items = await adapter.listItems(filter);

      expect(items.length).toBe(2);
      expect(items.every(i => i.tags.includes('work'))).toBe(true);
    });

    it('should filter by multiple tags (any match)', async () => {
      const filter: ItemFilter = { tags: ['work', 'personal'] };
      const items = await adapter.listItems(filter);

      expect(items.length).toBe(3);
    });

    it('should sort by createdAt ascending', async () => {
      const sort: ItemSort = { field: 'createdAt', direction: 'asc' };
      const items = await adapter.listItems(undefined, sort);

      for (let i = 1; i < items.length; i++) {
        expect(items[i].createdAt.getTime()).toBeGreaterThanOrEqual(items[i - 1].createdAt.getTime());
      }
    });

    it('should sort by priority descending', async () => {
      const sort: ItemSort = { field: 'priority', direction: 'desc' };
      const items = await adapter.listItems(undefined, sort);

      // High (3) > Medium (2) > Low (1)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      for (let i = 1; i < items.length; i++) {
        const prevPriority = priorityOrder[items[i - 1].priority as keyof typeof priorityOrder];
        const currPriority = priorityOrder[items[i].priority as keyof typeof priorityOrder];
        expect(currPriority).toBeLessThanOrEqual(prevPriority);
      }
    });

    it('should apply pagination', async () => {
      const pagination: PaginationOptions = { limit: 2, offset: 0 };
      const page1 = await adapter.listItems(undefined, undefined, pagination);

      expect(page1.length).toBe(2);

      const page2 = await adapter.listItems(undefined, undefined, { limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    it('should combine filters, sort, and pagination', async () => {
      const filter: ItemFilter = { status: 'pending' };
      const sort: ItemSort = { field: 'priority', direction: 'desc' };
      const pagination: PaginationOptions = { limit: 1 };

      const items = await adapter.listItems(filter, sort, pagination);

      expect(items.length).toBe(1);
      expect(items[0].status).toBe('pending');
    });
  });

  describe('countItems', () => {
    it('should count all items', async () => {
      await adapter.createItem({ decision: 'Item 1' });
      await adapter.createItem({ decision: 'Item 2' });
      await adapter.createItem({ decision: 'Item 3' });

      const count = await adapter.countItems();
      expect(count).toBe(3);
    });

    it('should count with filter', async () => {
      await adapter.createItem({ decision: 'High', priority: 'high' });
      await adapter.createItem({ decision: 'Medium', priority: 'medium' });
      await adapter.createItem({ decision: 'Low', priority: 'low' });

      const count = await adapter.countItems({ priority: 'high' });
      expect(count).toBe(1);
    });
  });

  // ===========================================
  // Full-Text Search (FTS5)
  // ===========================================

  describe('searchItems (FTS5)', () => {
    beforeEach(async () => {
      await adapter.createItem({
        decision: 'Optimize database performance',
        context: 'PostgreSQL query optimization needed for slow reports',
        tags: ['database', 'performance'],
      });
      await adapter.createItem({
        decision: 'Upgrade React version',
        context: 'Need to migrate from React 17 to React 18',
        tags: ['frontend', 'react'],
      });
      await adapter.createItem({
        decision: 'Add caching layer',
        context: 'Redis caching for database queries to improve performance',
        tags: ['database', 'caching'],
      });
    });

    it('should find items matching decision text', async () => {
      const results = await adapter.searchItems('database');

      expect(results.length).toBe(2);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should find items matching context text', async () => {
      const results = await adapter.searchItems('Redis');

      expect(results.length).toBe(1);
      expect(results[0].item.decision).toContain('caching');
    });

    it('should rank decision matches higher than context', async () => {
      const results = await adapter.searchItems('performance');

      expect(results.length).toBe(2);
      // Item with "performance" in decision should rank higher
      expect(results[0].item.decision).toContain('performance');
    });

    it('should search across tags', async () => {
      const results = await adapter.searchItems('frontend');

      expect(results.length).toBe(1);
      expect(results[0].item.tags).toContain('frontend');
    });

    it('should support multi-word queries', async () => {
      const results = await adapter.searchItems('React upgrade');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.decision).toContain('React');
    });

    it('should apply additional filters', async () => {
      await adapter.updateItem(1, { status: 'done' });

      const results = await adapter.searchItems('database', { status: 'pending' });

      expect(results.length).toBe(1);
      expect(results[0].item.status).toBe('pending');
    });

    it('should apply pagination to results', async () => {
      const results = await adapter.searchItems('database', undefined, { limit: 1 });

      expect(results.length).toBe(1);
    });

    it('should return empty array for no matches', async () => {
      const results = await adapter.searchItems('nonexistent');

      expect(results).toEqual([]);
    });

    it('should provide highlights for matches', async () => {
      const results = await adapter.searchItems('database');

      expect(results[0].highlights).toBeDefined();
      expect(results[0].highlights!.length).toBeGreaterThan(0);
    });
  });

  // ===========================================
  // Bulk Operations
  // ===========================================

  describe('bulkUpdateItems', () => {
    it('should update multiple items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      const result = await adapter.bulkUpdateItems(
        [item1.id, item2.id],
        { priority: 'high' }
      );

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);

      const updated1 = await adapter.getItem(item1.id);
      const updated2 = await adapter.getItem(item2.id);

      expect(updated1!.priority).toBe('high');
      expect(updated2!.priority).toBe('high');
    });

    it('should report failures for non-existent items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });

      const result = await adapter.bulkUpdateItems(
        [item1.id, 9999],
        { priority: 'high' }
      );

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe(9999);
    });
  });

  describe('bulkDeleteItems', () => {
    it('should soft delete multiple items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      const result = await adapter.bulkDeleteItems([item1.id, item2.id]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);

      const retrieved1 = await adapter.getItem(item1.id);
      const retrieved2 = await adapter.getItem(item2.id);

      expect(retrieved1!.status).toBe('archived');
      expect(retrieved2!.status).toBe('archived');
    });

    it('should hard delete multiple items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      const result = await adapter.bulkDeleteItems([item1.id, item2.id], true);

      expect(result.success).toBe(2);

      const retrieved1 = await adapter.getItem(item1.id);
      const retrieved2 = await adapter.getItem(item2.id);

      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });

  // ===========================================
  // Dependency Operations
  // ===========================================

  describe('dependencies', () => {
    it('should create dependency', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      const dep = await adapter.createDependency({
        itemId: item1.id,
        dependsOnId: item2.id,
        type: 'blocks',
      });

      expect(dep.itemId).toBe(item1.id);
      expect(dep.dependsOnId).toBe(item2.id);
      expect(dep.type).toBe('blocks');
      expect(dep.createdAt).toBeInstanceOf(Date);
    });

    it('should get dependencies for item', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });
      const item3 = await adapter.createItem({ decision: 'Item 3' });

      await adapter.createDependency({ itemId: item1.id, dependsOnId: item2.id });
      await adapter.createDependency({ itemId: item1.id, dependsOnId: item3.id });

      const deps = await adapter.getDependencies(item1.id);

      expect(deps).toHaveLength(2);
      expect(deps.map(d => d.dependsOnId)).toContain(item2.id);
      expect(deps.map(d => d.dependsOnId)).toContain(item3.id);
    });

    it('should get dependents of item', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });
      const item3 = await adapter.createItem({ decision: 'Item 3' });

      await adapter.createDependency({ itemId: item2.id, dependsOnId: item1.id });
      await adapter.createDependency({ itemId: item3.id, dependsOnId: item1.id });

      const dependents = await adapter.getDependents(item1.id);

      expect(dependents).toHaveLength(2);
      expect(dependents.map(d => d.itemId)).toContain(item2.id);
      expect(dependents.map(d => d.itemId)).toContain(item3.id);
    });

    it('should detect cycles', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });
      const item3 = await adapter.createItem({ decision: 'Item 3' });

      // item1 -> item2 -> item3
      await adapter.createDependency({ itemId: item1.id, dependsOnId: item2.id });
      await adapter.createDependency({ itemId: item2.id, dependsOnId: item3.id });

      // Adding item3 -> item1 would create cycle
      const wouldCycle = await adapter.wouldCreateCycle(item3.id, item1.id);
      expect(wouldCycle).toBe(true);

      // Adding item1 -> item3 would not create cycle (different direction)
      const noLoop = await adapter.wouldCreateCycle(item1.id, item3.id);
      expect(noLoop).toBe(false);
    });

    it('should delete dependency', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      await adapter.createDependency({ itemId: item1.id, dependsOnId: item2.id });

      await adapter.deleteDependency(item1.id, item2.id);

      const deps = await adapter.getDependencies(item1.id);
      expect(deps).toHaveLength(0);
    });

    it('should get blocked items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Blocking item' });

      await adapter.createDependency({ itemId: item1.id, dependsOnId: item2.id, type: 'blocks' });

      const blocked = await adapter.getBlockedItems();

      expect(blocked).toHaveLength(1);
      expect(blocked[0].id).toBe(item1.id);
    });

    it('should not include items blocked by done items', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Blocking item' });

      await adapter.createDependency({ itemId: item1.id, dependsOnId: item2.id, type: 'blocks' });

      // Mark blocker as done
      await adapter.updateItem(item2.id, { status: 'done' });

      const blocked = await adapter.getBlockedItems();

      expect(blocked).toHaveLength(0);
    });
  });

  // ===========================================
  // Retrospective Operations
  // ===========================================

  describe('retrospectives', () => {
    it('should save retrospective', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      const retro = await adapter.saveRetrospective({
        itemId: item.id,
        outcome: 'success',
        lessonsLearned: 'Test lesson',
        effortEstimated: 60,
        effortActual: 90,
      });

      expect(retro.itemId).toBe(item.id);
      expect(retro.outcome).toBe('success');
      expect(retro.lessonsLearned).toBe('Test lesson');
      expect(retro.effortEstimated).toBe(60);
      expect(retro.effortActual).toBe(90);
      expect(retro.completedAt).toBeInstanceOf(Date);
    });

    it('should update existing retrospective', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.saveRetrospective({
        itemId: item.id,
        outcome: 'success',
        lessonsLearned: 'Original lesson',
      });

      const updated = await adapter.saveRetrospective({
        itemId: item.id,
        outcome: 'partial',
        lessonsLearned: 'Updated lesson',
      });

      expect(updated.outcome).toBe('partial');
      expect(updated.lessonsLearned).toBe('Updated lesson');

      // Should only have one retrospective
      const retros = await adapter.listRetrospectives();
      expect(retros).toHaveLength(1);
    });

    it('should get retrospective for item', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.saveRetrospective({
        itemId: item.id,
        outcome: 'success',
      });

      const retro = await adapter.getRetrospective(item.id);

      expect(retro).not.toBeNull();
      expect(retro!.itemId).toBe(item.id);
    });

    it('should return null for non-existent retrospective', async () => {
      const retro = await adapter.getRetrospective(9999);
      expect(retro).toBeNull();
    });

    it('should get retrospective stats', async () => {
      const item1 = await adapter.createItem({ decision: 'Item 1' });
      const item2 = await adapter.createItem({ decision: 'Item 2' });

      await adapter.saveRetrospective({
        itemId: item1.id,
        outcome: 'success',
        effortEstimated: 60,
        effortActual: 90,
      });

      await adapter.saveRetrospective({
        itemId: item2.id,
        outcome: 'failure',
        effortEstimated: 30,
        effortActual: 60,
      });

      const stats = await adapter.getRetrospectiveStats();

      expect(stats.total).toBe(2);
      expect(stats.byOutcome.success).toBe(1);
      expect(stats.byOutcome.failure).toBe(1);
      expect(stats.avgVariance).toBe(30); // Average of (90-60) and (60-30)
    });
  });

  // ===========================================
  // Reminder Operations
  // ===========================================

  describe('reminders', () => {
    it('should create reminder', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      const reminder = await adapter.createReminder({
        itemId: item.id,
        triggerType: 'time',
        triggerConfig: { thresholdDays: 7 },
      });

      expect(reminder.id).toBeDefined();
      expect(reminder.itemId).toBe(item.id);
      expect(reminder.triggerType).toBe('time');
      expect(reminder.createdAt).toBeInstanceOf(Date);
    });

    it('should get reminder by ID', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });
      const created = await adapter.createReminder({
        itemId: item.id,
        triggerType: 'time',
      });

      const retrieved = await adapter.getReminder(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should get reminders for item', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.createReminder({ itemId: item.id, triggerType: 'time' });
      await adapter.createReminder({ itemId: item.id, triggerType: 'dependency' });

      const reminders = await adapter.getRemindersForItem(item.id);

      expect(reminders).toHaveLength(2);
    });

    it('should get active reminders', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      const active = await adapter.createReminder({ itemId: item.id, triggerType: 'time' });
      const dismissed = await adapter.createReminder({ itemId: item.id, triggerType: 'dependency' });

      await adapter.updateReminder(dismissed.id, { dismissedAt: new Date() });

      const activeReminders = await adapter.getActiveReminders();

      expect(activeReminders).toHaveLength(1);
      expect(activeReminders[0].id).toBe(active.id);
    });

    it('should update reminder', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });
      const reminder = await adapter.createReminder({ itemId: item.id, triggerType: 'time' });

      const now = new Date();
      const updated = await adapter.updateReminder(reminder.id, {
        triggeredAt: now,
      });

      expect(updated.triggeredAt).toEqual(now);
    });

    it('should delete reminder', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });
      const reminder = await adapter.createReminder({ itemId: item.id, triggerType: 'time' });

      await adapter.deleteReminder(reminder.id);

      const retrieved = await adapter.getReminder(reminder.id);
      expect(retrieved).toBeNull();
    });
  });

  // ===========================================
  // Git Link Operations
  // ===========================================

  describe('git links', () => {
    it('should create git link', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      const link = await adapter.createGitLink({
        itemId: item.id,
        commitHash: 'abc123',
        commitMessage: 'Test commit',
        repoPath: '/path/to/repo',
      });

      expect(link.id).toBeDefined();
      expect(link.itemId).toBe(item.id);
      expect(link.commitHash).toBe('abc123');
      expect(link.commitMessage).toBe('Test commit');
      expect(link.detectedAt).toBeInstanceOf(Date);
    });

    it('should get git links for item', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.createGitLink({ itemId: item.id, commitHash: 'abc123' });
      await adapter.createGitLink({ itemId: item.id, commitHash: 'def456' });

      const links = await adapter.getGitLinksForItem(item.id);

      expect(links).toHaveLength(2);
    });

    it('should get git link by commit hash', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.createGitLink({ itemId: item.id, commitHash: 'abc123' });

      const link = await adapter.getGitLinkByCommit('abc123');

      expect(link).not.toBeNull();
      expect(link!.commitHash).toBe('abc123');
    });

    it('should check if commit is linked', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });

      await adapter.createGitLink({ itemId: item.id, commitHash: 'abc123' });

      const isLinked = await adapter.isCommitLinked('abc123', item.id);
      expect(isLinked).toBe(true);

      const notLinked = await adapter.isCommitLinked('xyz789', item.id);
      expect(notLinked).toBe(false);
    });

    it('should delete git link', async () => {
      const item = await adapter.createItem({ decision: 'Item 1' });
      const link = await adapter.createGitLink({ itemId: item.id, commitHash: 'abc123' });

      await adapter.deleteGitLink(link.id);

      const retrieved = await adapter.getGitLinkByCommit('abc123');
      expect(retrieved).toBeNull();
    });
  });

  // ===========================================
  // Transaction Operations
  // ===========================================

  describe('transactions', () => {
    it('should support withTransaction for atomic operations', async () => {
      const result = await adapter.withTransaction(async () => {
        const item1 = await adapter.createItem({ decision: 'Item 1' });
        const item2 = await adapter.createItem({ decision: 'Item 2' });
        return [item1, item2];
      });

      expect(result).toHaveLength(2);
      expect(await adapter.countItems()).toBe(2);
    });

    it('should rollback on error', async () => {
      try {
        await adapter.withTransaction(async () => {
          await adapter.createItem({ decision: 'Item 1' });
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      // Should rollback - no items created
      const count = await adapter.countItems();
      expect(count).toBe(0);
    });
  });

  // ===========================================
  // Export/Import Operations
  // ===========================================

  describe('export/import', () => {
    it('should export to JSONL format', async () => {
      await adapter.createItem({ decision: 'Item 1', context: 'Context 1' });
      await adapter.createItem({ decision: 'Item 2', context: 'Context 2' });

      const jsonl = await adapter.exportToJsonl();
      const lines = jsonl.trim().split('\n');

      expect(lines).toHaveLength(2);

      const item1 = JSON.parse(lines[0]);
      const item2 = JSON.parse(lines[1]);

      expect(item1.decision).toBe('Item 1');
      expect(item2.decision).toBe('Item 2');
    });

    it('should import from JSONL (replace mode)', async () => {
      await adapter.createItem({ decision: 'Existing' });

      const jsonl = `{"id":1,"decision":"Imported 1","context":"","status":"pending","tags":[],"priority":"medium","created_at":"2024-01-01T00:00:00.000Z","updated_at":"2024-01-01T00:00:00.000Z"}
{"id":2,"decision":"Imported 2","context":"","status":"pending","tags":[],"priority":"medium","created_at":"2024-01-01T00:00:00.000Z","updated_at":"2024-01-01T00:00:00.000Z"}`;

      const result = await adapter.importFromJsonl(jsonl, false);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);

      const items = await adapter.listItems();
      expect(items).toHaveLength(2);
      expect(items.map(i => i.decision)).toContain('Imported 1');
      expect(items.map(i => i.decision)).not.toContain('Existing');
    });

    it('should import from JSONL (merge mode)', async () => {
      await adapter.createItem({ decision: 'Existing' });

      const jsonl = `{"id":100,"decision":"Imported 1","context":"","status":"pending","tags":[],"priority":"medium","created_at":"2024-01-01T00:00:00.000Z","updated_at":"2024-01-01T00:00:00.000Z"}`;

      const result = await adapter.importFromJsonl(jsonl, true);

      expect(result.success).toBe(1);

      const items = await adapter.listItems();
      expect(items.length).toBe(2);
    });
  });

  // ===========================================
  // Metadata
  // ===========================================

  describe('getMetadata', () => {
    it('should return storage metadata', async () => {
      await adapter.createItem({ decision: 'Item 1' });
      await adapter.createItem({ decision: 'Item 2' });

      const metadata = await adapter.getMetadata();

      expect(metadata.storageType).toBe('sqlite');
      expect(metadata.itemCount).toBe(2);
      expect(metadata.version).toBeDefined();
      expect(metadata.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return null lastUpdated when empty', async () => {
      const metadata = await adapter.getMetadata();

      expect(metadata.itemCount).toBe(0);
      expect(metadata.lastUpdated).toBeNull();
    });
  });
});
