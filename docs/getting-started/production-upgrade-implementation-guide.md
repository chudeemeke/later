# Production-Grade /later Implementation Guide

**Purpose:** Comprehensive upgrade from MVP to production-ready MCP server
**Target:** Industry-standard quality matching Linear, GitHub Issues, Supabase MCP
**Approach:** Apple-style - simple surface, powerful internals, cohesive integration
**Status:** Implementation blueprint for systematic upgrade

---

## 🎯 Executive Summary

**Current State:** MVP with 4 basic operations, 95% test coverage, solid TDD foundation
**Target State:** Production-grade tool with complete CRUD, pagination, advanced filtering, structured errors, observability
**Gap Analysis:** 10 critical issues identified across CRUD operations, scalability, error handling, validation, and observability

**Implementation Strategy:** 6-phase incremental upgrade maintaining backward compatibility, zero breaking changes to existing 4 tools

---

## 📋 Implementation Phases

### Phase 0: Pre-Implementation Setup (30 min)

**Critical:** Establish monitoring baseline before changes

```bash
# 1. Create feature branch
git checkout -b production-upgrade-$(date +%Y%m%d)

# 2. Capture current test baseline
npm test -- --coverage > baseline-test-results.txt

# 3. Create rollback point
git tag -a baseline-pre-upgrade -m "Pre-production upgrade baseline"

# 4. Document current API surface
echo "Existing tools: later_capture, later_list, later_show, later_do" > api-baseline.txt
```

---

## 🔧 Phase 1: Core CRUD Completion (P0 - Blockers)

**Objective:** Add missing Update and Delete operations
**Duration:** 4-6 hours
**Tests Required:** 40+ new tests

### 1.1 Add Update Operation

**File:** `src/tools/update.ts` (NEW)

