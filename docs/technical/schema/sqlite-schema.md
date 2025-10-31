# SQLite Database Schema

**Last Updated:** 2025-10-31
**Schema Version:** 1.0

## Overview

SQLite backend is used when JSONL performance degrades (> 500 items OR search > 500ms). Provides indexed searches, full-text search (FTS5), and relational queries.

**Why SQLite:**
- ✅ ACID transactions (concurrent access safe)
- ✅ Indexed queries (O(log n) vs O(n))
- ✅ Full-text search (FTS5)
- ✅ Relations (dependencies, many-to-many)
- ✅ Scales to millions of items
- ✅ Battle-tested, stable format since 2004

## File Location

```
~/.later/deferred.db                  # SQLite database
~/.later/.using-sqlite                # Flag file (backend selector)
~/.later/deferred.jsonl.pre-migration # JSONL backup
```

## Schema Diagram

```
┌──────────────────────────────────────────┐
│ deferred_items (main table)             │
│────────────────────────────────────────  │
│ id INTEGER PRIMARY KEY                   │
│ title TEXT NOT NULL                      │
│ status TEXT NOT NULL                     │
│ priority TEXT DEFAULT 'medium'           │
│ captured_at TEXT NOT NULL                │
│ updated_at TEXT NOT NULL                 │
│ context_summary TEXT                     │
│ context_conversation_id TEXT             │
│ context_last_messages TEXT (JSON)        │
│ metadata TEXT (JSON)                     │
│ resolved_by TEXT                         │
└──────────────────────────────────────────┘
          │
          │ 1:N
          ▼
┌──────────────────────────────────────────┐
│ categories (many-to-many)                │
│────────────────────────────────────────  │
│ item_id INTEGER → deferred_items.id      │
│ category TEXT                            │
│ PRIMARY KEY (item_id, category)          │
└──────────────────────────────────────────┘

          │
          │ 1:N
          ▼
┌──────────────────────────────────────────┐
│ tags (many-to-many)                      │
│────────────────────────────────────────  │
│ item_id INTEGER → deferred_items.id      │
│ tag TEXT                                 │
│ PRIMARY KEY (item_id, tag)               │
└──────────────────────────────────────────┘

          │
          │ 1:N
          ▼
┌──────────────────────────────────────────┐
│ dependencies (graph)                     │
│────────────────────────────────────────  │
│ item_id INTEGER → deferred_items.id      │
│ depends_on_id INTEGER → deferred_items.id│
│ PRIMARY KEY (item_id, depends_on_id)     │
└──────────────────────────────────────────┘

          │
          │ 1:N
          ▼
┌──────────────────────────────────────────┐
│ linked_todos (tracking)                  │
│────────────────────────────────────────  │
│ item_id INTEGER → deferred_items.id      │
│ todo_id INTEGER                          │
│ todo_status TEXT                         │
│ PRIMARY KEY (item_id, todo_id)           │
└──────────────────────────────────────────┘

          │
          │ FTS5
          ▼
┌──────────────────────────────────────────┐
│ deferred_fts (full-text search)          │
│────────────────────────────────────────  │
│ id INTEGER                               │
│ title TEXT                               │
│ context_summary TEXT                     │
│ VIRTUAL TABLE USING fts5                 │
└──────────────────────────────────────────┘
```

## Table Definitions

### deferred_items (Main Table)

```sql
CREATE TABLE deferred_items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) <= 200),
  status TEXT NOT NULL CHECK(status IN ('deferred', 'in_progress', 'done', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
  captured_at TEXT NOT NULL,  -- ISO 8601 UTC
  updated_at TEXT NOT NULL,   -- ISO 8601 UTC
  context_summary TEXT,
  context_conversation_id TEXT,
  context_last_messages TEXT, -- JSON array
  metadata TEXT,              -- JSON object
  resolved_by TEXT            -- Git commit SHA
);

-- Indexes for common queries
CREATE INDEX idx_status ON deferred_items(status);
CREATE INDEX idx_priority ON deferred_items(priority);
CREATE INDEX idx_captured_at ON deferred_items(captured_at);
CREATE INDEX idx_updated_at ON deferred_items(updated_at);
```

