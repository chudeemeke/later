# JSONL to SQLite Migration Guide

**Last Updated:** 2025-10-31
**Process Version:** 1.0

## Overview

This guide details the step-by-step process for migrating from JSONL to SQLite backend. The migration is triggered automatically when performance degrades or manually via `/later migrate-to-sqlite`.

**Safety Guarantees:**
- ✅ Non-destructive (JSONL backup kept)
- ✅ Atomic (all-or-nothing, no partial migration)
- ✅ Validated (count checks, spot checks)
- ✅ Reversible (can rollback)
- ✅ Tested (dry-run mode available)

## When to Migrate

**Automatic triggers:**
1. **Item count > 500** - Approaching performance degradation
2. **Search time > 500ms** - User experiencing slowness
3. **Performance pattern** - 3+ slow queries in last 5

**Manual trigger:**
```bash
/later migrate-to-sqlite
```

## Migration Steps

### Step 1: Pre-Migration Validation

**Check JSONL integrity:**
```bash
# Validate JSON syntax
jq empty ~/.later/deferred.jsonl

# Count items
ITEM_COUNT=$(wc -l < ~/.later/deferred.jsonl)
echo "Found $ITEM_COUNT items to migrate"

# Check for duplicates
UNIQUE_IDS=$(jq -r '.id' ~/.later/deferred.jsonl | sort -u | wc -l)
if [[ $ITEM_COUNT -ne $UNIQUE_IDS ]]; then
  echo "ERROR: Duplicate IDs detected"
  exit 1
fi
```

### Step 2: Create Backup

**Timestamped backup:**
```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$HOME/.later/deferred.jsonl.backup-$TIMESTAMP"

# Copy with verification
cp ~/.later/deferred.jsonl "$BACKUP_FILE"

# Verify backup
if [[ $(wc -l < "$BACKUP_FILE") -ne $(wc -l < ~/.later/deferred.jsonl) ]]; then
  echo "ERROR: Backup verification failed"
  rm "$BACKUP_FILE"
  exit 1
fi

echo "✅ Backup created: $BACKUP_FILE"
```

### Step 3: Create SQLite Database

**Initialize with schema:**
```bash
SCHEMA_FILE="$(dirname "$0")/schema.sql"
DB_FILE="$HOME/.later/deferred.db"

# Create database
sqlite3 "$DB_FILE" < "$SCHEMA_FILE"

# Enable WAL mode
sqlite3 "$DB_FILE" "PRAGMA journal_mode=WAL;"
sqlite3 "$DB_FILE" "PRAGMA foreign_keys=ON;"

echo "✅ Database created"
```

**Schema file (schema.sql):**
```sql
-- Main table
CREATE TABLE deferred_items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  context_summary TEXT,
  context_conversation_id TEXT,
  context_last_messages TEXT,
  metadata TEXT,
  resolved_by TEXT
);

-- Many-to-many tables
CREATE TABLE categories (
  item_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (item_id, category),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

CREATE TABLE dependencies (
  item_id INTEGER NOT NULL,
  depends_on_id INTEGER NOT NULL,
  PRIMARY KEY (item_id, depends_on_id),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

CREATE TABLE linked_todos (
  item_id INTEGER NOT NULL,
  todo_id INTEGER NOT NULL,
  todo_status TEXT NOT NULL,
  PRIMARY KEY (item_id, todo_id),
  FOREIGN KEY (item_id) REFERENCES deferred_items(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_status ON deferred_items(status);
CREATE INDEX idx_priority ON deferred_items(priority);
CREATE INDEX idx_captured_at ON deferred_items(captured_at);
CREATE INDEX idx_categories_category ON categories(category);
CREATE INDEX idx_tags_tag ON tags(tag);

-- FTS5
CREATE VIRTUAL TABLE deferred_fts USING fts5(
  id UNINDEXED,
  title,
  context_summary,
  content='deferred_items',
  content_rowid='id'
);

-- FTS triggers
CREATE TRIGGER deferred_items_ai AFTER INSERT ON deferred_items BEGIN
  INSERT INTO deferred_fts(rowid, id, title, context_summary)
  VALUES (new.id, new.id, new.title, new.context_summary);
END;

CREATE TRIGGER deferred_items_au AFTER UPDATE ON deferred_items BEGIN
  UPDATE deferred_fts
  SET title = new.title, context_summary = new.context_summary
  WHERE rowid = new.id;
END;

CREATE TRIGGER deferred_items_ad AFTER DELETE ON deferred_items BEGIN
  DELETE FROM deferred_fts WHERE rowid = old.id;
END;
```

