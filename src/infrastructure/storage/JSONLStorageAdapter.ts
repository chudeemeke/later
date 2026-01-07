/**
 * JSONL Storage Adapter
 *
 * Implements IStoragePort interface using JSONL file storage.
 * Wraps existing JSONLStorage for items and adds new entity storage.
 *
 * This adapter handles the translation between:
 * - DeferredItem (snake_case, string dates) - legacy JSONL format
 * - ItemProps (camelCase, Date objects) - domain format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
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
import { ReminderProps, CreateReminderInput, TriggerConfig } from '../../domain/entities/Reminder.js';
import { GitLinkProps, CreateGitLinkInput } from '../../domain/entities/GitLink.js';
import { StatusValue } from '../../domain/value-objects/Status.js';
import { PriorityValue } from '../../domain/value-objects/Priority.js';
import type { DeferredItem } from '../../types.js';

const VERSION = '2.1.0';

/**
 * Internal storage format for dependencies
 */
interface DependencyRecord {
  itemId: number;
  dependsOnId: number;
  type: 'blocks' | 'relates-to' | 'duplicates' | 'parent-of';
  createdAt: string;
}

/**
 * Internal storage format for retrospectives
 */
interface RetrospectiveRecord {
  itemId: number;
  outcome: 'success' | 'failure' | 'partial';
  impactTimeSaved?: number;
  impactCostSaved?: number;
  effortEstimated?: number;
  effortActual?: number;
  lessonsLearned?: string;
  completedAt: string;
}

/**
 * Internal storage format for reminders
 */
interface ReminderRecord {
  id: number;
  itemId: number;
  triggerType: 'time' | 'dependency' | 'file_change' | 'activity';
  triggerConfig?: TriggerConfig;
  triggeredAt?: string;
  dismissedAt?: string;
  snoozedUntil?: string;
  createdAt: string;
}

/**
 * Internal storage format for git links
 */
interface GitLinkRecord {
  id: number;
  itemId: number;
  commitHash: string;
  commitMessage?: string;
  commitDate?: string;
  repoPath?: string;
  detectedAt: string;
}

/**
 * JSONL Storage Adapter implementing IStoragePort
 */
export class JSONLStorageAdapter implements IStoragePort {
  private dataDir: string;
  private itemsFile: string;
  private dependenciesFile: string;
  private retrospectivesFile: string;
  private remindersFile: string;
  private gitLinksFile: string;
  private lockFile: string;
  private lockTimeoutMs: number;
  private nextReminderId: number = 1;
  private nextGitLinkId: number = 1;

  constructor(dataDir?: string, lockTimeoutMs: number = 30000) {
    this.dataDir = dataDir || path.join(homedir(), '.later');
    this.itemsFile = path.join(this.dataDir, 'items.jsonl');
    this.dependenciesFile = path.join(this.dataDir, 'dependencies.jsonl');
    this.retrospectivesFile = path.join(this.dataDir, 'retrospectives.jsonl');
    this.remindersFile = path.join(this.dataDir, 'reminders.jsonl');
    this.gitLinksFile = path.join(this.dataDir, 'git-links.jsonl');
    this.lockFile = path.join(this.dataDir, '.lock');
    this.lockTimeoutMs = lockTimeoutMs;
  }

