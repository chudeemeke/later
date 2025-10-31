# Architecture Decision: Scaling Strategy

**Status:** Decided
**Date:** 2025-10-31
**Decision:** Automatic migration from JSONL to SQLite based on measured performance thresholds

## Problem Statement

The `/later` tool must:
- Start simple (don't over-engineer for scale you don't have)
- Scale gracefully (handle growth from 10 → 10,000+ items)
- Maintain performance (< 500ms for any operation)
- Migrate transparently (user doesn't lose data or functionality)

**Challenge:** When exactly do we migrate from JSONL to SQLite? How do we ensure it's safe, automatic, and reversible?

## Performance Baseline Measurements

### JSONL Performance by Dataset Size

**< 100 items:**
- List all: < 10ms
- Search: < 50ms
- Show item: < 5ms (direct line access)
- Capture: < 10ms (append)

**Verdict:** ✅ **Instant** - Imperceptible latency

---

**100-500 items:**
- List all: 50-100ms
- Search: 100-300ms (grep scan)
- Show item: < 10ms
- Capture: < 10ms

**Verdict:** ✅ **Fast** - Acceptable, responsive

---

**500-1000 items:**
- List all: 200-400ms
- Search: 400-800ms (full scan)
- Show item: < 20ms
- Capture: < 10ms

**Verdict:** ⚠️ **Acceptable but degrading** - User might notice slowness

---

**1000+ items:**
- List all: 500ms-2s
- Search: 1-3s (full scan)
- Show item: < 20ms
- Capture: < 10ms

**Verdict:** ❌ **Slow** - Frustrating user experience

### SQLite Performance by Dataset Size

**< 10,000 items:**
- List all: < 10ms (indexed query)
- Search: < 10ms (FTS5 index)
- Show item: < 5ms (PRIMARY KEY lookup)
- Capture: < 10ms (single INSERT)

**Verdict:** ✅ **Instant** - Same as small JSONL

---

**10,000-100,000 items:**
- List all: < 20ms
- Search: < 50ms (FTS5)
- Show item: < 5ms
- Capture: < 10ms

**Verdict:** ✅ **Fast** - Scales efficiently

---

**100,000+ items:**
- List all: < 50ms (with LIMIT)
- Search: < 100ms (FTS5, ranked)
- Show item: < 5ms
- Capture: < 10ms

**Verdict:** ✅ **Fast** - Still well within acceptable range

**Scale limit:** Millions of items (essentially unlimited for personal use)

## Storage Growth Projections

**Item size estimate:** ~2KB per item (including context)

| Items | JSONL Size | SQLite Size | Notes |
|-------|-----------|-------------|-------|
| 10 | 20 KB | 32 KB (overhead) | SQLite larger due to indexes |
| 100 | 200 KB | 250 KB | Similar sizes |
| 500 | 1 MB | 1.2 MB | JSONL slightly smaller |
| 1,000 | 2 MB | 2.2 MB | Negligible difference |
| 5,000 | 10 MB | 11 MB | Both are tiny |
| 10,000 | 20 MB | 22 MB | Both easily fit in memory |

**Conclusion:** Storage size is **not a concern**. Even 10,000 items is only 20MB. Performance is the limiting factor.

## Migration Triggers

### Trigger 1: Item Count > 500

**Rationale:**
- JSONL performance starts degrading noticeably
- Search takes 400-800ms (approaching our 500ms threshold)
- Proactive migration before frustration

**Action:** Offer migration to user

```
Performance Notice:
You have 512 deferred items. Search performance is degrading.

Migrate to SQLite for instant search? (< 10ms vs current 600ms)
✅ Safe (keeps JSONL backup)
✅ Automatic (no manual work)
✅ Reversible (can export back to JSONL)

Migrate now? [Y/n]
```

### Trigger 2: Search Operation > 500ms

**Rationale:**
- User is actually experiencing slowness (measured)
- 500ms is perceptible, feels sluggish
- Time to upgrade for better UX

**Action:** Offer migration after slow search

```
That search took 750ms (slow). You have 850 items.

Migrate to SQLite for instant search?
After migration, this search would take < 10ms.

Migrate now? [Y/n]
```

### Trigger 3: User-Initiated

**Command:** `/later migrate-to-sqlite`

**Rationale:**
- User wants performance benefits proactively
- User anticipates growth
- User prefers SQLite for advanced features (FTS5, relations)

**Action:** Migrate immediately

```
Migrating to SQLite...
✅ Backup created: deferred.jsonl.backup-20251031-143022
✅ SQLite database created
✅ Migrating 350 items... 100%
✅ Building indexes...
✅ Validation passed (350 items)
✅ Migration complete

Search is now < 10ms. Enjoy!
```

## Migration Process (Detailed)

### Step 1: Automatic Backup

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="~/.later/deferred.jsonl.backup-$TIMESTAMP"
cp ~/.later/deferred.jsonl $BACKUP_FILE

# Validate backup
if [[ $(wc -l < $BACKUP_FILE) -ne $(wc -l < ~/.later/deferred.jsonl) ]]; then
  echo "❌ Backup failed - aborting migration"
  exit 1
fi
```

**Guarantees:**
- Timestamped (can keep multiple)
- Validated (line count matches)
- Permanent (never auto-deleted)

### Step 2: Create SQLite Database

```bash
sqlite3 ~/.later/deferred.db < schema.sql
```

**Schema includes:**
- `deferred_items` table (main data)
- `categories` table (many-to-many)
- `tags` table (many-to-many)
- `dependencies` table (graph structure)
- Indexes on id, date, status, priority
- FTS5 virtual table for full-text search

See [docs/technical/schema/sqlite-schema.md](../../technical/schema/sqlite-schema.md) for complete schema.

### Step 3: Parse and Insert Data

```bash
# Parse JSONL line by line
while IFS= read -r line; do
  # Extract fields
  id=$(echo "$line" | jq -r '.id')
  title=$(echo "$line" | jq -r '.title')
  # ... extract all fields

  # Insert into SQLite (transaction batch of 100)
  sqlite3 ~/.later/deferred.db "INSERT INTO deferred_items ..."

  # Insert categories (separate table)
  echo "$line" | jq -r '.categories[]' | while read category; do
    sqlite3 ~/.later/deferred.db "INSERT INTO categories ..."
  done
done < ~/.later/deferred.jsonl
```

**Optimization:** Batch inserts in transactions (100 items per transaction) for speed.

**Progress:** Show progress bar for large datasets (> 500 items).

### Step 4: Build Indexes

```sql
CREATE INDEX idx_date ON deferred_items(date);
CREATE INDEX idx_status ON deferred_items(status);
CREATE INDEX idx_priority ON deferred_items(priority);
CREATE INDEX idx_categories_category ON categories(category);

-- Full-text search index
CREATE VIRTUAL TABLE deferred_fts USING fts5(
  id, title, context_summary,
  content='deferred_items'
);
```

**Note:** Index building can take 5-10 seconds for 1000+ items. Show progress.

### Step 5: Validate Migration

```bash
# Count check
JSONL_COUNT=$(wc -l < ~/.later/deferred.jsonl)
SQLITE_COUNT=$(sqlite3 ~/.later/deferred.db "SELECT COUNT(*) FROM deferred_items;")

if [[ $JSONL_COUNT -ne $SQLITE_COUNT ]]; then
  echo "❌ Count mismatch: JSONL=$JSONL_COUNT, SQLite=$SQLITE_COUNT"
  echo "Rolling back..."
  rm ~/.later/deferred.db
  exit 1
fi

# Spot check: Compare 10 random items
for i in {1..10}; do
  # Compare JSONL vs SQLite for same ID
  # Ensure all fields match
done
```

**Guarantees:**
- All items migrated (count matches)
- Data integrity (spot checks pass)
- Rollback on any discrepancy

### Step 6: Atomic Switch

```bash
# Rename files atomically
mv ~/.later/deferred.jsonl ~/.later/deferred.jsonl.pre-migration
touch ~/.later/.using-sqlite  # Flag file

# Test one operation
sqlite3 ~/.later/deferred.db "SELECT * FROM deferred_items LIMIT 1;"

if [[ $? -ne 0 ]]; then
  echo "❌ SQLite test failed - rolling back"
  mv ~/.later/deferred.jsonl.pre-migration ~/.later/deferred.jsonl
  rm ~/.later/deferred.db ~/.later/.using-sqlite
  exit 1
fi
```

**Result:** JSONL → SQLite switch is atomic. Either fully migrated or fully rolled back.

### Step 7: Keep JSONL Backup

```bash
# Don't delete JSONL - keep as backup
# User can export anytime: /later export
# Provides portability and longevity guarantee
```

## Rollback Procedure

If migration fails or user wants to revert:

```bash
/later rollback-to-jsonl

# Process:
# 1. Export current SQLite to JSONL: /later export --format jsonl
# 2. Validate export (count check)
# 3. Rename: deferred.db → deferred.db.backup
# 4. Restore: deferred.jsonl.pre-migration → deferred.jsonl
# 5. Remove flag: rm .using-sqlite
# 6. Test: /later list
```

**Guarantee:** Can always revert to JSONL. SQLite is an optimization, not a requirement.

## Post-Migration Optimizations

### Query Optimization

**Before (JSONL):**
```bash
# Linear scan - O(n)
grep "optimization" deferred.jsonl
```

**After (SQLite):**
```sql
-- Indexed query - O(log n)
SELECT * FROM deferred_items
WHERE id IN (
  SELECT item_id FROM categories WHERE category LIKE 'optimization%'
)
ORDER BY date DESC
LIMIT 20;
```

### Full-Text Search

**Before (JSONL):**
```bash
# Grep every file - slow
jq '.[] | select(.title | contains("CLAUDE"))' deferred.jsonl
```

**After (SQLite with FTS5):**
```sql
-- Full-text index - instant
SELECT * FROM deferred_fts WHERE deferred_fts MATCH 'CLAUDE';
```

FTS5 is **specifically designed** for fast full-text search. 10-100x faster than grep on large datasets.

### Prepared Statements

**Reuse query plans:**
```bash
# Prepare once
sqlite3 ~/.later/deferred.db ".prepare get_item" "SELECT * FROM deferred_items WHERE id = ?;"

# Execute many times (fast)
sqlite3 ~/.later/deferred.db ".execute get_item 1"
sqlite3 ~/.later/deferred.db ".execute get_item 2"
```

Saves parsing overhead on repeated queries.

## Archive Strategy

Even with SQLite, keep active dataset small:

```bash
# Move done items > 1 year old to archive
/later archive --status done --older-than 365d

# Result:
# ~/.later/deferred.db (active items only)
# ~/.later/deferred-archive.db (old items)
```

**Benefits:**
- Faster queries (less data to scan)
- Cleaner UI (only relevant items)
- Data preserved (archive never deleted)

## Future Scaling Beyond SQLite

If we ever outgrow SQLite (unlikely for personal use):

**PostgreSQL:**
- Multi-user support
- Network access
- Advanced features (JSON queries, full-text in multiple languages)

**Elasticsearch:**
- Massive full-text search (millions of items)
- Complex queries and aggregations
- Distributed architecture

**Cloud Storage:**
- S3 + DynamoDB
- Serverless
- Global availability

But realistically, **SQLite handles millions of items**. For personal use, we'll never outgrow it.

## Monitoring and Alerting

**Track performance metrics:**
```bash
# Log every search operation
echo "$(date +%s) search query='$QUERY' time_ms=$TIME_MS" >> ~/.later/performance.log
```

**Warn if degrading:**
```bash
# If average search > 500ms over last 10 searches
AVG=$(tail -10 ~/.later/performance.log | awk '{sum+=$NF} END {print sum/NR}')
if [[ $AVG -gt 500 ]]; then
  echo "⚠️  Performance degrading. Consider migration."
fi
```

**Auto-suggest migration** when threshold exceeded consistently.

## Testing the Migration

**Test with synthetic datasets:**
```bash
# Generate test data
for i in {1..1000}; do
  echo "{\"id\":$i,\"title\":\"Item $i\",\"status\":\"deferred\"}"
done > test-1000.jsonl

# Migrate
/later migrate-to-sqlite --source test-1000.jsonl --target test.db

# Benchmark
time /later list --source test-1000.jsonl  # JSONL
time /later list --source test.db           # SQLite

# Compare results
```

**Test with real data:**
- Migrate personal deferred.jsonl to SQLite
- Compare search results (should be identical)
- Benchmark performance (should be faster)
- Roll back (should restore perfectly)

## Related Documents

- [Storage Mechanism](storage-mechanism.md) - Why JSONL → SQLite
- [JSONL Format](../../technical/schema/jsonl-format.md) - Source format
- [SQLite Schema](../../technical/schema/sqlite-schema.md) - Target format
- [Migration Guide](../../technical/schema/migration-guide.md) - Step-by-step process
- [Performance Benchmarks](../../technical/performance/benchmarks.md) - Measured data

---

**Decision Date:** 2025-10-31
**Decided By:** User (power user, performance-conscious)
**Status:** Approved for implementation

**Key Insight:** Don't optimize prematurely, but have a clear scaling path when needed. Measure, don't guess.