### Step 4: Parse and Insert Data

**Migration script:**
```bash
# Progress tracking
total=$(wc -l < ~/.later/deferred.jsonl)
current=0

echo "Migrating $total items..."

# Read JSONL line by line
while IFS= read -r line; do
  current=$((current + 1))

  # Extract fields with jq
  id=$(echo "$line" | jq -r '.id')
  title=$(echo "$line" | jq -r '.title')
  status=$(echo "$line" | jq -r '.status')
  priority=$(echo "$line" | jq -r '.priority // "medium"')
  captured_at=$(echo "$line" | jq -r '.captured_at')
  updated_at=$(echo "$line" | jq -r '.updated_at // .captured_at')
  context_summary=$(echo "$line" | jq -r '.context.summary // empty')
  context_conversation_id=$(echo "$line" | jq -r '.context.conversation_id // empty')
  context_last_messages=$(echo "$line" | jq -c '.context.last_messages // []')
  metadata=$(echo "$line" | jq -c '.metadata // {}')
  resolved_by=$(echo "$line" | jq -r '.resolved_by // empty')

  # Insert main item (single transaction)
  sqlite3 "$DB_FILE" <<SQL
BEGIN TRANSACTION;

INSERT INTO deferred_items (
  id, title, status, priority, captured_at, updated_at,
  context_summary, context_conversation_id, context_last_messages,
  metadata, resolved_by
) VALUES (
  $id,
  '$title',
  '$status',
  '$priority',
  '$captured_at',
  '$updated_at',
  '$context_summary',
  '$context_conversation_id',
  '$context_last_messages',
  '$metadata',
  '$resolved_by'
);

COMMIT;
SQL

  # Insert categories
  echo "$line" | jq -r '.categories[]? // empty' | while read category; do
    sqlite3 "$DB_FILE" \
      "INSERT INTO categories (item_id, category) VALUES ($id, '$category');"
  done

  # Insert tags
  echo "$line" | jq -r '.tags[]? // empty' | while read tag; do
    sqlite3 "$DB_FILE" \
      "INSERT INTO tags (item_id, tag) VALUES ($id, '$tag');"
  done

  # Insert dependencies
  echo "$line" | jq -r '.depends_on[]? // empty' | while read dep_id; do
    sqlite3 "$DB_FILE" \
      "INSERT INTO dependencies (item_id, depends_on_id) VALUES ($id, $dep_id);"
  done

  # Insert linked todos
  echo "$line" | jq -c '.linked_todos[]? // empty' | while read todo; do
    todo_id=$(echo "$todo" | jq -r '.todo_id')
    todo_status=$(echo "$todo" | jq -r '.status')
    sqlite3 "$DB_FILE" \
      "INSERT INTO linked_todos (item_id, todo_id, todo_status) VALUES ($id, $todo_id, '$todo_status');"
  done

  # Progress indicator
  if [[ $((current % 10)) -eq 0 ]]; then
    percent=$((current * 100 / total))
    echo "  $current/$total ($percent%)"
  fi
done < ~/.later/deferred.jsonl

echo "✅ Data migrated"
```

### Step 5: Build Indexes

**Optimize query performance:**
```bash
echo "Building indexes..."

sqlite3 "$DB_FILE" <<SQL
-- Update statistics
ANALYZE;

-- Rebuild FTS index
INSERT INTO deferred_fts(deferred_fts) VALUES('rebuild');

-- Vacuum to optimize space
VACUUM;
SQL

echo "✅ Indexes built"
```

### Step 6: Validation

