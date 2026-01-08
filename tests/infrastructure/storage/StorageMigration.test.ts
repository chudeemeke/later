/**
 * Storage Migration Tests
 *
 * Tests for migrating from JSONL to SQLite storage.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StorageMigration, MigrationResult, MigrationOptions } from '../../../src/infrastructure/storage/StorageMigration.js';
import { JSONLStorageAdapter } from '../../../src/infrastructure/storage/JSONLStorageAdapter.js';
import { SQLiteStorageAdapter } from '../../../src/infrastructure/storage/SQLiteStorageAdapter.js';

describe('StorageMigration', () => {
  let testDir: string;
  let jsonlAdapter: JSONLStorageAdapter;
  let sqliteAdapter: SQLiteStorageAdapter;
  let migration: StorageMigration;

  beforeEach(async () => {
    // Create unique temp directory
    testDir = path.join(os.tmpdir(), `later-migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Initialize adapters
    jsonlAdapter = new JSONLStorageAdapter(testDir);
    await jsonlAdapter.initialize();

    sqliteAdapter = new SQLiteStorageAdapter(testDir);
    await sqliteAdapter.initialize();

    migration = new StorageMigration(jsonlAdapter, sqliteAdapter, testDir);
  });

  afterEach(async () => {
    await jsonlAdapter.close();
    await sqliteAdapter.close();

    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('canMigrate', () => {
    it('should return true when JSONL has data', async () => {
      await jsonlAdapter.createItem({ decision: 'Test item' });
      const result = await migration.canMigrate();
      expect(result.canMigrate).toBe(true);
      expect(result.itemCount).toBe(1);
    });

    it('should return false when JSONL is empty', async () => {
      const result = await migration.canMigrate();
      expect(result.canMigrate).toBe(false);
      expect(result.itemCount).toBe(0);
    });

    it('should warn if SQLite already has data', async () => {
      await jsonlAdapter.createItem({ decision: 'JSONL item' });
      await sqliteAdapter.createItem({ decision: 'SQLite item' });

      const result = await migration.canMigrate();
      expect(result.canMigrate).toBe(true);
      expect(result.warnings).toContain('SQLite database already contains 1 item(s)');
    });
  });

  describe('migrate', () => {
    it('should migrate items from JSONL to SQLite', async () => {
      // Create items in JSONL
      await jsonlAdapter.createItem({
        decision: 'Item 1',
        context: 'Context 1',
        tags: ['tag1', 'tag2'],
        priority: 'high',
      });
      await jsonlAdapter.createItem({
        decision: 'Item 2',
        context: 'Context 2',
        tags: ['tag3'],
        priority: 'low',
      });

      // Migrate
      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.itemsMigrated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify items in SQLite
      const sqliteItems = await sqliteAdapter.listItems();
      expect(sqliteItems).toHaveLength(2);

      const item1 = sqliteItems.find(i => i.decision === 'Item 1');
      expect(item1).toBeDefined();
      expect(item1?.context).toBe('Context 1');
      expect(item1?.tags).toEqual(['tag1', 'tag2']);
      expect(item1?.priority).toBe('high');
    });

    it('should preserve item IDs during migration', async () => {
      const item1 = await jsonlAdapter.createItem({ decision: 'Item 1' });
      const item2 = await jsonlAdapter.createItem({ decision: 'Item 2' });

      await migration.migrate();

      const sqliteItem1 = await sqliteAdapter.getItem(item1.id);
      const sqliteItem2 = await sqliteAdapter.getItem(item2.id);

      expect(sqliteItem1?.decision).toBe('Item 1');
      expect(sqliteItem2?.decision).toBe('Item 2');
    });

    it('should preserve timestamps during migration', async () => {
      const item = await jsonlAdapter.createItem({ decision: 'Test' });
      const originalCreatedAt = item.createdAt;
      const originalUpdatedAt = item.updatedAt;

      await migration.migrate();

      const migratedItem = await sqliteAdapter.getItem(item.id);
      expect(migratedItem?.createdAt.toISOString()).toBe(originalCreatedAt.toISOString());
      expect(migratedItem?.updatedAt.toISOString()).toBe(originalUpdatedAt.toISOString());
    });

    it('should migrate all item fields', async () => {
      await jsonlAdapter.createItem({
        decision: 'Full item',
        context: 'Full context',
        tags: ['tag1', 'tag2', 'tag3'],
        priority: 'high',
        conversationId: 'conv-123',
        dependencies: [1, 2, 3],
      });

      await migration.migrate();

      const items = await sqliteAdapter.listItems();
      expect(items).toHaveLength(1);

      const item = items[0];
      expect(item.decision).toBe('Full item');
      expect(item.context).toBe('Full context');
      expect(item.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(item.priority).toBe('high');
      expect(item.conversationId).toBe('conv-123');
      expect(item.dependencies).toEqual([1, 2, 3]);
    });

    it('should create backup when requested', async () => {
      await jsonlAdapter.createItem({ decision: 'Test' });

      const result = await migration.migrate({ createBackup: true });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);
    });

    it('should handle empty JSONL gracefully', async () => {
      const result = await migration.migrate();

      expect(result.success).toBe(true);
      expect(result.itemsMigrated).toBe(0);
      expect(result.warnings).toContain('No items to migrate');
    });

    it('should not duplicate items if run multiple times', async () => {
      await jsonlAdapter.createItem({ decision: 'Test' });

      // First migration
      await migration.migrate({ clearTarget: true });

      // Second migration with clearTarget
      await migration.migrate({ clearTarget: true });

      const items = await sqliteAdapter.listItems();
      expect(items).toHaveLength(1);
    });

    it('should merge items when merge option is set', async () => {
      // Add item to SQLite first
      await sqliteAdapter.createItem({ decision: 'Existing SQLite item' });

      // Add items to JSONL
      await jsonlAdapter.createItem({ decision: 'JSONL item 1' });
      await jsonlAdapter.createItem({ decision: 'JSONL item 2' });

      // Migrate with merge
      const result = await migration.migrate({ merge: true });

      expect(result.success).toBe(true);
      expect(result.itemsMigrated).toBe(2);

      // Should have all 3 items
      const items = await sqliteAdapter.listItems();
      expect(items).toHaveLength(3);
    });

    it('should clear target when clearTarget is true', async () => {
      // Add item to SQLite first
      await sqliteAdapter.createItem({ decision: 'Existing SQLite item' });

      // Add item to JSONL
      await jsonlAdapter.createItem({ decision: 'JSONL item' });

      // Migrate with clearTarget
      const result = await migration.migrate({ clearTarget: true });

      expect(result.success).toBe(true);
      expect(result.itemsMigrated).toBe(1);

      // Should only have the migrated item
      const items = await sqliteAdapter.listItems();
      expect(items).toHaveLength(1);
      expect(items[0].decision).toBe('JSONL item');
    });

    it('should report migration statistics', async () => {
      // Create items with various properties
      await jsonlAdapter.createItem({ decision: 'Item 1', priority: 'high', tags: ['tag1'] });
      await jsonlAdapter.createItem({ decision: 'Item 2', priority: 'medium' });
      await jsonlAdapter.createItem({ decision: 'Item 3', priority: 'low' });

      const result = await migration.migrate();

      expect(result.stats).toBeDefined();
      expect(result.stats.byPriority).toEqual({ high: 1, medium: 1, low: 1 });
      expect(result.stats.byStatus.pending).toBe(3);
    });
  });

  describe('rollback', () => {
    it('should rollback migration from backup', async () => {
      // Create and migrate items
      await jsonlAdapter.createItem({ decision: 'Original item' });
      const migrateResult = await migration.migrate({ createBackup: true });

      // Modify SQLite data
      await sqliteAdapter.createItem({ decision: 'New SQLite item' });

      // Rollback
      const rollbackResult = await migration.rollback(migrateResult.backupPath!);

      expect(rollbackResult.success).toBe(true);

      // Verify SQLite is back to migrated state
      const items = await sqliteAdapter.listItems();
      // After rollback, SQLite should have only the original migrated item
      expect(items.some(i => i.decision === 'Original item')).toBe(true);
    });

    it('should fail rollback without backup path', async () => {
      const result = await migration.rollback('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup path required');
    });

    it('should fail rollback with non-existent backup', async () => {
      const result = await migration.rollback('/non/existent/path.jsonl');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup file not found');
    });
  });

  describe('validateMigration', () => {
    it('should validate successful migration', async () => {
      // Create items in JSONL
      await jsonlAdapter.createItem({ decision: 'Item 1' });
      await jsonlAdapter.createItem({ decision: 'Item 2' });

      // Migrate
      await migration.migrate();

      // Validate
      const validation = await migration.validateMigration();

      expect(validation.valid).toBe(true);
      expect(validation.sourceCount).toBe(2);
      expect(validation.targetCount).toBe(2);
      expect(validation.missingItems).toHaveLength(0);
    });

    it('should detect missing items after migration', async () => {
      // Create items in JSONL
      const item1 = await jsonlAdapter.createItem({ decision: 'Item 1' });
      await jsonlAdapter.createItem({ decision: 'Item 2' });

      // Migrate
      await migration.migrate();

      // Delete one item from SQLite
      await sqliteAdapter.deleteItem(item1.id, true);

      // Validate
      const validation = await migration.validateMigration();

      expect(validation.valid).toBe(false);
      expect(validation.missingItems).toContain(item1.id);
    });

    it('should validate data integrity', async () => {
      // Create item in JSONL
      await jsonlAdapter.createItem({
        decision: 'Test item',
        context: 'Test context',
        priority: 'high',
        tags: ['tag1', 'tag2'],
      });

      // Migrate
      await migration.migrate();

      // Validate with integrity check
      const validation = await migration.validateMigration({ checkDataIntegrity: true });

      expect(validation.valid).toBe(true);
      expect(validation.integrityErrors).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('should report migration status', async () => {
      await jsonlAdapter.createItem({ decision: 'Item 1' });
      await jsonlAdapter.createItem({ decision: 'Item 2' });
      await sqliteAdapter.createItem({ decision: 'SQLite item' });

      const status = await migration.getStatus();

      expect(status.jsonlItemCount).toBe(2);
      expect(status.sqliteItemCount).toBe(1);
      expect(status.isMigrated).toBe(false);
    });

    it('should detect completed migration', async () => {
      await jsonlAdapter.createItem({ decision: 'Item 1' });
      await migration.migrate();

      const status = await migration.getStatus();

      expect(status.isMigrated).toBe(true);
    });
  });
});
