/**
 * Storage Port
 *
 * Defines the contract for persistence operations.
 * Implemented by infrastructure adapters (JSONL, SQLite).
 */

import { ItemProps, CreateItemInput } from '../entities/Item.js';
import { DependencyProps, CreateDependencyInput } from '../entities/Dependency.js';
import { RetrospectiveProps, CreateRetrospectiveInput } from '../entities/Retrospective.js';
import { ReminderProps, CreateReminderInput } from '../entities/Reminder.js';
import { GitLinkProps, CreateGitLinkInput } from '../entities/GitLink.js';
import { StatusValue } from '../value-objects/Status.js';
import { PriorityValue } from '../value-objects/Priority.js';

/**
 * Filter options for querying items
 */
export interface ItemFilter {
  status?: StatusValue | StatusValue[];
  priority?: PriorityValue | PriorityValue[];
  tags?: string[];
  hasTag?: string;
  hasDependencies?: boolean;
  isBlocked?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Sort options for items
 */
export interface ItemSort {
  field: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Search result with relevance score
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: string[];
}

/**
 * Bulk operation result
 */
export interface BulkResult {
  success: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

/**
 * Main storage port interface
 */
export interface IStoragePort {
  // ===========================================
  // Item Operations
  // ===========================================

  /**
   * Create a new item
   * @returns The created item with assigned ID
   */
  createItem(input: CreateItemInput): Promise<ItemProps>;

  /**
   * Get item by ID
   * @returns Item props or null if not found
   */
  getItem(id: number): Promise<ItemProps | null>;

  /**
   * Get multiple items by IDs
   * @returns Array of items (excluding not found)
   */
  getItems(ids: number[]): Promise<ItemProps[]>;

  /**
   * Update an existing item
   * @returns Updated item props
   * @throws Error if item not found
   */
  updateItem(id: number, updates: Partial<ItemProps>): Promise<ItemProps>;

  /**
   * Delete an item (soft delete by default)
   * @param hard If true, permanently delete; if false, archive
   */
  deleteItem(id: number, hard?: boolean): Promise<void>;

  /**
   * List items with optional filtering, sorting, and pagination
   */
  listItems(
    filter?: ItemFilter,
    sort?: ItemSort,
    pagination?: PaginationOptions
  ): Promise<ItemProps[]>;

  /**
   * Count items matching filter
   */
  countItems(filter?: ItemFilter): Promise<number>;

  /**
   * Search items by text query
   * @param query Search query string
   * @param filter Additional filters
   * @returns Ranked search results
   */
  searchItems(
    query: string,
    filter?: ItemFilter,
    pagination?: PaginationOptions
  ): Promise<SearchResult<ItemProps>[]>;

  /**
   * Bulk update items
   */
  bulkUpdateItems(
    ids: number[],
    updates: Partial<ItemProps>
  ): Promise<BulkResult>;

  /**
   * Bulk delete items
   */
  bulkDeleteItems(ids: number[], hard?: boolean): Promise<BulkResult>;

  // ===========================================
  // Dependency Operations
  // ===========================================

  /**
   * Create a dependency relationship
   */
  createDependency(input: CreateDependencyInput): Promise<DependencyProps>;

  /**
   * Get dependencies for an item (what this item depends on)
   */
  getDependencies(itemId: number): Promise<DependencyProps[]>;

  /**
   * Get dependents of an item (what depends on this item)
   */
  getDependents(itemId: number): Promise<DependencyProps[]>;

  /**
   * Check if adding dependency would create a cycle
   * @returns True if cycle would be created
   */
  wouldCreateCycle(itemId: number, dependsOnId: number): Promise<boolean>;

  /**
   * Delete a dependency
   */
  deleteDependency(itemId: number, dependsOnId: number): Promise<void>;

  /**
   * Get all blocked items (items with unresolved blocking dependencies)
   */
  getBlockedItems(): Promise<ItemProps[]>;

  // ===========================================
  // Retrospective Operations
  // ===========================================

  /**
   * Create or update a retrospective for an item
   * (One retrospective per item)
   */
  saveRetrospective(input: CreateRetrospectiveInput): Promise<RetrospectiveProps>;

  /**
   * Get retrospective for an item
   */
  getRetrospective(itemId: number): Promise<RetrospectiveProps | null>;

  /**
   * Get all retrospectives
   */
  listRetrospectives(pagination?: PaginationOptions): Promise<RetrospectiveProps[]>;

  /**
   * Get retrospective statistics
   */
  getRetrospectiveStats(): Promise<{
    total: number;
    byOutcome: Record<string, number>;
    avgAccuracy: number | null;
    avgVariance: number | null;
  }>;

  // ===========================================
  // Reminder Operations
  // ===========================================

  /**
   * Create a reminder
   */
  createReminder(input: CreateReminderInput): Promise<ReminderProps>;

  /**
   * Get reminder by ID
   */
  getReminder(id: number): Promise<ReminderProps | null>;

  /**
   * Get reminders for an item
   */
  getRemindersForItem(itemId: number): Promise<ReminderProps[]>;

  /**
   * Get all active reminders (not dismissed, not snoozed)
   */
  getActiveReminders(): Promise<ReminderProps[]>;

  /**
   * Update reminder (trigger, dismiss, snooze)
   */
  updateReminder(id: number, updates: Partial<ReminderProps>): Promise<ReminderProps>;

  /**
   * Delete a reminder
   */
  deleteReminder(id: number): Promise<void>;

  // ===========================================
  // Git Link Operations
  // ===========================================

  /**
   * Create a git link
   */
  createGitLink(input: CreateGitLinkInput): Promise<GitLinkProps>;

  /**
   * Get git links for an item
   */
  getGitLinksForItem(itemId: number): Promise<GitLinkProps[]>;

  /**
   * Get git link by commit hash
   */
  getGitLinkByCommit(commitHash: string): Promise<GitLinkProps | null>;

  /**
   * Check if commit is already linked
   */
  isCommitLinked(commitHash: string, itemId: number): Promise<boolean>;

  /**
   * Delete a git link
   */
  deleteGitLink(id: number): Promise<void>;

  // ===========================================
  // Transaction & Lifecycle
  // ===========================================

  /**
   * Initialize storage (create tables/files if needed)
   */
  initialize(): Promise<void>;

  /**
   * Close storage connections
   */
  close(): Promise<void>;

  /**
   * Begin a transaction
   * @returns Transaction ID or context
   */
  beginTransaction(): Promise<string>;

  /**
   * Commit a transaction
   */
  commitTransaction(txId: string): Promise<void>;

  /**
   * Rollback a transaction
   */
  rollbackTransaction(txId: string): Promise<void>;

  /**
   * Run a function within a transaction
   */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;

  // ===========================================
  // Migration & Export
  // ===========================================

  /**
   * Export all data to JSONL format
   */
  exportToJsonl(): Promise<string>;

  /**
   * Import data from JSONL format
   * @param data JSONL string
   * @param merge If true, merge with existing; if false, replace
   */
  importFromJsonl(data: string, merge?: boolean): Promise<BulkResult>;

  /**
   * Get storage metadata
   */
  getMetadata(): Promise<{
    version: string;
    itemCount: number;
    lastUpdated: Date | null;
    storageType: 'jsonl' | 'sqlite';
  }>;
}