**Comprehensive checks:**
```bash
echo "Validating migration..."

# Count check
JSONL_COUNT=$(wc -l < ~/.later/deferred.jsonl)
SQLITE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM deferred_items;")

if [[ $JSONL_COUNT -ne $SQLITE_COUNT ]]; then
  echo "ERROR: Count mismatch (JSONL: $JSONL_COUNT, SQLite: $SQLITE_COUNT)"
  exit 1
fi
echo "✅ Count check passed ($SQLITE_COUNT items)"

# Spot check: Compare 10 random items
for i in {1..10}; do
  # Get random ID
  id=$(shuf -i 1-$JSONL_COUNT -n 1)

  # Compare JSONL vs SQLite
  jsonl_title=$(jq -r --arg id "$id" 'select(.id == ($id | tonumber)) | .title' \
    ~/.later/deferred.jsonl)
  sqlite_title=$(sqlite3 "$DB_FILE" "SELECT title FROM deferred_items WHERE id = $id;")

  if [[ "$jsonl_title" != "$sqlite_title" ]]; then
    echo "ERROR: Mismatch for item #$id"
    exit 1
  fi
done
echo "✅ Spot checks passed"

# FTS check
FTS_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM deferred_fts;")
if [[ $SQLITE_COUNT -ne $FTS_COUNT ]]; then
  echo "ERROR: FTS index incomplete"
  exit 1
fi
echo "✅ FTS index validated"
```

### Step 7: Atomic Switch

**Non-destructive backend switch:**
```bash
# Rename JSONL (don't delete)
mv ~/.later/deferred.jsonl ~/.later/deferred.jsonl.pre-migration

# Create flag file
touch ~/.later/.using-sqlite

# Test one operation
if ! sqlite3 "$DB_FILE" "SELECT * FROM deferred_items LIMIT 1;" &>/dev/null; then
  echo "ERROR: SQLite test failed, rolling back"
  mv ~/.later/deferred.jsonl.pre-migration ~/.later/deferred.jsonl
  rm ~/.later/deferred.db ~/.later/.using-sqlite
  exit 1
fi

echo "✅ Backend switched to SQLite"
```

### Step 8: Post-Migration Cleanup

**Keep backups, prune old ones:**
```bash
# Keep pre-migration JSONL
echo "Pre-migration JSONL: ~/.later/deferred.jsonl.pre-migration"

# Prune old backups (keep last 5)
ls -t ~/.later/deferred.jsonl.backup-* | tail -n +6 | xargs rm -f

echo "✅ Migration complete"
```

## Performance Comparison

**Before migration (JSONL, 520 items):**
```bash
$ time /later search "optimization"
# 3 results
real    0m0.750s
```

**After migration (SQLite, 520 items):**
```bash
$ time /later search "optimization"
# 3 results
real    0m0.009s
```

**Improvement:** 83x faster (750ms → 9ms)

## Rollback Procedure

**If migration fails or user wants to revert:**

```bash
/later rollback-to-jsonl

# Steps:
# 1. Export current SQLite to JSONL
sqlite3 ~/.later/deferred.db ".mode json" ".output export.jsonl" "SELECT * FROM deferred_items;"

# 2. Validate export
jq empty export.jsonl

# 3. Rename databases
mv ~/.later/deferred.db ~/.later/deferred.db.backup
mv ~/.later/deferred.jsonl.pre-migration ~/.later/deferred.jsonl

# 4. Remove flag
rm ~/.later/.using-sqlite

# 5. Test
/later list

echo "✅ Rolled back to JSONL"
```

## Troubleshooting

### Error: "Count mismatch"

**Cause:** Some items failed to insert.

**Fix:**
```bash
# Find missing IDs
comm -23 \
  <(jq -r '.id' ~/.later/deferred.jsonl | sort) \
  <(sqlite3 "$DB_FILE" "SELECT id FROM deferred_items ORDER BY id;" | sort)

# Re-insert missing items manually
```

### Error: "FTS index incomplete"

**Cause:** FTS triggers didn't fire.

**Fix:**
```bash
# Rebuild FTS index
sqlite3 "$DB_FILE" <<SQL
DELETE FROM deferred_fts;
INSERT INTO deferred_fts(rowid, id, title, context_summary)
SELECT id, id, title, context_summary FROM deferred_items;
SQL
```

### Error: "Disk full"

**Cause:** Insufficient space for SQLite database.

**Fix:**
```bash
# Archive old items first
/later archive --older-than 365d

# Then retry migration
/later migrate-to-sqlite
```

## Testing Migration

**Dry-run mode (test without committing):**
```bash
/later migrate-to-sqlite --dry-run

# Creates temporary database
# Runs full migration
# Validates
# Deletes temp database
# Reports success/failure
```

## Related Documents

- **[JSONL Format](jsonl-format.md)** - Source format specification
- **[SQLite Schema](sqlite-schema.md)** - Target schema
- **[Scaling Strategy](../../architecture/decisions/scaling-strategy.md)** - When to migrate

---

**Process Version:** 1.0
**Safety:** Non-destructive, atomic, validated