```typescript
import type { Storage } from '../storage/interface.js';
import type { DeferredItem } from '../types.js';
import { validateTransition, STATE_MACHINE } from '../utils/state-machine.js';
import { validateUpdate } from '../utils/validation.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:update');

export interface UpdateArgs {
  id: number;
  decision?: string;
  context?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in-progress' | 'done' | 'archived';
  dependencies?: number[];
}

export interface UpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
  item?: DeferredItem;
}

export async function handleUpdate(
  args: UpdateArgs,
  storage: Storage
): Promise<UpdateResult> {
  const startTime = Date.now();

  try {
    // Validate item exists
    const existing = await storage.findById(args.id);
    if (!existing) {
      log.error('update_not_found', { id: args.id });
      return {
        success: false,
        error: `Item #${args.id} not found`,
      };
    }

    // Validate update args
    const validation = validateUpdate(args);
    if (!validation.valid) {
      log.error('update_validation_failed', { id: args.id, errors: validation.errors });
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Check state transition if status is being updated
    if (args.status && args.status !== existing.status) {
      if (!validateTransition(existing.status, args.status)) {
        return {
          success: false,
          error: `Invalid status transition: ${existing.status} → ${args.status}. Allowed: ${STATE_MACHINE[existing.status].join(', ')}`,
        };
      }
    }

    // Check dependency cycles if dependencies are updated
    if (args.dependencies) {
      const cycleCheck = await checkDependencyCycles(args.id, args.dependencies, storage);
      if (!cycleCheck.valid) {
        return {
          success: false,
          error: `Dependency cycle detected: ${cycleCheck.cycle}`,
        };
      }
    }

    // Build updated item (merge with existing)
    const updated: DeferredItem = {
      ...existing,
      ...args,
      id: existing.id, // Ensure ID doesn't change
      created_at: existing.created_at, // Preserve creation timestamp
      updated_at: new Date().toISOString(),
    };

    // Update storage
    await storage.update(updated);

    const duration = Date.now() - startTime;
    log.info('update_success', { id: args.id, changes: Object.keys(args), duration_ms: duration });

    return {
      success: true,
      message: `✅ Updated item #${args.id}`,
      item: updated,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('update_failed', {
      id: args.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function checkDependencyCycles(
  itemId: number,
  newDeps: number[],
  storage: Storage
): Promise<{ valid: boolean; cycle?: string }> {
  // DFS to detect cycles
  const visited = new Set<number>();
  const recStack = new Set<number>();

  async function hasCycle(id: number): Promise<boolean> {
    visited.add(id);
    recStack.add(id);

    const item = await storage.findById(id);
    if (!item || !item.dependencies) {
      recStack.delete(id);
      return false;
    }

    for (const depId of item.dependencies) {
      if (!visited.has(depId)) {
        if (await hasCycle(depId)) return true;
      } else if (recStack.has(depId)) {
        return true; // Cycle detected
      }
    }

    recStack.delete(id);
    return false;
  }

  // Temporarily add new dependencies to check
  const tempItem = await storage.findById(itemId);
  if (tempItem) {
    tempItem.dependencies = newDeps;
  }

  const cycleDetected = await hasCycle(itemId);
  return {
    valid: !cycleDetected,
    cycle: cycleDetected ? `Item #${itemId} creates circular dependency` : undefined,
  };
}
```

**File:** `src/utils/state-machine.ts` (NEW)

```typescript
export type Status = 'pending' | 'in-progress' | 'done' | 'archived';

export const STATE_MACHINE: Record<Status, Status[]> = {
  pending: ['in-progress', 'archived'],
  'in-progress': ['done', 'pending', 'archived'],
  done: ['archived', 'pending'], // Can reopen
  archived: ['pending'], // Must unarchive before other transitions
};

export function validateTransition(from: Status, to: Status): boolean {
  return STATE_MACHINE[from].includes(to);
}

export function getValidTransitions(from: Status): Status[] {
  return STATE_MACHINE[from];
}
```

**File:** `src/utils/validation.ts` (NEW)

```typescript
import { z } from 'zod';

// Zod schemas for runtime validation
export const UpdateArgsSchema = z.object({
  id: z.number().int().positive(),
  decision: z.string().min(1).max(1000).optional(),
  context: z.string().max(50000).optional(),
  tags: z.array(
    z.string()
      .regex(/^[a-z0-9-]+$/, 'Tags must be lowercase alphanumeric with hyphens')
      .max(50)
  ).max(10).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'done', 'archived']).optional(),
  dependencies: z.array(z.number().int().positive()).max(20).optional(),
});

export const CaptureArgsSchema = z.object({
  decision: z.string().min(1, 'Decision cannot be empty').max(1000, 'Decision too long (max 1000 chars)'),
  context: z.string().max(50000, 'Context too long (max 50000 chars)').optional(),
  tags: z.array(
    z.string()
      .regex(/^[a-z0-9-]+$/, 'Tags must be lowercase alphanumeric with hyphens')
      .max(50)
  ).max(10).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export function validateUpdate(args: unknown) {
  try {
    UpdateArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

export function validateCapture(args: unknown) {
  try {
    CaptureArgsSchema.parse(args);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}
```

**Install Zod:**
```bash
npm install zod
```

**Register in MCP Server (`src/index.ts`):**

```typescript
// Add to tool list
{
  name: 'later_update',
  description:
    'Update an existing deferred item. ' +
    'Can modify decision, context, tags, priority, status, or dependencies. ' +
    'Validates state transitions and prevents dependency cycles.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Item ID to update (required)' },
      decision: { type: 'string', description: 'Updated decision text (optional)' },
      context: { type: 'string', description: 'Updated context (optional)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags (optional)' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Updated priority (optional)' },
      status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'archived'], description: 'Updated status (optional)' },
      dependencies: { type: 'array', items: { type: 'number' }, description: 'Updated dependencies (optional)' },
    },
    required: ['id'],
  },
}

// Add to switch statement
case 'later_update': {
  const result = await handleUpdate(args as unknown as UpdateArgs, storage);
  if (!result.success) {
    throw new Error(result.error);
  }
  return {
    content: [{
      type: 'text',
      text: result.message + (result.warnings ? '\n\n' + result.warnings.join('\n') : ''),
    }],
  };
}
```

### 1.2 Add Delete Operation

**File:** `src/tools/delete.ts` (NEW)

```typescript
import type { Storage } from '../storage/interface.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:delete');

export interface DeleteArgs {
  id: number;
  permanent?: boolean; // If false, just archives
}

export interface DeleteResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
}

export async function handleDelete(
  args: DeleteArgs,
  storage: Storage
): Promise<DeleteResult> {
  const startTime = Date.now();

  try {
    // Check item exists
    const item = await storage.findById(args.id);
    if (!item) {
      return {
        success: false,
        error: `Item #${args.id} not found`,
      };
    }

    // Check if other items depend on this one
    const blockers = await findBlockingItems(args.id, storage);
    if (blockers.length > 0 && args.permanent) {
      return {
        success: false,
        error: `Cannot delete: ${blockers.length} item(s) depend on #${args.id}: ${blockers.map(b => `#${b}`).join(', ')}`,
        warnings: ['Resolve dependencies first or use soft delete (archive).'],
      };
    }

    if (!args.permanent || args.permanent === false) {
      // Soft delete: archive
      item.status = 'archived';
      item.updated_at = new Date().toISOString();
      await storage.update(item);

      const duration = Date.now() - startTime;
      log.info('archive_success', { id: args.id, duration_ms: duration });

      return {
        success: true,
        message: `✅ Archived item #${args.id} (soft delete)`,
        warnings: blockers.length > 0
          ? [`Note: ${blockers.length} item(s) still reference this item`]
          : undefined,
      };
    } else {
      // Hard delete: remove from storage
      await storage.delete(args.id);

      const duration = Date.now() - startTime;
      log.info('delete_success', { id: args.id, duration_ms: duration });

      return {
        success: true,
        message: `✅ Permanently deleted item #${args.id}`,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('delete_failed', {
      id: args.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function findBlockingItems(itemId: number, storage: Storage): Promise<number[]> {
  const allItems = await storage.readAll();
  return allItems
    .filter(item => item.dependencies?.includes(itemId))
    .map(item => item.id);
}
```

**Update Storage Interface (`src/storage/interface.ts`):**

```typescript
export interface Storage {
  append(item: DeferredItem): Promise<void>;
  readAll(): Promise<DeferredItem[]>;
  findById(id: number): Promise<DeferredItem | null>;
  update(item: DeferredItem): Promise<void>;
  delete(id: number): Promise<void>; // ADD THIS
  getNextId(): Promise<number>;
}
```

**Implement in JSONLStorage (`src/storage/jsonl.ts`):**

```typescript
async delete(id: number): Promise<void> {
  await this.withLock(async () => {
    const items = await this.readAll();
    const filtered = items.filter(item => item.id !== id);

    if (filtered.length === items.length) {
      throw new Error(`Item #${id} not found`);
    }

    // Atomic write
    const tempFile = `${this.itemsFile}.tmp.${process.pid}`;
    try {
      await fs.writeFile(
        tempFile,
        filtered.map(i => JSON.stringify(i)).join('\n') + '\n'
      );
      await fs.rename(tempFile, this.itemsFile);
      await this.setSecurePermissions();
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      throw error;
    }
  });
}
```

**Register in MCP Server:**

```typescript
{
  name: 'later_delete',
  description:
    'Delete a deferred item. ' +
    'By default performs soft delete (archives). ' +
    'Use permanent=true for hard delete (checks for dependencies).',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Item ID to delete' },
      permanent: { type: 'boolean', description: 'If true, permanently delete. If false/omitted, archive (soft delete)' },
    },
    required: ['id'],
  },
}

case 'later_delete': {
  const result = await handleDelete(args as unknown as DeleteArgs, storage);
  if (!result.success) {
    throw new Error(result.error);
  }
  return {
    content: [{
      type: 'text',
      text: result.message + (result.warnings ? '\n\n' + result.warnings.join('\n') : ''),
    }],
  };
}
```

**Tests Required:**
- Update validation (valid transitions, cycle detection)
- Update partial fields
- Update with invalid transitions
- Delete with dependencies (should fail)
- Delete without dependencies (should succeed)
- Soft delete (archive)
- Hard delete

---

## 🔧 Phase 2: Pagination & Advanced Filtering (P0 - Scale Blocker)

**Objective:** Add cursor-based pagination, advanced filtering, custom sorting
**Duration:** 6-8 hours
**Tests Required:** 50+ new tests

### 2.1 Update Types

**File:** `src/types.ts` - Add new interfaces

```typescript
export interface PaginationArgs {
  first?: number;  // Forward pagination limit
  after?: string;  // Cursor for forward pagination
  last?: number;   // Backward pagination limit
  before?: string; // Cursor for backward pagination
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  totalCount?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface FilterOperator {
  eq?: string | number;      // Equals
  ne?: string | number;      // Not equals
  in?: Array<string | number>; // In array
  contains?: string;         // String contains (case-insensitive)
  startsWith?: string;       // String starts with
  endsWith?: string;         // String ends with
  gte?: number;             // Greater than or equal
  lte?: number;             // Less than or equal
  hasTag?: string;          // Has specific tag
}

export interface AdvancedFilters {
  status?: FilterOperator;
  priority?: FilterOperator;
  tags?: FilterOperator;
  decision?: FilterOperator;
  context?: FilterOperator;
  created_at?: FilterOperator;
  updated_at?: FilterOperator;
}

export interface SortOptions {
  field: 'created_at' | 'updated_at' | 'priority' | 'status';
  direction: 'ASC' | 'DESC';
}

export interface ListArgs {
  // Legacy (backward compatible)
  status?: string;
  tags?: string[];
  priority?: string;
  limit?: number;

  // New advanced features
  filters?: AdvancedFilters;
  orderBy?: SortOptions[];
  pagination?: PaginationArgs;
}
```

### 2.2 Implement Advanced List

**File:** `src/tools/list.ts` - Complete rewrite with backward compatibility

```typescript
import type { Storage } from '../storage/interface.js';
import type { DeferredItem, ListArgs, PaginatedResult, PageInfo } from '../types.js';
import { applyFilters, applySorting, paginateResults } from '../utils/query.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:list');

export interface ListResult {
  success: boolean;
  formatted_output?: string;
  message?: string;
  error?: string;
  pagination?: PageInfo;
}

export async function handleList(
  args: ListArgs,
  storage: Storage
): Promise<ListResult> {
  const startTime = Date.now();

  try {
    // Fetch all items (will optimize with indices in SQLite phase)
    let items = await storage.readAll();
    const totalCount = items.length;

    // Apply legacy filters (backward compatibility)
    if (args.status) {
      items = items.filter(item => item.status === args.status);
    }
    if (args.priority) {
      items = items.filter(item => item.priority === args.priority);
    }
    if (args.tags && args.tags.length > 0) {
      items = items.filter(item =>
        args.tags!.some(tag => item.tags.includes(tag))
      );
    }

    // Apply advanced filters (if provided)
    if (args.filters) {
      items = applyFilters(items, args.filters);
    }

    // Apply sorting
    const sorting = args.orderBy || [{ field: 'created_at', direction: 'DESC' }];
    items = applySorting(items, sorting);

    // Apply pagination
    const paginationArgs = args.pagination || {};
    const paginationLimit = paginationArgs.first || paginationArgs.last || args.limit || 20;

    const paginated = paginateResults(items, {
      ...paginationArgs,
      first: paginationArgs.first || paginationLimit,
    });

    // Format output
    const formatted = formatListOutput(paginated.items, paginated.pageInfo);

    const duration = Date.now() - startTime;
    log.info('list_success', {
      total_items: totalCount,
      filtered_items: items.length,
      returned_items: paginated.items.length,
      duration_ms: duration
    });

    return {
      success: true,
      formatted_output: formatted,
      pagination: paginated.pageInfo,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('list_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

function formatListOutput(items: DeferredItem[], pageInfo: PageInfo): string {
  if (items.length === 0) {
    return 'No items found matching the criteria';
  }

  const statusIcons = {
    pending: '⏸️',
    'in-progress': '▶️',
    done: '✅',
    archived: '📦',
  };

  const lines = items.map(item => {
    const icon = statusIcons[item.status];
    const tagsStr = item.tags.length > 0 ? ` [${item.tags.join(', ')}]` : '';
    const timeAgo = formatTimeAgo(new Date(item.created_at));
    return `${icon} #${item.id}: ${item.decision}${tagsStr} (${timeAgo})`;
  });

  let output = lines.join('\n');

  // Add pagination info
  output += `\n\nTotal: ${items.length} item${items.length !== 1 ? 's' : ''}`;

  if (pageInfo.hasNextPage) {
    output += `\n▶️  More items available (use pagination.after: "${pageInfo.endCursor}")`;
  }
  if (pageInfo.hasPrevPage) {
    output += `\n◀️  Previous items available (use pagination.before: "${pageInfo.startCursor}")`;
  }

  return output;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
```

**File:** `src/utils/query.ts` (NEW)

```typescript
import type { DeferredItem, AdvancedFilters, FilterOperator, SortOptions, PaginationArgs, PaginatedResult, PageInfo } from '../types.js';
import { createHash } from 'crypto';

export function applyFilters(items: DeferredItem[], filters: AdvancedFilters): DeferredItem[] {
  return items.filter(item => {
    // Status filter
    if (filters.status && !matchesOperator(item.status, filters.status)) {
      return false;
    }

    // Priority filter
    if (filters.priority && !matchesOperator(item.priority, filters.priority)) {
      return false;
    }

    // Tags filter
    if (filters.tags) {
      if (filters.tags.hasTag && !item.tags.includes(filters.tags.hasTag)) {
        return false;
      }
      if (filters.tags.in && !filters.tags.in.some(tag => item.tags.includes(String(tag)))) {
        return false;
      }
    }

    // Decision filter (text search)
    if (filters.decision && !matchesOperator(item.decision, filters.decision)) {
      return false;
    }

    // Context filter (text search)
    if (filters.context && !matchesOperator(item.context, filters.context)) {
      return false;
    }

    // Date filters
    if (filters.created_at && !matchesDateOperator(new Date(item.created_at), filters.created_at)) {
      return false;
    }
    if (filters.updated_at && !matchesDateOperator(new Date(item.updated_at), filters.updated_at)) {
      return false;
    }

    return true;
  });
}

function matchesOperator(value: string | number, operator: FilterOperator): boolean {
  if (operator.eq !== undefined) return value === operator.eq;
  if (operator.ne !== undefined) return value !== operator.ne;
  if (operator.in !== undefined) return operator.in.includes(value);

  if (typeof value === 'string') {
    if (operator.contains) return value.toLowerCase().includes(operator.contains.toLowerCase());
    if (operator.startsWith) return value.toLowerCase().startsWith(operator.startsWith.toLowerCase());
    if (operator.endsWith) return value.toLowerCase().endsWith(operator.endsWith.toLowerCase());
  }

  return true;
}

function matchesDateOperator(date: Date, operator: FilterOperator): boolean {
  const timestamp = date.getTime();
  if (operator.gte !== undefined) return timestamp >= operator.gte;
  if (operator.lte !== undefined) return timestamp <= operator.lte;
  return true;
}

export function applySorting(items: DeferredItem[], sorting: SortOptions[]): DeferredItem[] {
  const sortedItems = [...items];

  sortedItems.sort((a, b) => {
    for (const sort of sorting) {
      let comparison = 0;

      switch (sort.field) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          const statusOrder = { pending: 1, 'in-progress': 2, done: 3, archived: 4 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }

      if (comparison !== 0) {
        return sort.direction === 'ASC' ? comparison : -comparison;
      }
    }

    return 0;
  });

  return sortedItems;
}

export function paginateResults(
  items: DeferredItem[],
  args: PaginationArgs
): PaginatedResult<DeferredItem> {
  let startIndex = 0;
  let endIndex = items.length;

  // Decode cursors
  if (args.after) {
    const afterIndex = decodeCursor(args.after);
    startIndex = afterIndex + 1;
  }
  if (args.before) {
    const beforeIndex = decodeCursor(args.before);
    endIndex = beforeIndex;
  }

  // Apply limits
  if (args.first) {
    endIndex = Math.min(startIndex + args.first, endIndex);
  }
  if (args.last) {
    startIndex = Math.max(endIndex - args.last, startIndex);
  }

  const paginatedItems = items.slice(startIndex, endIndex);

  // Generate cursors
  const startCursor = paginatedItems.length > 0 ? encodeCursor(startIndex) : null;
  const endCursor = paginatedItems.length > 0 ? encodeCursor(endIndex - 1) : null;

  const pageInfo: PageInfo = {
    hasNextPage: endIndex < items.length,
    hasPrevPage: startIndex > 0,
    startCursor,
    endCursor,
    totalCount: items.length,
  };

  return {
    items: paginatedItems,
    pageInfo,
  };
}

function encodeCursor(index: number): string {
  // Base64 encode the index for opacity
  return Buffer.from(`cursor:${index}`).toString('base64');
}

function decodeCursor(cursor: string): number {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const match = decoded.match(/^cursor:(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  } catch {
    return 0;
  }
}
```

---

## 🔧 Phase 3: Error Handling & Logging (P1 - Critical)

**Objective:** Structured errors (JSON-RPC compliant), comprehensive logging
**Duration:** 4-5 hours
**Tests Required:** 30+ new tests

### 3.1 Structured Error System

**File:** `src/utils/errors.ts` (NEW)

```typescript
// JSON-RPC error codes + custom codes
export const ERROR_CODES = {
  // Standard JSON-RPC
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Application-specific (range: -32000 to -32099)
  ITEM_NOT_FOUND: -32001,
  DUPLICATE_ITEM: -32002,
  STORAGE_ERROR: -32003,
  VALIDATION_ERROR: -32004,
  STATE_TRANSITION_ERROR: -32005,
  DEPENDENCY_CYCLE: -32006,
  LOCK_TIMEOUT: -32007,
  PERMISSION_DENIED: -32008,
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface StructuredError {
  code: ErrorCode;
  message: string;
  data?: {
    details?: string;
    field?: string;
    allowed_values?: any[];
    retry_after?: number;
    [key: string]: any;
  };
}

export class LaterError extends Error {
  code: ErrorCode;
  data?: StructuredError['data'];

  constructor(code: ErrorCode, message: string, data?: StructuredError['data']) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = 'LaterError';
  }

  toJSON(): StructuredError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

export class ItemNotFoundError extends LaterError {
  constructor(id: number) {
    super(ERROR_CODES.ITEM_NOT_FOUND, `Item #${id} not found`, {
      details: `The requested item with ID ${id} does not exist`,
      field: 'id',
    });
  }
}

export class ValidationError extends LaterError {
  constructor(field: string, message: string, allowedValues?: any[]) {
    super(ERROR_CODES.VALIDATION_ERROR, `Validation failed: ${message}`, {
      field,
      details: message,
      allowed_values: allowedValues,
    });
  }
}

export class StateTransitionError extends LaterError {
  constructor(from: string, to: string, allowed: string[]) {
    super(
      ERROR_CODES.STATE_TRANSITION_ERROR,
      `Invalid state transition: ${from} → ${to}`,
      {
        details: `Cannot transition from ${from} to ${to}`,
        field: 'status',
        allowed_values: allowed,
      }
    );
  }
}

export class DependencyCycleError extends LaterError {
  constructor(cycleDescription: string) {
    super(ERROR_CODES.DEPENDENCY_CYCLE, 'Dependency cycle detected', {
      details: cycleDescription,
    });
  }
}
```

**Update all tool handlers to use structured errors:**

```typescript
// Example in update.ts
import { ItemNotFoundError, ValidationError, StateTransitionError } from '../utils/errors.js';

// Replace:
if (!existing) {
  return { success: false, error: `Item #${args.id} not found` };
}

// With:
if (!existing) {
  throw new ItemNotFoundError(args.id);
}

// Replace validation errors:
if (!validation.valid) {
  throw new ValidationError('decision', validation.errors[0]);
}

// Replace state transition errors:
if (!validateTransition(existing.status, args.status)) {
  throw new StateTransitionError(
    existing.status,
    args.status,
    STATE_MACHINE[existing.status]
  );
}
```

**Update main error handler in `src/index.ts`:**

```typescript
} catch (error) {
  let errorResponse: StructuredError;

  if (error instanceof LaterError) {
    errorResponse = error.toJSON();
  } else if (error instanceof Error) {
    errorResponse = {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      data: {
        details: error.stack?.split('\n')[0],
      },
    };
  } else {
    errorResponse = {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Unknown error occurred',
    };
  }

  log.error('tool_error', {
    tool: name,
    error_code: errorResponse.code,
    error_message: errorResponse.message,
  });

  return {
    content: [
      {
        type: 'text',
        text: `❌ Error (${errorResponse.code}): ${errorResponse.message}${
          errorResponse.data?.details ? `\n\nDetails: ${errorResponse.data.details}` : ''
        }${
          errorResponse.data?.allowed_values
            ? `\n\nAllowed values: ${errorResponse.data.allowed_values.join(', ')}`
            : ''
        }`,
      },
    ],
    isError: true,
  };
}
```

### 3.2 Structured Logging

**File:** `src/utils/logger.ts` (NEW)

```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  NOTICE = 2,
  WARNING = 3,
  ERROR = 4,
  CRITICAL = 5,
}

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  constructor(private namespace: string, private minLevel: LogLevel = LogLevel.INFO) {}

  private log(level: LogLevel, event: string, context?: LogContext) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    const logEntry = {
      timestamp,
      level: levelName,
      namespace: this.namespace,
      event,
      ...context,
    };

    // All logs to stderr (MCP requirement)
    console.error(JSON.stringify(logEntry));
  }

  debug(event: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, event, context);
  }

  info(event: string, context?: LogContext) {
    this.log(LogLevel.INFO, event, context);
  }

  notice(event: string, context?: LogContext) {
    this.log(LogLevel.NOTICE, event, context);
  }

  warn(event: string, context?: LogContext) {
    this.log(LogLevel.WARNING, event, context);
  }

  error(event: string, context?: LogContext) {
    this.log(LogLevel.ERROR, context);
  }

  critical(event: string, context?: LogContext) {
    this.log(LogLevel.CRITICAL, event, context);
  }

  metric(name: string, value: number, context?: LogContext) {
    this.log(LogLevel.INFO, `metric:${name}`, { value, ...context });
  }
}

export function createLogger(namespace: string): Logger {
  const minLevel = process.env.LOG_LEVEL
    ? (LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO)
    : LogLevel.INFO;

  return new Logger(namespace, minLevel);
}
```

**Add request tracing middleware:**

```typescript
// src/index.ts - Wrap all tool handlers

import { randomUUID } from 'crypto';

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = randomUUID();
  const startTime = Date.now();

  log.info('request_start', {
    request_id: requestId,
    tool: request.params.name,
    args: sanitizeForLogging(request.params.arguments),
  });

  try {
    // ... existing handler logic ...

    const duration = Date.now() - startTime;
    log.info('request_complete', {
      request_id: requestId,
      tool: request.params.name,
      duration_ms: duration,
      success: true,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('request_failed', {
      request_id: requestId,
      tool: request.params.name,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
});

function sanitizeForLogging(args: any): any {
  // Remove sensitive data from logs
  const sanitized = { ...args };
  if (sanitized.context && sanitized.context.length > 100) {
    sanitized.context = sanitized.context.substring(0, 100) + '...';
  }
  return sanitized;
}
```

---

## 🔧 Phase 4: Enhanced Validation & Security (P1 - Critical)

**Objective:** Runtime validation, rate limiting, improved duplicate detection
**Duration:** 4-5 hours
**Tests Required:** 40+ new tests

### 4.1 Apply Zod Validation to All Tools

Already added in Phase 1. Extend to all operations:

```typescript
// src/tools/capture.ts - Update to use validation
import { validateCapture } from '../utils/validation.js';

export async function handleCapture(args: CaptureArgs, storage: Storage) {
  // Validate first
  const validation = validateCapture(args);
  if (!validation.valid) {
    throw new ValidationError('args', validation.errors.join(', '));
  }

  // ... rest of logic
}
```

### 4.2 Improved Duplicate Detection

**File:** `src/utils/duplicate.ts` - Replace existing with enhanced version

```typescript
import type { DeferredItem } from '../types.js';

export interface SimilarityResult {
  score: number;  // 0-1, 1 = identical
  reason: string;
  item: DeferredItem;
}

export async function findSimilarItems(
  decision: string,
  context: string,
  existingItems: DeferredItem[],
  threshold: number = 0.8
): Promise<SimilarityResult[]> {
  const similar: SimilarityResult[] = [];

  // Only check pending and in-progress items
  const activeItems = existingItems.filter(
    item => item.status === 'pending' || item.status === 'in-progress'
  );

  for (const item of activeItems) {
    const score = calculateSimilarity(decision, context, item);

    if (score >= threshold) {
      similar.push({
        score,
        reason: getSimil ityReason(score),
        item,
      });
    }
  }

  // Sort by similarity score descending
  return similar.sort((a, b) => b.score - a.score);
}

function calculateSimilarity(
  decision: string,
  context: string,
  item: DeferredItem
): number {
  // Multi-stage similarity

  // 1. Normalize text
  const normDecision1 = normalize(decision);
  const normDecision2 = normalize(item.decision);
  const normContext1 = normalize(context);
  const normContext2 = normalize(item.context);

  // 2. Exact match after normalization (fast path)
  if (normDecision1 === normDecision2) return 1.0;

  // 3. Token-based similarity (Jaccard)
  const decisionScore = jaccardSimilarity(normDecision1, normDecision2);
  const contextScore = jaccardSimilarity(normContext1, normContext2);

  // 4. Fuzzy string match (Levenshtein)
  const fuzzyScore = 1 - (levenshtein(normDecision1, normDecision2) / Math.max(normDecision1.length, normDecision2.length));

  // Weighted combination
  // Decision is most important (60%), context adds context (20%), fuzzy for typos (20%)
  return (decisionScore * 0.6) + (contextScore * 0.2) + (fuzzyScore * 0.2);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(text1.split(' ').filter(t => t.length > 0));
  const tokens2 = new Set(text2.split(' ').filter(t => t.length > 0));

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function levenshtein(s1: string, s2: string): number {
  // Existing implementation (keep as-is)
  // ...
}

function getSimilarityReason(score: number): string {
  if (score >= 0.95) return 'Nearly identical';
  if (score >= 0.85) return 'Very similar';
  if (score >= 0.75) return 'Similar';
  return 'Somewhat similar';
}
```

### 4.3 Enhanced Lock Management

**File:** `src/storage/jsonl.ts` - Update withLock method

```typescript
private async withLock<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 50;
  const baseDelay = 100; // ms
  let retries = 0;
  let acquired = false;

  while (!acquired && retries < maxRetries) {
    try {
      // Check for stale lock
      await this.cleanStaleLock();

      // Try to create lock file
      await fs.writeFile(this.lockFile, String(process.pid), { flag: 'wx' });
      acquired = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // Lock held, exponential backoff
        const delay = Math.min(baseDelay * Math.pow(1.5, retries), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        throw error;
      }
    }
  }

  if (!acquired) {
    throw new LaterError(
      ERROR_CODES.LOCK_TIMEOUT,
      'Failed to acquire lock after 5 seconds',
      { retry_after: 1000 }
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
      // Invalid lock file, remove
      await fs.unlink(this.lockFile);
      return;
    }

    // Check if process is still alive
    try {
      process.kill(lockPid, 0); // Signal 0 = test if process exists
      // Process alive, lock is valid
    } catch {
      // Process dead, remove stale lock
      await fs.unlink(this.lockFile);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Ignore if lock file doesn't exist
      throw error;
    }
  }
}
```

---

## 🔧 Phase 5: Advanced Features (P2 - Important)

**Objective:** Bulk operations, search, rich relationships
**Duration:** 6-8 hours
**Tests Required:** 50+ new tests

### 5.1 Bulk Operations

**File:** `src/tools/bulk.ts` (NEW)

```typescript
import type { Storage } from '../storage/interface.js';
import type { DeferredItem } from '../types.js';
import { handleUpdate } from './update.js';
import { handleDelete } from './delete.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:bulk');

export interface BulkUpdateArgs {
  ids: number[];
  changes: {
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'in-progress' | 'done' | 'archived';
  };
}

export interface BulkDeleteArgs {
  ids: number[];
  permanent?: boolean;
}

export async function handleBulkUpdate(
  args: BulkUpdateArgs,
  storage: Storage
): Promise<{ success: boolean; updated: number[]; failed: Array<{ id: number; error: string }> }> {
  const updated: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of args.ids) {
    try {
      await handleUpdate({ id, ...args.changes }, storage);
      updated.push(id);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  log.info('bulk_update_complete', {
    total: args.ids.length,
    updated: updated.length,
    failed: failed.length,
  });

  return { success: failed.length === 0, updated, failed };
}

export async function handleBulkDelete(
  args: BulkDeleteArgs,
  storage: Storage
): Promise<{ success: boolean; deleted: number[]; failed: Array<{ id: number; error: string }> }> {
  const deleted: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of args.ids) {
    try {
      await handleDelete({ id, permanent: args.permanent }, storage);
      deleted.push(id);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  log.info('bulk_delete_complete', {
    total: args.ids.length,
    deleted: deleted.length,
    failed: failed.length,
  });

  return { success: failed.length === 0, deleted, failed };
}
```

**Register in MCP Server:**

```typescript
{
  name: 'later_bulk_update',
  description: 'Update multiple items at once. Applies same changes to all specified items.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'number' }, description: 'Array of item IDs to update' },
      changes: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          status: { type: 'string', enum: ['pending', 'in-progress', 'done', 'archived'] },
        },
      },
    },
    required: ['ids', 'changes'],
  },
},
{
  name: 'later_bulk_delete',
  description: 'Delete multiple items at once.',
  inputSchema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'number' }, description: 'Array of item IDs to delete' },
      permanent: { type: 'boolean', description: 'If true, hard delete. Otherwise archive.' },
    },
    required: ['ids'],
  },
}
```

### 5.2 Full-Text Search

**File:** `src/tools/search.ts` (NEW)

```typescript
import type { Storage } from '../storage/interface.js';
import type { DeferredItem } from '../types.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('later:search');

export interface SearchArgs {
  query: string;
  limit?: number;
}

export async function handleSearch(
  args: SearchArgs,
  storage: Storage
): Promise<{ items: DeferredItem[]; scores: Map<number, number> }> {
  const items = await storage.readAll();
  const query = args.query.toLowerCase();

  // Calculate relevance scores
  const scored: Array<{ item: DeferredItem; score: number }> = items
    .map(item => ({
      item,
      score: calculateRelevance(item, query),
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const limit = args.limit || 20;
  const topResults = scored.slice(0, limit);

  log.info('search_complete', {
    query,
    total_matches: scored.length,
    returned: topResults.length,
  });

  return {
    items: topResults.map(s => s.item),
    scores: new Map(topResults.map(s => [s.item.id, s.score])),
  };
}

function calculateRelevance(item: DeferredItem, query: string): number {
  let score = 0;

  const decision = item.decision.toLowerCase();
  const context = item.context.toLowerCase();
  const tags = item.tags.join(' ').toLowerCase();

  // Exact phrase match (highest weight)
  if (decision.includes(query)) score += 10;
  if (context.includes(query)) score += 5;
  if (tags.includes(query)) score += 3;

  // Individual word matches
  const queryWords = query.split(/\s+/);
  for (const word of queryWords) {
    if (word.length < 3) continue; // Skip short words

    if (decision.includes(word)) score += 2;
    if (context.includes(word)) score += 1;
    if (tags.includes(word)) score += 1;
  }

  // Boost recent items
  const ageInDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) score *= 1.5;
  else if (ageInDays < 30) score *= 1.2;

  // Boost by priority
  if (item.priority === 'high') score *= 1.3;
  else if (item.priority === 'medium') score *= 1.1;

  return score;
}
```

---

## 🔧 Phase 6: Testing & Documentation (P1 - Critical)

**Objective:** Comprehensive tests, migration guide, API docs
**Duration:** 6-8 hours

### 6.1 Test Coverage

**Create test files for all new features:**

```bash
tests/
├── tools/
│   ├── update.test.ts        # NEW - 30+ tests
│   ├── delete.test.ts        # NEW - 25+ tests
│   ├── list-advanced.test.ts # NEW - 40+ tests
│   ├── bulk.test.ts          # NEW - 30+ tests
│   └── search.test.ts        # NEW - 25+ tests
├── utils/
│   ├── validation.test.ts    # NEW - 35+ tests
│   ├── query.test.ts         # NEW - 40+ tests
│   ├── state-machine.test.ts # NEW - 15+ tests
│   ├── errors.test.ts        # NEW - 20+ tests
│   └── logger.test.ts        # NEW - 15+ tests
└── integration/
    ├── crud-complete.test.ts # NEW - Full CRUD flow
    ├── pagination.test.ts    # NEW - Pagination scenarios
    └── error-handling.test.ts # NEW - Error scenarios
```

**Test Template Example (`tests/tools/update.test.ts`):**

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { JSONLStorage } from '../../src/storage/jsonl.js';
import { handleUpdate } from '../../src/tools/update.js';
import type { DeferredItem } from '../../src/types.js';

describe('handleUpdate', () => {
  let storage: JSONLStorage;
  let testItem: DeferredItem;

  beforeEach(async () => {
    storage = new JSONLStorage('/tmp/later-test-update');
    // Setup test data
  });

  it('should update decision text', async () => {
    const result = await handleUpdate({
      id: testItem.id,
      decision: 'Updated decision',
    }, storage);

    expect(result.success).toBe(true);
    expect(result.item?.decision).toBe('Updated decision');
  });

  it('should validate state transitions', async () => {
    // ... test invalid transitions
  });

  it('should detect dependency cycles', async () => {
    // ... test cycle detection
  });

  // ... 30+ more tests
});
```

### 6.2 Migration Guide

**File:** `docs/getting-started/migration-v1-to-v2.md` (NEW)

```markdown
# Migration Guide: v1.0 → v2.0

## Breaking Changes

**None** - v2.0 is backward compatible with v1.0

## New Features

### 1. Update Operation

**Before (v1.0):** Could not modify items after creation

**After (v2.0):**
\`\`\`typescript
later_update({
  id: 123,
  decision: "Updated text",
  priority: "high"
})
\`\`\`

### 2. Delete Operation

**Before (v1.0):** Could only archive via status change

**After (v2.0):**
\`\`\`typescript
// Soft delete (archive)
later_delete({ id: 123 })

// Hard delete
later_delete({ id: 123, permanent: true })
\`\`\`

### 3. Advanced Filtering

**Before (v1.0):** Basic status/tag/priority filters

**After (v2.0):**
\`\`\`typescript
later_list({
  filters: {
    decision: { contains: "api" },
    priority: { in: ["high", "medium"] },
    created_at: { gte: Date.now() - 7 * 24 * 60 * 60 * 1000 } // Last 7 days
  },
  orderBy: [
    { field: "priority", direction: "DESC" },
    { field: "created_at", direction: "DESC" }
  ],
  pagination: { first: 20 }
})
\`\`\`

### 4. Pagination

**Before (v1.0):** Limited to simple `limit` parameter

**After (v2.0):**
\`\`\`typescript
// First page
const page1 = later_list({ pagination: { first: 20 } });

// Next page
const page2 = later_list({
  pagination: {
    first: 20,
    after: page1.pageInfo.endCursor
  }
});
\`\`\`

## Data Migration

**Not required** - Existing `.later/items.jsonl` works as-is

## Testing Upgrade

1. Backup existing data: `cp ~/.later/items.jsonl ~/.later/items.jsonl.backup`
2. Test new features in isolated directory
3. Verify backward compatibility with existing workflows
```

### 6.3 API Documentation

**File:** `docs/technical/api-reference.md` (UPDATE)

Generate from MCP tool schemas (auto-documentation pattern)

---

## 📊 Success Criteria & Validation

### Phase Completion Checklist

**Phase 1 (CRUD):**
- [ ] `later_update` tool registered and working
- [ ] `later_delete` tool registered and working
- [ ] State machine validates transitions
- [ ] Dependency cycle detection working
- [ ] 40+ tests passing
- [ ] Zero breaking changes to existing tools

**Phase 2 (Pagination):**
- [ ] Cursor-based pagination implemented
- [ ] Advanced filtering working (all operators)
- [ ] Custom sorting working (multi-field)
- [ ] Backward compatible with legacy `limit` param
- [ ] 50+ tests passing
- [ ] Performance: <50ms for 1000 items

**Phase 3 (Errors):**
- [ ] Structured errors with codes
- [ ] JSON-RPC compliant error format
- [ ] Comprehensive logging (all operations)
- [ ] Request tracing with UUIDs
- [ ] 30+ tests passing

**Phase 4 (Validation):**
- [ ] Zod schemas for all operations
- [ ] Enhanced duplicate detection (Jaccard + Levenshtein)
- [ ] Stale lock detection working
- [ ] Exponential backoff in locks
- [ ] 40+ tests passing

**Phase 5 (Advanced):**
- [ ] Bulk update/delete working
- [ ] Full-text search with relevance scoring
- [ ] 50+ tests passing

**Phase 6 (Testing/Docs):**
- [ ] 95%+ test coverage maintained
- [ ] All integration tests passing
- [ ] Migration guide complete
- [ ] API reference updated
- [ ] CHANGELOG updated

### Final Validation

```bash
# Run full test suite
npm test -- --coverage

# Verify coverage
# Target: 95%+ statements, 90%+ branches

# Test MCP server integration
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node dist/index.js

# Test all tools
npm run test:integration

# Performance benchmark
npm run benchmark # Should be <50ms for list with 1000 items
```

---

## 🚀 Implementation Order (Recommended)

### Week 1: Foundation
- Day 1-2: Phase 1 (Update/Delete)
- Day 3: Phase 3 (Errors/Logging)
- Day 4-5: Tests for Phase 1 & 3

### Week 2: Scaling
- Day 1-3: Phase 2 (Pagination/Filtering)
- Day 4: Phase 4 (Validation)
- Day 5: Tests for Phase 2 & 4

### Week 3: Polish
- Day 1-2: Phase 5 (Advanced features)
- Day 3-4: Phase 6 (Tests/Docs)
- Day 5: Final integration testing & release

---

## 🛡️ Rollback Plan

If issues arise:

1. **Immediate rollback:**
   ```bash
   git reset --hard baseline-pre-upgrade
   npm run build
   ```

2. **Partial rollback** (keep some features):
   - Each phase is independent
   - Can disable features by removing tool registrations
   - Data format unchanged (no migration needed)

3. **Data recovery:**
   - JSONL format unchanged
   - No destructive operations on upgrade
   - Backups automatic in `.later/` directory

---

## 📝 Post-Implementation

### Update CHANGELOG

```markdown
## [2.0.0] - 2025-11-06

### Added
- **Update operation** - Modify items after creation
- **Delete operation** - Soft and hard delete
- **Advanced filtering** - Multi-field filters with operators
- **Cursor-based pagination** - Efficient large dataset handling
- **Custom sorting** - Multi-field sort orders
- **Bulk operations** - Update/delete multiple items
- **Full-text search** - Relevance-scored search
- **Structured errors** - JSON-RPC compliant error codes
- **Comprehensive logging** - Request tracing and metrics
- **Enhanced validation** - Zod runtime validation
- **Improved duplicate detection** - Jaccard + Levenshtein similarity

### Changed
- State transitions now validated (state machine)
- Lock mechanism now detects stale locks
- Duplicate detection uses normalized text comparison

### Fixed
- Race conditions in concurrent updates
- Memory usage for large datasets (pagination)
- Error messages now actionable with codes

### Performance
- List operation: <50ms for 1000 items
- Update operation: <100ms
- Search: <500ms for 10K items

### Breaking Changes
- None (fully backward compatible)
```

---

## 🎯 Final Notes

**Critical Success Factors:**
1. **Incremental implementation** - Each phase is testable independently
2. **Zero breaking changes** - Existing 4 tools work unchanged
3. **Test-driven** - Write tests first (RED → GREEN → REFACTOR)
4. **Apple-style** - Simple interface, powerful internals
5. **Production-ready** - Error handling, logging, validation from day 1

**Quality Gates:**
- [ ] 95%+ test coverage maintained
- [ ] Zero breaking changes to existing tools
- [ ] All new features tested in isolation
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] CHANGELOG updated

**This upgrade transforms /later from MVP to production-grade, matching Linear/GitHub/Supabase quality standards while maintaining 100% backward compatibility.**
