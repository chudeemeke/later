/**
 * SQLite Storage Adapter
 *
 * Implements IStoragePort interface using better-sqlite3 with FTS5
 * for high-performance full-text search.
 *
 * Features:
 * - ACID transactions for data integrity
 * - FTS5 virtual tables for ranked full-text search
 * - Indexed queries for efficient filtering
 * - Automatic schema migration
 * - Compatible with both Node.js and Bun runtimes
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType, RunResult } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  IStoragePort,
  ItemFilter,
  ItemSort,
  PaginationOptions,
  SearchResult,
  BulkResult,
} from '../../domain/ports/IStoragePort.js';
import { ItemProps, CreateItemInput } from '../../domain/entities/Item.js';
import { DependencyProps, CreateDependencyInput } from '../../domain/entities/Dependency.js';
import { RetrospectiveProps, CreateRetrospectiveInput } from '../../domain/entities/Retrospective.js';
import { ReminderProps, CreateReminderInput } from '../../domain/entities/Reminder.js';
import { GitLinkProps, CreateGitLinkInput } from '../../domain/entities/GitLink.js';
import { StatusValue } from '../../domain/value-objects/Status.js';
import { PriorityValue } from '../../domain/value-objects/Priority.js';

const VERSION = '3.0.0';

// Type alias for SQL parameters
type SqlParams = (string | number | null | Buffer | bigint)[];

/**
 * SQLite Storage Adapter implementing IStoragePort
 */
export class SQLiteStorageAdapter implements IStoragePort {
  private db: DatabaseType | null = null;
  private dbPath: string;
  private inTransaction: boolean = false;

  constructor(dataDir: string) {
    this.dbPath = path.join(dataDir, 'later.db');
  }

