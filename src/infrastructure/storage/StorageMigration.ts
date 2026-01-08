/**
 * Storage Migration
 *
 * Handles migration from JSONL to SQLite storage format.
 * Provides safe, reversible migration with validation.
 *
 * Features:
 * - Backup creation before migration
 * - Rollback support
 * - Validation of migrated data
 * - Progress reporting
 * - Idempotent operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { IStoragePort } from '../../domain/ports/IStoragePort.js';

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Create backup of JSONL before migration */
  createBackup?: boolean;
  /** Clear target SQLite database before migration */
  clearTarget?: boolean;
  /** Merge with existing SQLite data instead of replacing */
  merge?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  errors: Array<{ id: number; error: string }>;
  warnings: string[];
  backupPath?: string;
  stats: MigrationStats;
  durationMs: number;
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  withTags: number;
  withDependencies: number;
  withContext: number;
}

/**
 * Migration validation result
 */
export interface ValidationResult {
  valid: boolean;
  sourceCount: number;
  targetCount: number;
  missingItems: number[];
  integrityErrors: Array<{ id: number; field: string; expected: string; actual: string }>;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  error?: string;
  itemsRestored?: number;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  jsonlItemCount: number;
  sqliteItemCount: number;
  isMigrated: boolean;
  lastMigrationDate?: Date;
}

/**
 * Can migrate result
 */
export interface CanMigrateResult {
  canMigrate: boolean;
  itemCount: number;
  warnings: string[];
}

/**
 * Storage Migration class
 */
export class StorageMigration {
  private source: IStoragePort;
  private target: IStoragePort;
  private dataDir: string;

  constructor(source: IStoragePort, target: IStoragePort, dataDir: string) {
    this.source = source;
    this.target = target;
    this.dataDir = dataDir;
  }

  /**
   * Check if migration is possible
   */
  async canMigrate(): Promise<CanMigrateResult> {
    const warnings: string[] = [];

    const sourceCount = await this.source.countItems();
    const targetCount = await this.target.countItems();

    if (targetCount > 0) {
      warnings.push(`SQLite database already contains ${targetCount} item(s)`);
    }

    return {
      canMigrate: sourceCount > 0,
      itemCount: sourceCount,
      warnings,
    };
  }

  /**
   * Migrate items from JSONL to SQLite
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: Array<{ id: number; error: string }> = [];
    const warnings: string[] = [];

    // Initialize stats
    const stats: MigrationStats = {
      byPriority: {},
      byStatus: {},
      withTags: 0,
      withDependencies: 0,
      withContext: 0,
    };

    // Get source items
    const sourceItems = await this.source.listItems();

    if (sourceItems.length === 0) {
      warnings.push('No items to migrate');
      return {
        success: true,
        itemsMigrated: 0,
        errors: [],
        warnings,
        stats,
        durationMs: Date.now() - startTime,
      };
    }

    // Create backup if requested
    let backupPath: string | undefined;
    if (options.createBackup) {
      backupPath = await this.createBackup();
    }

    // Clear target if requested
    if (options.clearTarget && !options.merge) {
      await this.clearTarget();
    }

    // Build JSONL data for all items
    const jsonlLines: string[] = [];

    for (const item of sourceItems) {
      const jsonlLine = JSON.stringify({
        id: item.id,
        decision: item.decision,
        context: item.context,
        status: item.status,
        tags: item.tags,
        priority: item.priority,
        conversation_id: item.conversationId,
        dependencies: item.dependencies,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
        context_tokens: item.contextTokens,
        context_pii_types: item.contextPiiTypes,
        context_hash: item.contextHash,
        context_files: item.contextFiles,
      });

      jsonlLines.push(jsonlLine);

      // Update stats
      stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
      if (item.tags && item.tags.length > 0) stats.withTags++;
      if (item.dependencies && item.dependencies.length > 0) stats.withDependencies++;
      if (item.context && item.context.length > 0) stats.withContext++;
    }

    // Migrate all items at once
    let itemsMigrated = 0;

    try {
      const jsonlData = jsonlLines.join('\n');
      // Import using SQLite adapter's importFromJsonl
      // When merge is true, we append to existing data
      // When merge is false (or clearTarget was used), we replace
      const importResult = await this.target.importFromJsonl(jsonlData, options.merge);
      itemsMigrated = importResult.success;

      // Add any import errors
      for (const importError of importResult.errors) {
        errors.push(importError);
      }

      // Report progress
      if (options.onProgress) {
        options.onProgress(itemsMigrated, sourceItems.length);
      }
    } catch (error) {
      errors.push({
        id: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: errors.length === 0,
      itemsMigrated,
      errors,
      warnings,
      backupPath,
      stats,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Rollback migration from backup
   */
  async rollback(backupPath: string): Promise<RollbackResult> {
    if (!backupPath) {
      return { success: false, error: 'Backup path required' };
    }

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' };
    }

