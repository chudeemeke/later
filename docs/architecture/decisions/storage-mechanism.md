# Architecture Decision: Storage Mechanism

**Status:** Decided
**Date:** 2025-10-31
**Decision:** Hybrid approach - Start with JSONL, migrate to SQLite when scale requires

## Problem Statement

The `/later` tool needs persistent storage that:
- **Scales gracefully** - Handle 10 to 10,000+ items without performance degradation
- **Human-readable backups** - Users should be able to `cat` data files and understand them
- **Handles concurrent access** - Multiple Claude sessions might write simultaneously
- **Survives corruption** - Power loss shouldn't destroy entire dataset
- **Works in 10 years** - Format must be stable and accessible long-term

## Options Analyzed

### Option 1: JSONL (JSON Lines)

**Format:** One JSON object per line
```json
{"id":1,"title":"Optimize CLAUDE.md","date":"2025-10-31","status":"deferred"}
{"id":2,"title":"Refactor to plugin","date":"2025-10-31","status":"in_progress"}
```

**Pros:**
- ✅ **Append-only fast** - New items added instantly (< 1ms)
- ✅ **Human-readable** - `cat deferred.jsonl` works, debugging is easy
- ✅ **No dependencies** - Just `jq` for parsing (standard Unix tool)
- ✅ **Unix tools work** - `grep`, `sort`, `head`, `tail` all functional
- ✅ **Corruption isolated** - Bad line doesn't corrupt entire file
- ✅ **Simple backup** - `cp` the file, done
- ✅ **10-year stable** - Plain text format never becomes obsolete

**Cons:**
- ❌ **No indexing** - Search is O(n) linear scan
- ❌ **No relations** - Can't easily query dependencies
- ❌ **Manual ID management** - Must track next ID ourselves
- ❌ **Concurrent write risk** - Race conditions without file locking
- ❌ **Update complexity** - Modifying item requires rewrite or append-update pattern

**Performance:**
- < 100 items: Instant (< 10ms)
- 100-500 items: Fast (< 100ms)
- 500-1000 items: Acceptable (< 500ms)
- 1000+ items: Slow (> 1s for full scan search)

**Scale Limit:** ~1000 items before performance degrades noticeably

### Option 2: SQLite

**Format:** Binary database file with structured tables

**Pros:**
- ✅ **ACID transactions** - Concurrent writes handled automatically
- ✅ **Indexed searches** - O(log n) with proper indexes
- ✅ **Relations** - Foreign keys, joins for dependencies
- ✅ **Full-text search** - Built-in FTS5 for fast text search
- ✅ **Schema enforcement** - Data integrity guaranteed
- ✅ **Battle-tested** - Format stable since 2004, used everywhere
- ✅ **Scales to millions** - Performance stays consistent

**Cons:**
- ❌ **Binary format** - Not human-readable
- ❌ **Requires sqlite3** - Additional dependency (though widely available)
- ❌ **Migration complexity** - Converting from JSONL requires careful process
- ❌ **Overkill for small datasets** - 10 items doesn't need a database
- ❌ **Corruption affects whole DB** - Though rare with WAL mode

**Performance:**
- < 10,000 items: Instant (< 10ms)
- 10,000-100,000 items: Fast (< 50ms)
- 100,000+ items: Still fast with proper indexes (< 100ms)

**Scale Limit:** Essentially unlimited (millions of items)

### Option 3: Git-based (like org-mode)

**Format:** Markdown or structured files in Git repository

**Pros:**
- ✅ **Full history** - See evolution of each decision
- ✅ **Branching** - Experiment with different contexts
- ✅ **Distributed sync** - Share across machines
- ✅ **Built-in backup** - Every commit is a backup

**Cons:**
- ❌ **Heavyweight** - Git overhead for simple storage
- ❌ **Merge conflicts** - Concurrent edits can conflict
- ❌ **Not instant** - Need commit for persistence
- ❌ **Complex UX** - Users need to understand Git
- ❌ **Query performance** - No efficient search without additional tooling

**Verdict:** Interesting but too complex for the primary use case

## Decision: Hybrid Approach

**Start with JSONL, migrate to SQLite when needed.**

### Phase 1: JSONL (MVP → V1)