  // ===========================================
  // Initialization & Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        decision TEXT NOT NULL,
        context TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        tags TEXT DEFAULT '[]',
        priority TEXT DEFAULT 'medium',
        conversation_id TEXT,
        dependencies TEXT DEFAULT '[]',
        context_tokens TEXT,
        context_pii_types TEXT,
        context_hash TEXT,
        context_files TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        decision,
        context,
        tags,
        content='items',
        content_rowid='id',
        tokenize='porter unicode61'
      );
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, decision, context, tags)
        VALUES (new.id, new.decision, new.context, new.tags);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, decision, context, tags)
        VALUES ('delete', old.id, old.decision, old.context, old.tags);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, decision, context, tags)
        VALUES ('delete', old.id, old.decision, old.context, old.tags);
        INSERT INTO items_fts(rowid, decision, context, tags)
        VALUES (new.id, new.decision, new.context, new.tags);
      END;
    `);

    // Indexes for items
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);`);

    // Dependencies table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dependencies (
        item_id INTEGER NOT NULL,
        depends_on_id INTEGER NOT NULL,
        type TEXT DEFAULT 'blocks',
        created_at TEXT NOT NULL,
        PRIMARY KEY (item_id, depends_on_id),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    // Retrospectives table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS retrospectives (
        item_id INTEGER PRIMARY KEY,
        outcome TEXT NOT NULL,
        impact_time_saved INTEGER,
        impact_cost_saved REAL,
        effort_estimated INTEGER,
        effort_actual INTEGER,
        lessons_learned TEXT,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    // Reminders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT,
        triggered_at TEXT,
        dismissed_at TEXT,
        snoozed_until TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    // Git links table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS git_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        commit_hash TEXT NOT NULL,
        commit_message TEXT,
        commit_date TEXT,
        repo_path TEXT,
        detected_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_git_links_commit ON git_links(commit_hash);`);

    // Metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Insert version
    this.db.exec(`INSERT OR REPLACE INTO metadata (key, value) VALUES ('version', '${VERSION}');`);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ===========================================
  // Item Operations
  // ===========================================

  async createItem(input: CreateItemInput): Promise<ItemProps> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO items (decision, context, status, tags, priority, conversation_id, dependencies, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `);

    const result: RunResult = stmt.run(
      input.decision,
      input.context || '',
      JSON.stringify(input.tags || []),
      input.priority || 'medium',
      input.conversationId || null,
      JSON.stringify(input.dependencies || []),
      now,
      now
    );

    const id = Number(result.lastInsertRowid);
    return this.rowToItemProps({
      id,
      decision: input.decision,
      context: input.context || '',
      status: 'pending',
      tags: JSON.stringify(input.tags || []),
      priority: input.priority || 'medium',
      conversation_id: input.conversationId ?? null,
      dependencies: JSON.stringify(input.dependencies || []),
      created_at: now,
      updated_at: now,
      context_tokens: null,
      context_pii_types: null,
      context_hash: null,
      context_files: null,
    });
  }

  async getItem(id: number): Promise<ItemProps | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
    const row = stmt.get(id) as ItemRow | undefined;

    return row ? this.rowToItemProps(row) : null;
  }

  async getItems(ids: number[]): Promise<ItemProps[]> {
    if (!this.db) throw new Error('Database not initialized');
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM items WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids) as ItemRow[];

    return rows.map(row => this.rowToItemProps(row));
  }

  async updateItem(id: number, updates: Partial<ItemProps>): Promise<ItemProps> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getItem(id);
    if (!existing) {
      throw new Error(`Item #${id} not found`);
    }

    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const values: SqlParams = [now];

    if (updates.decision !== undefined) {
      sets.push('decision = ?');
      values.push(updates.decision);
    }
    if (updates.context !== undefined) {
      sets.push('context = ?');
      values.push(updates.context);
    }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.tags !== undefined) {
      sets.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.priority !== undefined) {
      sets.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.conversationId !== undefined) {
      sets.push('conversation_id = ?');
      values.push(updates.conversationId);
    }
    if (updates.dependencies !== undefined) {
      sets.push('dependencies = ?');
      values.push(JSON.stringify(updates.dependencies));
    }
    if (updates.contextTokens !== undefined) {
      sets.push('context_tokens = ?');
      values.push(JSON.stringify(updates.contextTokens));
    }
    if (updates.contextPiiTypes !== undefined) {
      sets.push('context_pii_types = ?');
      values.push(JSON.stringify(updates.contextPiiTypes));
    }
    if (updates.contextHash !== undefined) {
      sets.push('context_hash = ?');
      values.push(updates.contextHash);
    }
    if (updates.contextFiles !== undefined) {
      sets.push('context_files = ?');
      values.push(JSON.stringify(updates.contextFiles));
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return (await this.getItem(id))!;
  }

  async deleteItem(id: number, hard?: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    if (hard) {
      const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
      stmt.run(id);
    } else {
      await this.updateItem(id, { status: 'archived' });
    }
  }

  async listItems(
    filter?: ItemFilter,
    sort?: ItemSort,
    pagination?: PaginationOptions
  ): Promise<ItemProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM items WHERE 1=1';
    const params: SqlParams = [];

    // Apply filters
    if (filter) {
      const filterSql = this.buildFilterSql(filter, params);
      sql += filterSql;
    }

    // Apply sorting
    if (sort) {
      const sortField = this.mapSortField(sort.field);
      sql += ` ORDER BY ${sortField} ${sort.direction.toUpperCase()}`;
    } else {
      sql += ' ORDER BY id DESC';
    }

    // Apply pagination
    if (pagination) {
      if (pagination.limit) {
        sql += ' LIMIT ?';
        params.push(pagination.limit);
      }
      if (pagination.offset) {
        sql += ' OFFSET ?';
        params.push(pagination.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as ItemRow[];

    return rows.map(row => this.rowToItemProps(row));
  }

  async countItems(filter?: ItemFilter): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT COUNT(*) as count FROM items WHERE 1=1';
    const params: SqlParams = [];

    if (filter) {
      sql += this.buildFilterSql(filter, params);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  async searchItems(
    query: string,
    filter?: ItemFilter,
    pagination?: PaginationOptions
  ): Promise<SearchResult<ItemProps>[]> {
    if (!this.db) throw new Error('Database not initialized');

    // FTS5 search with ranking
    let sql = `
      SELECT items.*, bm25(items_fts, 2.0, 1.0, 0.5) AS score
      FROM items_fts
      JOIN items ON items.id = items_fts.rowid
      WHERE items_fts MATCH ?
    `;
    const params: SqlParams = [this.escapeFtsQuery(query)];

    // Apply filters
    if (filter) {
      sql += this.buildFilterSql(filter, params, 'items');
    }

    sql += ' ORDER BY score ASC'; // BM25 returns negative scores, lower is better

    // Apply pagination
    if (pagination) {
      if (pagination.limit) {
        sql += ' LIMIT ?';
        params.push(pagination.limit);
      }
      if (pagination.offset) {
        sql += ' OFFSET ?';
        params.push(pagination.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as (ItemRow & { score: number })[];

    return rows.map(row => ({
      item: this.rowToItemProps(row),
      score: Math.abs(row.score), // Convert to positive
      highlights: this.generateHighlights(row, query),
    }));
  }

  async bulkUpdateItems(
    ids: number[],
    updates: Partial<ItemProps>
  ): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        await this.updateItem(id, updates);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  async bulkDeleteItems(ids: number[], hard?: boolean): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        await this.deleteItem(id, hard);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  // ===========================================
  // Dependency Operations
  // ===========================================

  async createDependency(input: CreateDependencyInput): Promise<DependencyProps> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO dependencies (item_id, depends_on_id, type, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(input.itemId, input.dependsOnId, input.type || 'blocks', now);

    return {
      itemId: input.itemId,
      dependsOnId: input.dependsOnId,
      type: input.type || 'blocks',
      createdAt: new Date(now),
    };
  }

  async getDependencies(itemId: number): Promise<DependencyProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM dependencies WHERE item_id = ?');
    const rows = stmt.all(itemId) as DependencyRow[];

    return rows.map(row => this.rowToDependencyProps(row));
  }

  async getDependents(itemId: number): Promise<DependencyProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM dependencies WHERE depends_on_id = ?');
    const rows = stmt.all(itemId) as DependencyRow[];

    return rows.map(row => this.rowToDependencyProps(row));
  }

  async wouldCreateCycle(itemId: number, dependsOnId: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    // DFS from dependsOnId to see if we can reach itemId
    const visited = new Set<number>();
    const stack = [dependsOnId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === itemId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await this.getDependencies(current);
      for (const dep of deps) {
        stack.push(dep.dependsOnId);
      }
    }

    return false;
  }

  async deleteDependency(itemId: number, dependsOnId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'DELETE FROM dependencies WHERE item_id = ? AND depends_on_id = ?'
    );
    stmt.run(itemId, dependsOnId);
  }

  async getBlockedItems(): Promise<ItemProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = `
      SELECT DISTINCT i.*
      FROM items i
      JOIN dependencies d ON i.id = d.item_id AND d.type = 'blocks'
      JOIN items blocker ON d.depends_on_id = blocker.id
      WHERE blocker.status NOT IN ('done', 'archived')
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as ItemRow[];

    return rows.map(row => this.rowToItemProps(row));
  }

  // ===========================================
  // Retrospective Operations
  // ===========================================

  async saveRetrospective(input: CreateRetrospectiveInput): Promise<RetrospectiveProps> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO retrospectives (
        item_id, outcome, impact_time_saved, impact_cost_saved,
        effort_estimated, effort_actual, lessons_learned, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.itemId,
      input.outcome,
      input.impactTimeSaved ?? null,
      input.impactCostSaved ?? null,
      input.effortEstimated ?? null,
      input.effortActual ?? null,
      input.lessonsLearned ?? null,
      now
    );

    return {
      itemId: input.itemId,
      outcome: input.outcome,
      impactTimeSaved: input.impactTimeSaved,
      impactCostSaved: input.impactCostSaved,
      effortEstimated: input.effortEstimated,
      effortActual: input.effortActual,
      lessonsLearned: input.lessonsLearned,
      completedAt: new Date(now),
    };
  }

  async getRetrospective(itemId: number): Promise<RetrospectiveProps | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM retrospectives WHERE item_id = ?');
    const row = stmt.get(itemId) as RetrospectiveRow | undefined;

    return row ? this.rowToRetrospectiveProps(row) : null;
  }

  async listRetrospectives(pagination?: PaginationOptions): Promise<RetrospectiveProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM retrospectives ORDER BY completed_at DESC';
    const params: SqlParams = [];

    if (pagination) {
      if (pagination.limit) {
        sql += ' LIMIT ?';
        params.push(pagination.limit);
      }
      if (pagination.offset) {
        sql += ' OFFSET ?';
        params.push(pagination.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as RetrospectiveRow[];

    return rows.map(row => this.rowToRetrospectiveProps(row));
  }

  async getRetrospectiveStats(): Promise<{
    total: number;
    byOutcome: Record<string, number>;
    avgAccuracy: number | null;
    avgVariance: number | null;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM retrospectives');
    const countResult = countStmt.get() as { total: number };

    const byOutcomeStmt = this.db.prepare(
      'SELECT outcome, COUNT(*) as count FROM retrospectives GROUP BY outcome'
    );
    const byOutcomeRows = byOutcomeStmt.all() as { outcome: string; count: number }[];
    const byOutcome: Record<string, number> = {};
    for (const row of byOutcomeRows) {
      byOutcome[row.outcome] = row.count;
    }

    const varianceStmt = this.db.prepare(`
      SELECT AVG(effort_actual - effort_estimated) as avg_variance
      FROM retrospectives
      WHERE effort_estimated IS NOT NULL AND effort_actual IS NOT NULL
    `);
    const varianceResult = varianceStmt.get() as { avg_variance: number | null };

    return {
      total: countResult.total,
      byOutcome,
      avgAccuracy: null, // Would need historical data
      avgVariance: varianceResult.avg_variance,
    };
  }

  // ===========================================
  // Reminder Operations
  // ===========================================

  async createReminder(input: CreateReminderInput): Promise<ReminderProps> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO reminders (item_id, trigger_type, trigger_config, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const result: RunResult = stmt.run(
      input.itemId,
      input.triggerType,
      input.triggerConfig ? JSON.stringify(input.triggerConfig) : null,
      now
    );

    return {
      id: Number(result.lastInsertRowid),
      itemId: input.itemId,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      createdAt: new Date(now),
    };
  }

  async getReminder(id: number): Promise<ReminderProps | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM reminders WHERE id = ?');
    const row = stmt.get(id) as ReminderRow | undefined;

    return row ? this.rowToReminderProps(row) : null;
  }

  async getRemindersForItem(itemId: number): Promise<ReminderProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM reminders WHERE item_id = ?');
    const rows = stmt.all(itemId) as ReminderRow[];

    return rows.map(row => this.rowToReminderProps(row));
  }

  async getActiveReminders(): Promise<ReminderProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM reminders
      WHERE dismissed_at IS NULL
      AND (snoozed_until IS NULL OR snoozed_until <= ?)
    `);
    const rows = stmt.all(now) as ReminderRow[];

    return rows.map(row => this.rowToReminderProps(row));
  }

  async updateReminder(id: number, updates: Partial<ReminderProps>): Promise<ReminderProps> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getReminder(id);
    if (!existing) {
      throw new Error(`Reminder #${id} not found`);
    }

    const sets: string[] = [];
    const values: SqlParams = [];

    if (updates.triggerType !== undefined) {
      sets.push('trigger_type = ?');
      values.push(updates.triggerType);
    }
    if (updates.triggerConfig !== undefined) {
      sets.push('trigger_config = ?');
      values.push(JSON.stringify(updates.triggerConfig));
    }
    if (updates.triggeredAt !== undefined) {
      sets.push('triggered_at = ?');
      values.push(updates.triggeredAt?.toISOString() ?? null);
    }
    if (updates.dismissedAt !== undefined) {
      sets.push('dismissed_at = ?');
      values.push(updates.dismissedAt?.toISOString() ?? null);
    }
    if (updates.snoozedUntil !== undefined) {
      sets.push('snoozed_until = ?');
      values.push(updates.snoozedUntil?.toISOString() ?? null);
    }

    if (sets.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    return (await this.getReminder(id))!;
  }

  async deleteReminder(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM reminders WHERE id = ?');
    stmt.run(id);
  }

  // ===========================================
  // Git Link Operations
  // ===========================================

  async createGitLink(input: CreateGitLinkInput): Promise<GitLinkProps> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO git_links (item_id, commit_hash, commit_message, commit_date, repo_path, detected_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result: RunResult = stmt.run(
      input.itemId,
      input.commitHash,
      input.commitMessage ?? null,
      input.commitDate?.toISOString() ?? null,
      input.repoPath ?? null,
      now
    );

    return {
      id: Number(result.lastInsertRowid),
      itemId: input.itemId,
      commitHash: input.commitHash,
      commitMessage: input.commitMessage,
      commitDate: input.commitDate,
      repoPath: input.repoPath,
      detectedAt: new Date(now),
    };
  }

  async getGitLinksForItem(itemId: number): Promise<GitLinkProps[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM git_links WHERE item_id = ?');
    const rows = stmt.all(itemId) as GitLinkRow[];

    return rows.map(row => this.rowToGitLinkProps(row));
  }

  async getGitLinkByCommit(commitHash: string): Promise<GitLinkProps | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM git_links WHERE commit_hash = ?');
    const row = stmt.get(commitHash) as GitLinkRow | undefined;

    return row ? this.rowToGitLinkProps(row) : null;
  }

  async isCommitLinked(commitHash: string, itemId: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM git_links WHERE commit_hash = ? AND item_id = ?'
    );
    const result = stmt.get(commitHash, itemId) as { count: number };

    return result.count > 0;
  }

  async deleteGitLink(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM git_links WHERE id = ?');
    stmt.run(id);
  }

  // ===========================================
  // Transaction Operations
  // ===========================================

  async beginTransaction(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    if (this.inTransaction) throw new Error('Transaction already in progress');

    this.db.exec('BEGIN TRANSACTION');
    this.inTransaction = true;
    return `tx-${Date.now()}`;
  }

  async commitTransaction(_txId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.inTransaction) throw new Error('No transaction in progress');

    this.db.exec('COMMIT');
    this.inTransaction = false;
  }

  async rollbackTransaction(_txId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.inTransaction) throw new Error('No transaction in progress');

    this.db.exec('ROLLBACK');
    this.inTransaction = false;
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');

    const txId = await this.beginTransaction();
    try {
      const result = await fn();
      await this.commitTransaction(txId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(txId);
      throw error;
    }
  }

  // ===========================================
  // Export/Import Operations
  // ===========================================

  async exportToJsonl(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM items ORDER BY id');
    const rows = stmt.all() as ItemRow[];

    return rows.map(row => JSON.stringify(this.rowToLegacyFormat(row))).join('\n');
  }

  async importFromJsonl(data: string, merge?: boolean): Promise<BulkResult> {
    if (!this.db) throw new Error('Database not initialized');

    const result: BulkResult = { success: 0, failed: 0, errors: [] };
    const lines = data.trim().split('\n').filter(l => l.length > 0);

    if (!merge) {
      // Clear existing data
      this.db.exec('DELETE FROM items');
    }

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const stmt = this.db.prepare(`
          INSERT INTO items (
            id, decision, context, status, tags, priority,
            conversation_id, dependencies, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          merge ? null : item.id, // Let SQLite assign ID in merge mode
          item.decision,
          item.context || '',
          item.status || 'pending',
          JSON.stringify(item.tags || []),
          item.priority || 'medium',
          item.conversation_id || null,
          JSON.stringify(item.dependencies || []),
          item.created_at || new Date().toISOString(),
          item.updated_at || new Date().toISOString()
        );

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: 0,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }

    return result;
  }

  async getMetadata(): Promise<{
    version: string;
    itemCount: number;
    lastUpdated: Date | null;
    storageType: 'jsonl' | 'sqlite';
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const versionStmt = this.db.prepare("SELECT value FROM metadata WHERE key = 'version'");
    const versionResult = versionStmt.get() as { value: string } | undefined;

    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM items');
    const countResult = countStmt.get() as { count: number };

    const lastUpdatedStmt = this.db.prepare('SELECT MAX(updated_at) as last FROM items');
    const lastUpdatedResult = lastUpdatedStmt.get() as { last: string | null };

    return {
      version: versionResult?.value || VERSION,
      itemCount: countResult.count,
      lastUpdated: lastUpdatedResult.last ? new Date(lastUpdatedResult.last) : null,
      storageType: 'sqlite',
    };
  }

  // ===========================================
  // Helper Methods
  // ===========================================

  private buildFilterSql(filter: ItemFilter, params: SqlParams, tablePrefix: string = ''): string {
    let sql = '';
    const prefix = tablePrefix ? `${tablePrefix}.` : '';

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      const placeholders = statuses.map(() => '?').join(',');
      sql += ` AND ${prefix}status IN (${placeholders})`;
      params.push(...statuses);
    }

    if (filter.priority) {
      const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
      const placeholders = priorities.map(() => '?').join(',');
      sql += ` AND ${prefix}priority IN (${placeholders})`;
      params.push(...priorities);
    }

    if (filter.hasTag) {
      sql += ` AND ${prefix}tags LIKE ?`;
      params.push(`%"${filter.hasTag}"%`);
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => `${prefix}tags LIKE ?`);
      sql += ` AND (${tagConditions.join(' OR ')})`;
      for (const tag of filter.tags) {
        params.push(`%"${tag}"%`);
      }
    }

    if (filter.createdAfter) {
      sql += ` AND ${prefix}created_at >= ?`;
      params.push(filter.createdAfter.toISOString());
    }

    if (filter.createdBefore) {
      sql += ` AND ${prefix}created_at <= ?`;
      params.push(filter.createdBefore.toISOString());
    }

    if (filter.updatedAfter) {
      sql += ` AND ${prefix}updated_at >= ?`;
      params.push(filter.updatedAfter.toISOString());
    }

    if (filter.updatedBefore) {
      sql += ` AND ${prefix}updated_at <= ?`;
      params.push(filter.updatedBefore.toISOString());
    }

    return sql;
  }

  private mapSortField(field: ItemSort['field']): string {
    switch (field) {
      case 'createdAt':
        return 'created_at';
      case 'updatedAt':
        return 'updated_at';
      case 'priority':
        return "CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END";
      case 'status':
        return "CASE status WHEN 'pending' THEN 1 WHEN 'in-progress' THEN 2 WHEN 'done' THEN 3 WHEN 'archived' THEN 4 ELSE 0 END";
      default:
        return 'id';
    }
  }

  private escapeFtsQuery(query: string): string {
    // Escape special FTS5 characters and convert to OR query
    const terms = query
      .replace(/['"(){}[\]^*+?\\|~@#$%&=<>!:;,./-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (terms.length === 0) return '*';
    return terms.join(' OR ');
  }

  private generateHighlights(row: ItemRow, query: string): string[] {
    const highlights: string[] = [];
    const terms = query.toLowerCase().split(/\s+/);

    for (const term of terms) {
      if (row.decision.toLowerCase().includes(term)) {
        highlights.push(`decision: ${term}`);
      }
      if (row.context.toLowerCase().includes(term)) {
        highlights.push(`context: ${term}`);
      }
      const tags = JSON.parse(row.tags) as string[];
      for (const tag of tags) {
        if (tag.toLowerCase().includes(term)) {
          highlights.push(`tag: ${term}`);
        }
      }
    }

    return highlights;
  }

  private rowToItemProps(row: ItemRow): ItemProps {
    return {
      id: row.id,
      decision: row.decision,
      context: row.context,
      status: row.status as StatusValue,
      tags: JSON.parse(row.tags),
      priority: row.priority as PriorityValue,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      conversationId: row.conversation_id ?? undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      contextTokens: row.context_tokens ? JSON.parse(row.context_tokens) : undefined,
      contextPiiTypes: row.context_pii_types ? JSON.parse(row.context_pii_types) : undefined,
      contextHash: row.context_hash ?? undefined,
      contextFiles: row.context_files ? JSON.parse(row.context_files) : undefined,
    };
  }

  private rowToLegacyFormat(row: ItemRow): Record<string, unknown> {
    return {
      id: row.id,
      decision: row.decision,
      context: row.context,
      status: row.status,
      tags: JSON.parse(row.tags),
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
      conversation_id: row.conversation_id,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined,
      context_tokens: row.context_tokens ? JSON.parse(row.context_tokens) : undefined,
      context_pii_types: row.context_pii_types ? JSON.parse(row.context_pii_types) : undefined,
      context_hash: row.context_hash,
      context_files: row.context_files ? JSON.parse(row.context_files) : undefined,
    };
  }

  private rowToDependencyProps(row: DependencyRow): DependencyProps {
    return {
      itemId: row.item_id,
      dependsOnId: row.depends_on_id,
      type: row.type as DependencyProps['type'],
      createdAt: new Date(row.created_at),
    };
  }

  private rowToRetrospectiveProps(row: RetrospectiveRow): RetrospectiveProps {
    return {
      itemId: row.item_id,
      outcome: row.outcome as RetrospectiveProps['outcome'],
      impactTimeSaved: row.impact_time_saved ?? undefined,
      impactCostSaved: row.impact_cost_saved ?? undefined,
      effortEstimated: row.effort_estimated ?? undefined,
      effortActual: row.effort_actual ?? undefined,
      lessonsLearned: row.lessons_learned ?? undefined,
      completedAt: new Date(row.completed_at),
    };
  }

  private rowToReminderProps(row: ReminderRow): ReminderProps {
    return {
      id: row.id,
      itemId: row.item_id,
      triggerType: row.trigger_type as ReminderProps['triggerType'],
      triggerConfig: row.trigger_config ? JSON.parse(row.trigger_config) : undefined,
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : undefined,
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
      snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private rowToGitLinkProps(row: GitLinkRow): GitLinkProps {
    return {
      id: row.id,
      itemId: row.item_id,
      commitHash: row.commit_hash,
      commitMessage: row.commit_message ?? undefined,
      commitDate: row.commit_date ? new Date(row.commit_date) : undefined,
      repoPath: row.repo_path ?? undefined,
      detectedAt: new Date(row.detected_at),
    };
  }
}

// ===========================================
// Type Definitions for SQLite Rows
// ===========================================

interface ItemRow {
  id: number;
  decision: string;
  context: string;
  status: string;
  tags: string;
  priority: string;
  conversation_id: string | null;
  dependencies: string | null;
  context_tokens: string | null;
  context_pii_types: string | null;
  context_hash: string | null;
  context_files: string | null;
  created_at: string;
  updated_at: string;
}

interface DependencyRow {
  item_id: number;
  depends_on_id: number;
  type: string;
  created_at: string;
}

interface RetrospectiveRow {
  item_id: number;
  outcome: string;
  impact_time_saved: number | null;
  impact_cost_saved: number | null;
  effort_estimated: number | null;
  effort_actual: number | null;
  lessons_learned: string | null;
  completed_at: string;
}

interface ReminderRow {
  id: number;
  item_id: number;
  trigger_type: string;
  trigger_config: string | null;
  triggered_at: string | null;
  dismissed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

interface GitLinkRow {
  id: number;
  item_id: number;
  commit_hash: string;
  commit_message: string | null;
  commit_date: string | null;
  repo_path: string | null;
  detected_at: string;
}