    try {
      // Read backup
      const backupData = fs.readFileSync(backupPath, 'utf-8');

      // Clear current SQLite data
      await this.clearTarget();

      // Restore from backup
      const result = await this.target.importFromJsonl(backupData, false);

      return {
        success: true,
        itemsRestored: result.success,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate migration was successful
   */
  async validateMigration(options: { checkDataIntegrity?: boolean } = {}): Promise<ValidationResult> {
    const sourceItems = await this.source.listItems();
    const targetItems = await this.target.listItems();

    const sourceCount = sourceItems.length;
    const targetCount = targetItems.length;

    // Find missing items
    const targetIds = new Set(targetItems.map(i => i.id));
    const missingItems = sourceItems
      .filter(item => !targetIds.has(item.id))
      .map(item => item.id);

    // Check data integrity if requested
    const integrityErrors: Array<{ id: number; field: string; expected: string; actual: string }> = [];

    if (options.checkDataIntegrity) {
      for (const sourceItem of sourceItems) {
        const targetItem = targetItems.find(t => t.id === sourceItem.id);
        if (!targetItem) continue;

        // Compare key fields
        if (sourceItem.decision !== targetItem.decision) {
          integrityErrors.push({
            id: sourceItem.id,
            field: 'decision',
            expected: sourceItem.decision,
            actual: targetItem.decision,
          });
        }
        if (sourceItem.context !== targetItem.context) {
          integrityErrors.push({
            id: sourceItem.id,
            field: 'context',
            expected: sourceItem.context,
            actual: targetItem.context,
          });
        }
        if (sourceItem.priority !== targetItem.priority) {
          integrityErrors.push({
            id: sourceItem.id,
            field: 'priority',
            expected: sourceItem.priority,
            actual: targetItem.priority,
          });
        }
        if (JSON.stringify(sourceItem.tags) !== JSON.stringify(targetItem.tags)) {
          integrityErrors.push({
            id: sourceItem.id,
            field: 'tags',
            expected: JSON.stringify(sourceItem.tags),
            actual: JSON.stringify(targetItem.tags),
          });
        }
      }
    }

    return {
      valid: missingItems.length === 0 && integrityErrors.length === 0,
      sourceCount,
      targetCount,
      missingItems,
      integrityErrors,
    };
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const jsonlCount = await this.source.countItems();
    const sqliteCount = await this.target.countItems();

    // Consider migrated if SQLite has at least as many items as JSONL
    // and JSONL has items
    const isMigrated = jsonlCount > 0 && sqliteCount >= jsonlCount;

    return {
      jsonlItemCount: jsonlCount,
      sqliteItemCount: sqliteCount,
      isMigrated,
    };
  }

  /**
   * Create backup of source data
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.dataDir, `backup-${timestamp}.jsonl`);

    const jsonlData = await this.source.exportToJsonl();
    fs.writeFileSync(backupPath, jsonlData, 'utf-8');

    return backupPath;
  }

  /**
   * Clear target database
   */
  private async clearTarget(): Promise<void> {
    const items = await this.target.listItems();
    for (const item of items) {
      await this.target.deleteItem(item.id, true);
    }
  }
}
