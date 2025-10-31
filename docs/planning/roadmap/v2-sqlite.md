# V2 SQLite Migration (v2.0-2.5)

**Goal:** Scale to 10,000+ items with instant search

**Timeline:** Triggered when items > 500 OR search > 500ms

**Success Criteria:** Search < 10ms regardless of dataset size

**Note:** This is a *storage migration* (JSONL → SQLite). For *implementation migration* (slash command → MCP server), see [Migration Strategy](../../architecture/decisions/migration-strategy.md).

## Problem

**V1 performance degradation:**
- 500 items: Search ~420ms (noticeable)
- 1000 items: Search ~1100ms (frustrating)
- 2000 items: Search ~2400ms (unacceptable)

**User impact:** System becomes unusable at scale

## Solution

**Hybrid storage:**
- Start: JSONL (< 500 items)
- Migrate: SQLite (> 500 items OR slow performance)
- Always: JSONL export available

## Migration Trigger

**Automatic offer:**
```
⚠️  Performance Notice
You have 520 deferred items. Search performance is degrading.

Migrate to SQLite for instant search? (< 10ms vs current 600ms)
✅ Safe (keeps JSONL backup)
✅ Automatic (no manual work)
✅ Reversible (can export back to JSONL)

Migrate now? [Y/n]
```

**Manual trigger:**
```bash
/later migrate-to-sqlite
```

## Migration Process

**9 steps (automated):**

1. **Backup** - Timestamped JSONL backup
2. **Create** - SQLite database with schema
3. **Parse** - Read JSONL line-by-line
4. **Insert** - Transactional batch inserts
5. **Index** - Build indexes (id, status, FTS5)
6. **Validate** - Count check, spot checks
7. **Switch** - Atomic backend change
8. **Test** - Verify operations work
9. **Cleanup** - Keep JSONL backup, prune old

**Time:** ~25s for 1000 items

## SQLite Features

### Full-Text Search (FTS5)

**Before (JSONL):**
```bash
grep -i "optimization" deferred.jsonl  # 800ms
```

**After (SQLite):**
```sql
SELECT * FROM deferred_fts WHERE deferred_fts MATCH 'optimization';  -- 9ms
```

**88x faster!**

### Indexed Queries

```sql
-- Status filter (indexed)
SELECT * FROM deferred_items WHERE status = 'deferred';  -- < 5ms

-- Priority + status (composite index)
SELECT * FROM deferred_items
WHERE priority = 'high' AND status = 'deferred';  -- < 5ms

-- Date range (indexed)
SELECT * FROM deferred_items
WHERE captured_at BETWEEN '2025-01-01' AND '2025-12-31';  -- < 10ms
```

### Relations

**Many-to-many (categories, tags):**
```sql
-- Items in optimization category
SELECT d.* FROM deferred_items d
JOIN categories c ON d.id = c.item_id
WHERE c.category LIKE 'optimization%';
```

**Dependencies (graph):**
```sql
-- What depends on item 3?
SELECT item_id FROM dependencies WHERE depends_on_id = 3;

-- Recursive dependency chain
WITH RECURSIVE chain AS (
  SELECT item_id, depends_on_id FROM dependencies WHERE item_id = 5
  UNION ALL
  SELECT d.item_id, d.depends_on_id
  FROM dependencies d JOIN chain c ON d.item_id = c.depends_on_id
)
SELECT * FROM chain;
```

## Performance Comparison

| Operation | JSONL (500 items) | SQLite (10K items) | Improvement |
|-----------|-------------------|-------------------|-------------|
| List | 120ms | 9ms | 13x |
| Search | 420ms | 9ms | 47x |
| Show | 15ms | 5ms | 3x |
| Capture | 8ms | 8ms | Same |

## User Experience

**Transparent migration:**
- User sees performance notice
- Accepts migration
- Progress bar shown
- Complete in < 30s
- Commands unchanged

**Commands still work:**
```bash
/later list           # Works exactly the same
/later search "..."   # Just 47x faster
/later show 3         # Same output, faster
```

**No user retraining needed.**

## Rollback

**If needed:**
```bash
/later rollback-to-jsonl

# Steps:
# 1. Export SQLite → JSONL
# 2. Validate export
# 3. Switch backend back
# 4. Test operations

✅ Rolled back to JSONL
```

## JSONL Export (Always Available)

**Even after migration:**
```bash
/later export

# Creates ~/.later/exports/deferred-20251031.jsonl
# Full JSONL export, importable anywhere
```

**10-year longevity preserved.**

## New Features Enabled

### 1. Complex Queries

```bash
/later list --category optimization:performance --priority high --status deferred
# Fast with indexes
```

### 2. Statistics

```bash
/later stats

Items by status:
  deferred: 450
  in_progress: 25
  done: 5200
  archived: 325

Items by category:
  optimization: 185
  feature: 120
  refactor: 95
  ...

Average age by priority:
  high: 15 days
  medium: 45 days
  low: 120 days
```

### 3. Advanced Search

```bash
/later search "database performance" --ranked
# FTS5 ranking with BM25 algorithm
```

## Schema

See [sqlite-schema.md](../../technical/schema/sqlite-schema.md) for complete schema.

**Tables:**
- `deferred_items` - Main table
- `categories` - Many-to-many
- `tags` - Many-to-many
- `dependencies` - Graph structure
- `linked_todos` - TodoWrite integration
- `deferred_fts` - FTS5 virtual table

## Migration Safety

**Non-destructive:**
- JSONL backup kept
- Original file renamed (not deleted)
- Validation before switch
- Rollback available

**Tested scenarios:**
- Power loss during migration → Rollback
- Disk full → Abort, no changes
- Corrupted data → Skip invalid, report
- Count mismatch → Abort, investigate

## Timeline

**Migration flow:**
| Step | Time | Description |
|------|------|-------------|
| 1. Detect | 0s | Performance monitoring |
| 2. Offer | - | User decision |
| 3. Backup | 2s | Copy JSONL |
| 4. Create | 1s | SQLite init |
| 5. Migrate | 20s | Parse + insert (1000 items) |
| 6. Index | 2s | Build indexes |
| 7. Validate | 1s | Verify data |
| 8. Switch | 0s | Atomic flag change |
| **Total** | **~26s** | For 1000 items |

## Success Metrics

- Migration success rate: 100%
- Zero data loss incidents
- Search time < 10ms (all dataset sizes)
- User satisfaction: "Search is instant now!"

## Risks

**SQLite complexity:**
- More complex than JSONL
- Mitigated by: Thorough testing, rollback option

**Migration failure:**
- Power loss, disk full
- Mitigated by: Atomic operations, backups

## Next Phase

After V2 stabilizes → **V3 Intelligence** (AI features, smart suggestions)

## Related

- [V1 Enhanced](v1-enhanced.md) - Previous phase
- [V3 Intelligence](v3-intelligence.md) - Next phase
- [Migration Guide](../../technical/schema/migration-guide.md) - Technical details
- [Benchmarks](../../technical/performance/benchmarks.md) - Performance data