Use JSONL for initial implementation because:
1. **Validates concept** - Proves the tool is useful before investing in complex storage
2. **Simple to implement** - 200 lines of bash + jq
3. **Easy to debug** - `cat deferred.jsonl` shows everything
4. **Fast enough** - Most users will have < 500 items
5. **No dependencies** - Works everywhere jq exists

### Phase 2: SQLite Migration (V2)

Migrate when:
- Items > 500 (approaching performance degradation)
- Search takes > 500ms (user experiencing slowness)
- User explicitly requests `/later migrate-to-sqlite`

Migration process:
1. Automatic offer: "Performance degrading. Migrate to SQLite for faster search?"
2. Create timestamped backup of JSONL
3. Create SQLite database with schema
4. Parse JSONL line-by-line, insert with transactions
5. Build indexes
6. Validate (count matches, spot-check records)
7. Atomic switch (rename files)
8. Keep JSONL backup permanently

### Always Provide JSONL Export

Even after migrating to SQLite:
- `/later export` generates JSONL
- Human-readable backup always available
- Portability to other tools
- 10-year longevity guarantee

## Rationale

This hybrid approach embodies **progressive enhancement** (Apple-style):

**Layer 1 (Simple):** User doesn't know or care about storage format

**Layer 2 (Orchestration):** System automatically offers migration when beneficial

**Layer 3 (Implementation):** JSONL for simplicity, SQLite for scale, migration is atomic and safe

**Layer 4 (Recovery):** Always keep JSONL export, rollback possible, backups automatic

### Why Not Just SQLite From Start?

- **Avoid over-engineering** - Don't optimize for scale you don't have
- **Validate concept first** - Prove the tool is useful
- **Simpler debugging** - Human-readable format during development
- **Clear migration path** - We know exactly when and how to migrate

### Why Not Just JSONL Forever?

- **Performance matters** - Search degradation frustrates users
- **Clear scale limits** - We know JSONL breaks at ~1000 items
- **Better user experience** - Sub-10ms search feels instant
- **Enable advanced features** - Relations, FTS5, complex queries

## Implementation Notes

### JSONL Backend

**File structure:**
```
~/.later/deferred.jsonl       # Active items
~/.later/deferred-archive.jsonl  # Archived items
~/.later/backups/             # Timestamped backups
```

**Concurrent access:** Use `flock` for file locking
```bash
flock ~/.later/deferred.jsonl.lock -c "jq --arg ... >> deferred.jsonl"
```

**Atomic writes:** Write to temp file, validate, then rename
```bash
jq ... > deferred.tmp.jsonl
jq empty deferred.tmp.jsonl  # Validate
mv deferred.tmp.jsonl deferred.jsonl  # Atomic
```

### SQLite Backend

**File structure:**
```
~/.later/deferred.db          # SQLite database
~/.later/deferred.jsonl.backup  # Last JSONL export
```

**Schema:** See [docs/technical/schema/sqlite-schema.md](../../technical/schema/sqlite-schema.md)

**WAL mode:** Enable for better concurrency
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

## 10-Year Test

**Question:** Will this work in 10 years?

**JSONL:** ✅ Yes - Plain text format, works with `cat` forever

**SQLite:** ✅ Yes - Format stable since 2004, used by billions of devices, will outlive us

**Git:** ✅ Yes - But complex, not needed for this use case

**Custom binary format:** ❌ No - Format drift, tool availability, documentation loss

**Cloud service:** ❌ No - API changes, service shutdowns, vendor lock-in

## Related Decisions

- [Schema Evolution](schema-evolution.md) - Why tags instead of categories
- [Scaling Strategy](scaling-strategy.md) - When and how to migrate
- [JSONL Format](../../technical/schema/jsonl-format.md) - Detailed format spec
- [SQLite Schema](../../technical/schema/sqlite-schema.md) - Database structure

## Future Considerations

If we ever need more scale than SQLite:
- PostgreSQL (multi-user, network access)
- Elasticsearch (full-text search at massive scale)
- Cloud storage (S3 + DynamoDB)

But realistically, SQLite handles millions of items. We'll never outgrow it for personal use.

---

**Decision Date:** 2025-10-31
**Decided By:** User (power user, personal use)
**Status:** Approved for implementation