### categories (Many-to-Many)

```sql
CREATE TABLE categories (
  item_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (item_id, category),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

-- Index for category filtering
CREATE INDEX idx_categories_category ON categories(category);
```

**Example data:**
```sql
-- Item 3 has multiple categories
INSERT INTO categories VALUES (3, 'optimization');
INSERT INTO categories VALUES (3, 'optimization:performance');
INSERT INTO categories VALUES (3, 'decision');
```

**Query:**
```sql
-- Find all optimization items (hierarchical)
SELECT item_id FROM categories WHERE category LIKE 'optimization%';
```

### tags (Many-to-Many)

```sql
CREATE TABLE tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

-- Index for tag filtering
CREATE INDEX idx_tags_tag ON tags(tag);
```

### dependencies (Graph Structure)

```sql
CREATE TABLE dependencies (
  item_id INTEGER NOT NULL,
  depends_on_id INTEGER NOT NULL,
  PRIMARY KEY (item_id, depends_on_id),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES deferred_items(id) ON DELETE CASCADE,
  CHECK (item_id != depends_on_id)  -- Can't depend on self
);

-- Indexes for graph traversal
CREATE INDEX idx_dependencies_item ON dependencies(item_id);
CREATE INDEX idx_dependencies_depends_on ON dependencies(depends_on_id);
```

**Example:**
```sql
-- Item 5 depends on items 3 and 4
INSERT INTO dependencies VALUES (5, 3);
INSERT INTO dependencies VALUES (5, 4);

-- Query: What does item 5 depend on?
SELECT depends_on_id FROM dependencies WHERE item_id = 5;

-- Query: What depends on item 3?
SELECT item_id FROM dependencies WHERE depends_on_id = 3;
```

### linked_todos (TodoWrite Integration)

```sql
CREATE TABLE linked_todos (
  item_id INTEGER NOT NULL,
  todo_id INTEGER NOT NULL,
  todo_status TEXT NOT NULL,
  PRIMARY KEY (item_id, todo_id),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_linked_todos_item ON linked_todos(item_id);
```

### deferred_fts (Full-Text Search)

```sql
CREATE VIRTUAL TABLE deferred_fts USING fts5(
  id UNINDEXED,
  title,
  context_summary,
  content='deferred_items',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER deferred_items_ai AFTER INSERT ON deferred_items BEGIN
  INSERT INTO deferred_fts(rowid, id, title, context_summary)
  VALUES (new.id, new.id, new.title, new.context_summary);
END;

CREATE TRIGGER deferred_items_ad AFTER DELETE ON deferred_items BEGIN
  DELETE FROM deferred_fts WHERE rowid = old.id;
END;

CREATE TRIGGER deferred_items_au AFTER UPDATE ON deferred_items BEGIN
  UPDATE deferred_fts
  SET title = new.title, context_summary = new.context_summary
  WHERE rowid = new.id;
END;
```

**FTS5 Search:**
```sql
-- Full-text search
SELECT * FROM deferred_items
WHERE id IN (
  SELECT id FROM deferred_fts WHERE deferred_fts MATCH 'optimization'
);

-- Ranked search
SELECT *, rank FROM deferred_fts
WHERE deferred_fts MATCH 'database performance'
ORDER BY rank
LIMIT 20;
```

## Common Queries

### List Items with Filters

```sql
-- All deferred items, recent first
SELECT * FROM deferred_items
WHERE status = 'deferred'
ORDER BY captured_at DESC
LIMIT 20;

-- High priority items
SELECT * FROM deferred_items
WHERE priority = 'high' AND status = 'deferred'
ORDER BY captured_at DESC;

-- Items by category (hierarchical)
SELECT d.* FROM deferred_items d
JOIN categories c ON d.id = c.item_id
WHERE c.category LIKE 'optimization%'
ORDER BY d.captured_at DESC;

-- Items with specific tag
SELECT d.* FROM deferred_items d
JOIN tags t ON d.id = t.item_id
WHERE t.tag = 'security'
ORDER BY d.captured_at DESC;
```