  // ===========================================
  // Initialization & Lifecycle
  // ===========================================

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });

    // Initialize ID counters from existing data
    const reminders = await this.readReminders();
    if (reminders.length > 0) {
      this.nextReminderId = Math.max(...reminders.map(r => r.id)) + 1;
    }

    const gitLinks = await this.readGitLinks();
    if (gitLinks.length > 0) {
      this.nextGitLinkId = Math.max(...gitLinks.map(l => l.id)) + 1;
    }
  }

  async close(): Promise<void> {
    // No persistent connections to close for JSONL
  }

  // ===========================================
  // Item Operations
  // ===========================================

  async createItem(input: CreateItemInput): Promise<ItemProps> {
    const items = await this.readItems();
    const id = items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
    const now = new Date();

    const item: DeferredItem = {
      id,
      decision: input.decision,
      context: input.context || '',
      status: 'pending',
      tags: input.tags || [],
      priority: input.priority || 'medium',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      conversation_id: input.conversationId,
      dependencies: input.dependencies,
      context_tokens: undefined,
      context_pii_types: undefined,
    };

    await this.withLock(async () => {
      await fs.appendFile(this.itemsFile, JSON.stringify(item) + '\n');
    });

    return this.toItemProps(item);
  }

  async getItem(id: number): Promise<ItemProps | null> {
    const items = await this.readItems();
    const item = items.find(i => i.id === id);
    return item ? this.toItemProps(item) : null;
  }

  async getItems(ids: number[]): Promise<ItemProps[]> {
    const items = await this.readItems();
    return items.filter(i => ids.includes(i.id)).map(i => this.toItemProps(i));
  }

  async updateItem(id: number, updates: Partial<ItemProps>): Promise<ItemProps> {
    return this.withLock(async () => {
      const items = await this.readItems();
      const index = items.findIndex(i => i.id === id);

      if (index === -1) {
        throw new Error(`Item #${id} not found`);
      }

      const existing = items[index];
      const now = new Date();

      const updated: DeferredItem = {
        ...existing,
        decision: updates.decision ?? existing.decision,
        context: updates.context ?? existing.context,
        status: updates.status ?? existing.status,
        tags: updates.tags ?? existing.tags,
        priority: updates.priority ?? existing.priority,
        updated_at: now.toISOString(),
        conversation_id: updates.conversationId ?? existing.conversation_id,
        dependencies: updates.dependencies ?? existing.dependencies,
        context_tokens: updates.contextTokens ?? existing.context_tokens,
        context_pii_types: updates.contextPiiTypes ?? existing.context_pii_types,
      };

      items[index] = updated;
      await this.writeItems(items);

      return this.toItemProps(updated);
    });
  }

  async deleteItem(id: number, hard?: boolean): Promise<void> {
    if (hard) {
      await this.withLock(async () => {
        const items = await this.readItems();
        const filtered = items.filter(i => i.id !== id);
        await this.writeItems(filtered);
      });
    } else {
      // Soft delete = archive
      await this.updateItem(id, { status: 'archived' });
    }
  }

  async listItems(
    filter?: ItemFilter,
    sort?: ItemSort,
    pagination?: PaginationOptions
  ): Promise<ItemProps[]> {
    let items = await this.readItems();

    // Apply filters
    if (filter) {
      items = this.applyFilter(items, filter);
    }

    // Apply sorting
    if (sort) {
      items = this.applySort(items, sort);
    }

    // Apply pagination
    if (pagination) {
      const offset = pagination.offset || 0;
      const limit = pagination.limit || items.length;
      items = items.slice(offset, offset + limit);
    }

    return items.map(i => this.toItemProps(i));
  }

  async countItems(filter?: ItemFilter): Promise<number> {
    let items = await this.readItems();
    if (filter) {
      items = this.applyFilter(items, filter);
    }
    return items.length;
  }

  async searchItems(
    query: string,
    filter?: ItemFilter,
    pagination?: PaginationOptions
  ): Promise<SearchResult<ItemProps>[]> {
    let items = await this.readItems();

    if (filter) {
      items = this.applyFilter(items, filter);
    }

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    // Score and rank items
    const scored = items
      .map(item => {
        const decisionLower = item.decision.toLowerCase();
        const contextLower = item.context.toLowerCase();

        let score = 0;
        const highlights: string[] = [];

        for (const term of queryTerms) {
          // Decision matches weighted higher
          if (decisionLower.includes(term)) {
            score += 2;
            highlights.push(`decision: ${term}`);
          }
          // Context matches
          if (contextLower.includes(term)) {
            score += 1;
            highlights.push(`context: ${term}`);
          }
          // Tag matches
          if (item.tags.some(t => t.toLowerCase().includes(term))) {
            score += 1.5;
            highlights.push(`tag: ${term}`);
          }
        }

        return { item, score, highlights };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    // Apply pagination
    let results = scored;
    if (pagination) {
      const offset = pagination.offset || 0;
      const limit = pagination.limit || results.length;
      results = results.slice(offset, offset + limit);
    }

    return results.map(r => ({
      item: this.toItemProps(r.item),
      score: r.score,
      highlights: r.highlights,
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
    const dep: DependencyRecord = {
      itemId: input.itemId,
      dependsOnId: input.dependsOnId,
      type: input.type || 'blocks',
      createdAt: new Date().toISOString(),
    };

    await this.withLock(async () => {
      await fs.appendFile(this.dependenciesFile, JSON.stringify(dep) + '\n');
    });

    return this.toDependencyProps(dep);
  }

  async getDependencies(itemId: number): Promise<DependencyProps[]> {
    const deps = await this.readDependencies();
    return deps.filter(d => d.itemId === itemId).map(d => this.toDependencyProps(d));
  }

  async getDependents(itemId: number): Promise<DependencyProps[]> {
    const deps = await this.readDependencies();
    return deps.filter(d => d.dependsOnId === itemId).map(d => this.toDependencyProps(d));
  }

  async wouldCreateCycle(itemId: number, dependsOnId: number): Promise<boolean> {
    const deps = await this.readDependencies();

    // Build adjacency list
    const graph = new Map<number, number[]>();
    for (const dep of deps) {
      if (!graph.has(dep.itemId)) {
        graph.set(dep.itemId, []);
      }
      graph.get(dep.itemId)!.push(dep.dependsOnId);
    }

    // Add proposed edge
    if (!graph.has(itemId)) {
      graph.set(itemId, []);
    }
    graph.get(itemId)!.push(dependsOnId);

    // DFS to detect cycle from dependsOnId back to itemId
    const visited = new Set<number>();
    const stack = [dependsOnId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === itemId) {
        return true; // Cycle detected
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }

    return false;
  }

  async deleteDependency(itemId: number, dependsOnId: number): Promise<void> {
    await this.withLock(async () => {
      const deps = await this.readDependencies();
      const filtered = deps.filter(
        d => !(d.itemId === itemId && d.dependsOnId === dependsOnId)
      );
      await this.writeDependencies(filtered);
    });
  }

  async getBlockedItems(): Promise<ItemProps[]> {
    const items = await this.readItems();
    const deps = await this.readDependencies();

    // Items with blocking dependencies where blocker is not done
    const blockedIds = new Set<number>();

    for (const dep of deps) {
      if (dep.type === 'blocks') {
        const blocker = items.find(i => i.id === dep.dependsOnId);
        if (blocker && blocker.status !== 'done' && blocker.status !== 'archived') {
          blockedIds.add(dep.itemId);
        }
      }
    }

    return items
      .filter(i => blockedIds.has(i.id))
      .map(i => this.toItemProps(i));
  }

  // ===========================================
  // Retrospective Operations
  // ===========================================

  async saveRetrospective(input: CreateRetrospectiveInput): Promise<RetrospectiveProps> {
    const record: RetrospectiveRecord = {
      itemId: input.itemId,
      outcome: input.outcome,
      impactTimeSaved: input.impactTimeSaved,
      impactCostSaved: input.impactCostSaved,
      effortEstimated: input.effortEstimated,
      effortActual: input.effortActual,
      lessonsLearned: input.lessonsLearned,
      completedAt: new Date().toISOString(),
    };

    await this.withLock(async () => {
      const retros = await this.readRetrospectives();
      const existingIndex = retros.findIndex(r => r.itemId === input.itemId);

      if (existingIndex >= 0) {
        retros[existingIndex] = record;
      } else {
        retros.push(record);
      }

      await this.writeRetrospectives(retros);
    });

    return this.toRetrospectiveProps(record);
  }

  async getRetrospective(itemId: number): Promise<RetrospectiveProps | null> {
    const retros = await this.readRetrospectives();
    const retro = retros.find(r => r.itemId === itemId);
    return retro ? this.toRetrospectiveProps(retro) : null;
  }

  async listRetrospectives(pagination?: PaginationOptions): Promise<RetrospectiveProps[]> {
    let retros = await this.readRetrospectives();

    if (pagination) {
      const offset = pagination.offset || 0;
      const limit = pagination.limit || retros.length;
      retros = retros.slice(offset, offset + limit);
    }

    return retros.map(r => this.toRetrospectiveProps(r));
  }

  async getRetrospectiveStats(): Promise<{
    total: number;
    byOutcome: Record<string, number>;
    avgAccuracy: number | null;
    avgVariance: number | null;
  }> {
    const retros = await this.readRetrospectives();

    const byOutcome: Record<string, number> = {};
    let totalVariance = 0;
    let varianceCount = 0;

    for (const retro of retros) {
      byOutcome[retro.outcome] = (byOutcome[retro.outcome] || 0) + 1;

      if (retro.effortEstimated && retro.effortActual) {
        totalVariance += retro.effortActual - retro.effortEstimated;
        varianceCount++;
      }
    }

    return {
      total: retros.length,
      byOutcome,
      avgAccuracy: null, // Would need historical data
      avgVariance: varianceCount > 0 ? totalVariance / varianceCount : null,
    };
  }

  // ===========================================
  // Reminder Operations
  // ===========================================

  async createReminder(input: CreateReminderInput): Promise<ReminderProps> {
    const id = this.nextReminderId++;
    const record: ReminderRecord = {
      id,
      itemId: input.itemId,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      createdAt: new Date().toISOString(),
    };

    await this.withLock(async () => {
      await fs.appendFile(this.remindersFile, JSON.stringify(record) + '\n');
    });

    return this.toReminderProps(record);
  }

  async getReminder(id: number): Promise<ReminderProps | null> {
    const reminders = await this.readReminders();
    const reminder = reminders.find(r => r.id === id);
    return reminder ? this.toReminderProps(reminder) : null;
  }

  async getRemindersForItem(itemId: number): Promise<ReminderProps[]> {
    const reminders = await this.readReminders();
    return reminders
      .filter(r => r.itemId === itemId)
      .map(r => this.toReminderProps(r));
  }

  async getActiveReminders(): Promise<ReminderProps[]> {
    const reminders = await this.readReminders();
    const now = new Date();

    return reminders
      .filter(r => {
        // Not dismissed
        if (r.dismissedAt) return false;
        // Not snoozed (or snooze expired)
        if (r.snoozedUntil && new Date(r.snoozedUntil) > now) return false;
        return true;
      })
      .map(r => this.toReminderProps(r));
  }

  async updateReminder(id: number, updates: Partial<ReminderProps>): Promise<ReminderProps> {
    return this.withLock(async () => {
      const reminders = await this.readReminders();
      const index = reminders.findIndex(r => r.id === id);

      if (index === -1) {
        throw new Error(`Reminder #${id} not found`);
      }

      const existing = reminders[index];
      const updated: ReminderRecord = {
        ...existing,
        triggerType: updates.triggerType ?? existing.triggerType,
        triggerConfig: updates.triggerConfig ?? existing.triggerConfig,
        triggeredAt: updates.triggeredAt?.toISOString() ?? existing.triggeredAt,
        dismissedAt: updates.dismissedAt?.toISOString() ?? existing.dismissedAt,
        snoozedUntil: updates.snoozedUntil?.toISOString() ?? existing.snoozedUntil,
      };

      reminders[index] = updated;
      await this.writeReminders(reminders);

      return this.toReminderProps(updated);
    });
  }

  async deleteReminder(id: number): Promise<void> {
    await this.withLock(async () => {
      const reminders = await this.readReminders();
      const filtered = reminders.filter(r => r.id !== id);
      await this.writeReminders(filtered);
    });
  }

  // ===========================================
  // Git Link Operations
  // ===========================================

  async createGitLink(input: CreateGitLinkInput): Promise<GitLinkProps> {
    const id = this.nextGitLinkId++;
    const record: GitLinkRecord = {
      id,
      itemId: input.itemId,
      commitHash: input.commitHash,
      commitMessage: input.commitMessage,
      commitDate: input.commitDate?.toISOString(),
      repoPath: input.repoPath,
      detectedAt: new Date().toISOString(),
    };

    await this.withLock(async () => {
      await fs.appendFile(this.gitLinksFile, JSON.stringify(record) + '\n');
    });

    return this.toGitLinkProps(record);
  }

  async getGitLinksForItem(itemId: number): Promise<GitLinkProps[]> {
    const links = await this.readGitLinks();
    return links
      .filter(l => l.itemId === itemId)
      .map(l => this.toGitLinkProps(l));
  }

  async getGitLinkByCommit(commitHash: string): Promise<GitLinkProps | null> {
    const links = await this.readGitLinks();
    const link = links.find(l => l.commitHash === commitHash);
    return link ? this.toGitLinkProps(link) : null;
  }

  async isCommitLinked(commitHash: string, itemId: number): Promise<boolean> {
    const links = await this.readGitLinks();
    return links.some(l => l.commitHash === commitHash && l.itemId === itemId);
  }

  async deleteGitLink(id: number): Promise<void> {
    await this.withLock(async () => {
      const links = await this.readGitLinks();
      const filtered = links.filter(l => l.id !== id);
      await this.writeGitLinks(filtered);
    });
  }

  // ===========================================
  // Transaction Operations
  // ===========================================

  async beginTransaction(): Promise<string> {
    // JSONL doesn't support true transactions
    // Return a dummy transaction ID
    return `tx-${Date.now()}`;
  }

  async commitTransaction(_txId: string): Promise<void> {
    // No-op for JSONL
  }

  async rollbackTransaction(_txId: string): Promise<void> {
    // JSONL doesn't support rollback
    // In a real implementation, we'd need to track changes
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // Execute function directly - no true transaction support
    return fn();
  }

  // ===========================================
  // Export/Import Operations
  // ===========================================

  async exportToJsonl(): Promise<string> {
    const items = await this.readItems();
    return items.map(i => JSON.stringify(i)).join('\n');
  }

  async importFromJsonl(data: string, merge?: boolean): Promise<BulkResult> {
    const result: BulkResult = { success: 0, failed: 0, errors: [] };
    const lines = data.trim().split('\n').filter(l => l.length > 0);

    if (!merge) {
      // Replace all data
      await this.withLock(async () => {
        await fs.writeFile(this.itemsFile, '');
      });
    }

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as DeferredItem;
        await this.withLock(async () => {
          await fs.appendFile(this.itemsFile, JSON.stringify(item) + '\n');
        });
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
    const items = await this.readItems();
    let lastUpdated: Date | null = null;

    if (items.length > 0) {
      const dates = items.map(i => new Date(i.updated_at));
      lastUpdated = new Date(Math.max(...dates.map(d => d.getTime())));
    }

    return {
      version: VERSION,
      itemCount: items.length,
      lastUpdated,
      storageType: 'jsonl',
    };
  }

  // ===========================================
  // Private Helper Methods
  // ===========================================

  private async readItems(): Promise<DeferredItem[]> {
    try {
      const content = await fs.readFile(this.itemsFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeItems(items: DeferredItem[]): Promise<void> {
    const tempFile = `${this.itemsFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        items.map(i => JSON.stringify(i)).join('\n') + (items.length > 0 ? '\n' : '')
      );
      await fs.rename(tempFile, this.itemsFile);
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  private async readDependencies(): Promise<DependencyRecord[]> {
    try {
      const content = await fs.readFile(this.dependenciesFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeDependencies(deps: DependencyRecord[]): Promise<void> {
    const tempFile = `${this.dependenciesFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        deps.map(d => JSON.stringify(d)).join('\n') + (deps.length > 0 ? '\n' : '')
      );
      await fs.rename(tempFile, this.dependenciesFile);
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  private async readRetrospectives(): Promise<RetrospectiveRecord[]> {
    try {
      const content = await fs.readFile(this.retrospectivesFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeRetrospectives(retros: RetrospectiveRecord[]): Promise<void> {
    const tempFile = `${this.retrospectivesFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        retros.map(r => JSON.stringify(r)).join('\n') + (retros.length > 0 ? '\n' : '')
      );
      await fs.rename(tempFile, this.retrospectivesFile);
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  private async readReminders(): Promise<ReminderRecord[]> {
    try {
      const content = await fs.readFile(this.remindersFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeReminders(reminders: ReminderRecord[]): Promise<void> {
    const tempFile = `${this.remindersFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        reminders.map(r => JSON.stringify(r)).join('\n') + (reminders.length > 0 ? '\n' : '')
      );
      await fs.rename(tempFile, this.remindersFile);
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  private async readGitLinks(): Promise<GitLinkRecord[]> {
    try {
      const content = await fs.readFile(this.gitLinksFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async writeGitLinks(links: GitLinkRecord[]): Promise<void> {
    const tempFile = `${this.gitLinksFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        links.map(l => JSON.stringify(l)).join('\n') + (links.length > 0 ? '\n' : '')
      );
      await fs.rename(tempFile, this.gitLinksFile);
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  }

  // ===========================================
  // Type Conversion Helpers
  // ===========================================

  private toItemProps(item: DeferredItem): ItemProps {
    return {
      id: item.id,
      decision: item.decision,
      context: item.context,
      status: item.status as StatusValue,
      tags: item.tags,
      priority: item.priority as PriorityValue,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      conversationId: item.conversation_id,
      dependencies: item.dependencies,
      contextTokens: item.context_tokens,
      contextPiiTypes: item.context_pii_types,
    };
  }

  private toDependencyProps(dep: DependencyRecord): DependencyProps {
    return {
      itemId: dep.itemId,
      dependsOnId: dep.dependsOnId,
      type: dep.type,
      createdAt: new Date(dep.createdAt),
    };
  }

  private toRetrospectiveProps(retro: RetrospectiveRecord): RetrospectiveProps {
    return {
      itemId: retro.itemId,
      outcome: retro.outcome,
      impactTimeSaved: retro.impactTimeSaved,
      impactCostSaved: retro.impactCostSaved,
      effortEstimated: retro.effortEstimated,
      effortActual: retro.effortActual,
      lessonsLearned: retro.lessonsLearned,
      completedAt: new Date(retro.completedAt),
    };
  }

  private toReminderProps(reminder: ReminderRecord): ReminderProps {
    return {
      id: reminder.id,
      itemId: reminder.itemId,
      triggerType: reminder.triggerType,
      triggerConfig: reminder.triggerConfig,
      triggeredAt: reminder.triggeredAt ? new Date(reminder.triggeredAt) : undefined,
      dismissedAt: reminder.dismissedAt ? new Date(reminder.dismissedAt) : undefined,
      snoozedUntil: reminder.snoozedUntil ? new Date(reminder.snoozedUntil) : undefined,
      createdAt: new Date(reminder.createdAt),
    };
  }

  private toGitLinkProps(link: GitLinkRecord): GitLinkProps {
    return {
      id: link.id,
      itemId: link.itemId,
      commitHash: link.commitHash,
      commitMessage: link.commitMessage,
      commitDate: link.commitDate ? new Date(link.commitDate) : undefined,
      repoPath: link.repoPath,
      detectedAt: new Date(link.detectedAt),
    };
  }

  // ===========================================
  // Filter & Sort Helpers
  // ===========================================

  private applyFilter(items: DeferredItem[], filter: ItemFilter): DeferredItem[] {
    return items.filter(item => {
      // Status filter
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(item.status as StatusValue)) {
          return false;
        }
      }

      // Priority filter
      if (filter.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        if (!priorities.includes(item.priority as PriorityValue)) {
          return false;
        }
      }

      // Tags filter (any match)
      if (filter.tags && filter.tags.length > 0) {
        if (!filter.tags.some(t => item.tags.includes(t))) {
          return false;
        }
      }

      // Single tag filter
      if (filter.hasTag) {
        if (!item.tags.includes(filter.hasTag)) {
          return false;
        }
      }

      // Date filters
      if (filter.createdAfter) {
        if (new Date(item.created_at) < filter.createdAfter) {
          return false;
        }
      }
      if (filter.createdBefore) {
        if (new Date(item.created_at) > filter.createdBefore) {
          return false;
        }
      }
      if (filter.updatedAfter) {
        if (new Date(item.updated_at) < filter.updatedAfter) {
          return false;
        }
      }
      if (filter.updatedBefore) {
        if (new Date(item.updated_at) > filter.updatedBefore) {
          return false;
        }
      }

      return true;
    });
  }

  private applySort(items: DeferredItem[], sort: ItemSort): DeferredItem[] {
    const sorted = [...items];
    const direction = sort.direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sort.field) {
        case 'createdAt':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'updatedAt':
          aVal = new Date(a.updated_at).getTime();
          bVal = new Date(b.updated_at).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case 'status':
          const statusOrder = { pending: 1, 'in-progress': 2, done: 3, archived: 4 };
          aVal = statusOrder[a.status as keyof typeof statusOrder] || 0;
          bVal = statusOrder[b.status as keyof typeof statusOrder] || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return -1 * direction;
      if (aVal > bVal) return 1 * direction;
      return 0;
    });

    return sorted;
  }

  // ===========================================
  // File Locking
  // ===========================================

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const baseDelay = 50;
    const maxDelay = 1000;
    const startTime = Date.now();
    let retries = 0;
    let acquired = false;

    while (!acquired && Date.now() - startTime < this.lockTimeoutMs) {
      try {
        await this.cleanStaleLock();
        await fs.writeFile(this.lockFile, String(process.pid), { flag: 'wx' });
        acquired = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          const exponentialDelay = Math.min(baseDelay * Math.pow(1.5, retries), maxDelay);
          const jitter = Math.random() * exponentialDelay * 0.3;
          const delay = exponentialDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }

    if (!acquired) {
      throw new Error(
        `Failed to acquire lock after ${this.lockTimeoutMs}ms (${retries} attempts).`
      );
    }

    try {
      return await fn();
    } finally {
      await fs.unlink(this.lockFile).catch(() => {});
    }
  }

  private async cleanStaleLock(): Promise<void> {
    try {
      const lockContent = await fs.readFile(this.lockFile, 'utf-8');
      const lockPid = parseInt(lockContent.trim());

      if (isNaN(lockPid)) {
        await fs.unlink(this.lockFile);
        return;
      }

      try {
        process.kill(lockPid, 0);
      } catch {
        await fs.unlink(this.lockFile);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