### Search with Ranking

```sql
-- Full-text search with ranking
SELECT
  d.*,
  f.rank
FROM deferred_fts f
JOIN deferred_items d ON f.id = d.id
WHERE f MATCH 'optimization performance'
ORDER BY f.rank
LIMIT 20;
```

### Dependency Queries

```sql
-- Items blocked by other items
SELECT
  d.id,
  d.title,
  GROUP_CONCAT(dep.depends_on_id) AS blocked_by
FROM deferred_items d
LEFT JOIN dependencies dep ON d.id = dep.item_id
GROUP BY d.id;

-- Dependency chain (recursive)
WITH RECURSIVE dep_chain AS (
  SELECT item_id, depends_on_id, 1 AS depth
  FROM dependencies
  WHERE item_id = 5

  UNION ALL

  SELECT d.item_id, d.depends_on_id, dc.depth + 1
  FROM dependencies d
  JOIN dep_chain dc ON d.item_id = dc.depends_on_id
  WHERE dc.depth < 10  -- Prevent infinite loop
)
SELECT * FROM dep_chain;
```

### Statistics

```sql
-- Item counts by status
SELECT status, COUNT(*) FROM deferred_items GROUP BY status;

-- Item counts by priority
SELECT priority, COUNT(*) FROM deferred_items GROUP BY priority;

-- Top categories
SELECT category, COUNT(*) FROM categories GROUP BY category ORDER BY COUNT(*) DESC LIMIT 10;

-- Items by month
SELECT strftime('%Y-%m', captured_at) AS month, COUNT(*)
FROM deferred_items
GROUP BY month
ORDER BY month DESC;
```

## Configuration

### WAL Mode (Write-Ahead Logging)

```sql
PRAGMA journal_mode = WAL;  -- Better concurrency
PRAGMA synchronous = NORMAL; -- Faster writes (still safe)
```

**Benefits:**
- Multiple readers + single writer (concurrent)
- Faster writes (no blocking)
- Atomic commits

### Foreign Keys

```sql
PRAGMA foreign_keys = ON;  -- Enforce referential integrity
```

**Ensures:**
- Deleting item cascades to categories, tags, dependencies
- Can't reference non-existent items

### Query Optimization

```sql
ANALYZE;  -- Update query planner statistics
```

**Run after:**
- Initial migration (large data import)
- Bulk operations (archive, mass update)

## Schema Migrations

### Version 1.0 → 1.1 (Example)

```sql
-- Add new column
ALTER TABLE deferred_items ADD COLUMN complexity TEXT;

-- Update schema version
PRAGMA user_version = 1;
```

### Backward Compatibility

- Additive changes only (new columns, new tables)
- Never remove columns (mark deprecated instead)
- Optional fields use NULL (existing data unaffected)

## Performance Characteristics

**Operation times (10,000 items):**

| Operation | Time | Method |
|-----------|------|--------|
| List (20 items) | < 10ms | Indexed query |
| Search (FTS5) | < 20ms | Full-text index |
| Get by ID | < 5ms | PRIMARY KEY lookup |
| Insert | < 10ms | Single INSERT |
| Update | < 10ms | Single UPDATE |
| Delete | < 10ms | CASCADE delete |

**Scaling:**
- 10K items: Fast (< 50ms)
- 100K items: Still fast (< 100ms)
- 1M items: Acceptable (< 500ms)

## Related Documents

- **[JSONL Format](jsonl-format.md)** - Source format
- **[Migration Guide](migration-guide.md)** - JSONL → SQLite process
- **[Scaling Strategy](../../architecture/decisions/scaling-strategy.md)** - When to migrate

---

**Schema Version:** 1.0
**Compatibility:** Forward-compatible (additive changes only)
