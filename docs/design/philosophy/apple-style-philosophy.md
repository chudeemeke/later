# Apple-Style Philosophy Applied to /later

**Last Updated:** 2025-10-31
**Reference:** Based on global PHILOSOPHY.md (~/Documents/PHILOSOPHY.md)

## The 4-Layer Model

The `/later` project is designed from the ground up following Apple's design philosophy as captured in the global PHILOSOPHY.md. Each component demonstrates how the 4-layer model applies to developer tools.

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Magical Recovery                               │
│  "It just works, even when things go wrong"             │
│  - Automatic backups                                     │
│  - /later rollback                                       │
│  - Emergency recovery                                    │
│  - Archive (never delete)                                │
└─────────────────────────────────────────────────────────┘
         ▲
         │ Enables confidence to experiment
         │
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Robust Implementation                          │
│  "Built for edge cases, corruption, scale"              │
│  - File locking (concurrent access)                      │
│  - Atomic writes (corruption prevention)                 │
│  - JSONL → SQLite scaling                                │
│  - Dependency cycle detection                            │
└─────────────────────────────────────────────────────────┘
         ▲
         │ Enables reliability
         │
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Hidden Orchestration                           │
│  "Complex coordination happens invisibly"                │
│  - AI context extraction                                 │
│  - Fuzzy duplicate detection                             │
│  - Auto-categorization                                   │
│  - Performance monitoring                                │
└─────────────────────────────────────────────────────────┘
         ▲
         │ Enables intelligence
         │
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Simple Interface                               │
│  "Make it simple on the surface"                         │
│  - /later "Title" captures everything                    │
│  - /later list shows relevant items                      │
│  - No required configuration                             │
│  - Intuitive commands                                    │
└─────────────────────────────────────────────────────────┘
         ▲
         │ Enables immediate productivity
         │
       User
```

## Layer 1: Simple Interface

**Principle:** "The best interface is no interface."

### Applied to /later

**The Capture Command:**
```bash
/later "Optimize CLAUDE.md size"
```

**What the user sees:**
- One command
- One argument (the title)
- Immediate feedback: `✅ Captured as item #3`

**What's NOT visible:**
- No required `--backend` flag
- No required `--id` specification
- No required `--category` selection
- No required `--context` entry
- No configuration file to create first

**Why this matters:**
From PHILOSOPHY.md: "Users shouldn't have to read documentation to accomplish basic tasks."

A new user can capture their first decision in < 30 seconds without reading any docs. This is **true simplicity**.

### The List Command:**
```bash
/later list
```

**Output:**
```
Deferred Items (8 total)

[3] Optimize CLAUDE.md size    optimization    180d  medium
[5] Refactor to plugin         refactor         90d  high
[7] Add dependency tracking    feature          45d  low
```

**What the user sees:**
- Clean table
- Essential info only (no clutter)
- Hints for next actions at bottom

**What's NOT visible:**
- 47 available filter options
- 8 sort methods
- 5 output formats
- Performance optimization details

**Why this matters:**
Progressive disclosure. Show what's needed now, reveal more as user needs it.

## Layer 2: Hidden Orchestration

**Principle:** "Make complex things happen automatically."

### Context Extraction

**User types:**
```bash
/later "Optimize CLAUDE.md size"
```

**System does (invisibly):**
```
1. Scan last 20 messages in conversation
2. Extract relevant context:
   - Current CLAUDE.md: 3,343 words (~4,500 tokens)
   - Options discussed: Hybrid, Minimal, Keep as-is
   - Recommendation: Hybrid approach
   - Reason for deferral: Not urgent, needs future review

3. Call Claude API for intelligent summary:
   - Prompt: "Summarize this decision in 200-500 words..."
   - Response: Structured context with options, pros/cons

4. Generate item:
   {
     "id": 3,
     "title": "Optimize CLAUDE.md size",
     "context": "User asked about CLAUDE.md token count...",
     "categories": ["optimization", "decision"],
     "priority": "medium",
     "captured_at": "2025-10-31T14:30:00Z",
     "conversation_id": "abc123..."
   }

5. Check for duplicates:
   - Fuzzy match against existing items
   - Levenshtein distance < 20%
   - If match found, offer to update instead of create

6. Store to backend:
   - Acquire file lock
   - Atomic write to JSONL
   - Release lock
   - Create backup (background)

7. Link to conversation:
   - Store conversation_id for future reference
   - Enable "show full context" feature

8. Return success:
   ✅ Captured as item #3
```

**User cognitive load:** Zero. They just see success.

**System cognitive load:** 8-step orchestration with error handling at each step.

**Why this matters:**
From PHILOSOPHY.md: "Orchestration layer handles complexity so user doesn't have to."

The user doesn't need to know about API calls, fuzzy matching algorithms, or file locking. It just works.

### Duplicate Detection

**User captures:**
```bash
/later "Optimize CLAUDE.md"
```

**System detects:**
```
Already exists: [3] Optimize CLAUDE.md size (180d ago)

⚠️  Similar item detected

Options:
  [U]pdate existing with new context
  [C]reate new item anyway
  [V]iew existing first

Recommendation: Update (press U or Enter)
```

**What happened invisibly:**
```
1. Fuzzy match title:
   "Optimize CLAUDE.md" vs "Optimize CLAUDE.md size"
   - Levenshtein distance: 15% (under 20% threshold)
   - Consider similar

2. Keyword overlap check:
   - Common keywords: optimize, CLAUDE, md
   - Overlap: 100% (all keywords match)
   - Strong similarity

3. Determine action:
   - High similarity (fuzzy + keywords)
   - Offer update instead of duplicate

4. Present options:
   - Default: Update (most common)
   - Alternative: Create anyway (user override)
   - Preview: View existing first
```

**User cognitive load:** Minimal decision (Update, Create, or View).

**System cognitive load:** Multi-algorithm similarity detection with weighted scoring.

**Why this matters:**
System prevents cluttered list without blocking user. User retains control ("Create anyway").

### Performance Monitoring

**User runs:**
```bash
/later search "optimization"
```

**System monitors:**
```
1. Timestamp: Start = 14:30:00.000

2. Execute search:
   - Backend: JSONL (500 items)
   - Method: grep + jq filter
   - Results: 3 matches

3. Timestamp: End = 14:30:00.750
   Duration: 750ms

4. Check threshold:
   - Target: < 500ms
   - Actual: 750ms
   - Status: SLOW (50% over target)

5. Increment slow query counter:
   - Recent slow queries: 3 of last 5
   - Pattern: Consistent slowness

6. Trigger migration offer:
   ⚠️  Performance Notice
   Search took 750ms (slow). You have 520 items.

   Migrate to SQLite for instant search?
   After migration, this search would take < 10ms.

   Migrate now? [Y/n]
```

**User sees:** Search results + optional migration offer

**System tracks:** Performance metrics, identifies patterns, proactively offers solutions

**Why this matters:**
From PHILOSOPHY.md: "System monitors, measures, and self-corrects automatically."

User doesn't have to know when to migrate. System measures and suggests at the right time.

## Layer 3: Robust Implementation

**Principle:** "Build for the worst case, optimize for the common case."

### Concurrent Access Handling

**Scenario:** Two Claude sessions capture simultaneously.

**Naive implementation (broken):**
```bash
# Session 1
echo '{"id":1,...}' >> deferred.jsonl  # Write starts

# Session 2 (simultaneous)
echo '{"id":2,...}' >> deferred.jsonl  # Write starts

# Result: Corrupted file
{"id":1,"title":"..."}{"id":2,"title":"..."}  # Merged on same line
```

**Our implementation (robust):**
```bash
# Session 1
flock deferred.jsonl.lock -c "echo '{\"id\":1,...}' >> deferred.jsonl"
  # Acquires lock
  # Writes
  # Releases lock

# Session 2 (simultaneous)
flock deferred.jsonl.lock -c "echo '{\"id\":2,...}' >> deferred.jsonl"
  # Waits for lock
  # Acquires after Session 1 releases
  # Writes
  # Releases lock

# Result: Clean file
{"id":1,"title":"..."}
{"id":2,"title":"..."}
```

**Why this matters:**
Real users have multiple Claude tabs open. Concurrent writes WILL happen. System must handle it correctly.

### Corruption Recovery

**Scenario:** Power loss during write.

**Naive implementation (broken):**
```bash
# Write new item directly
echo '{"id":3,...}' >> deferred.jsonl

# Power loss mid-write
{"id":1,...}
{"id":2,...}
{"id":3,"tit  # Incomplete, file corrupted
```

**Our implementation (robust):**
```bash
# Step 1: Write to temp file
echo '{"id":3,...}' > deferred.tmp.jsonl

# Step 2: Validate
if jq empty deferred.tmp.jsonl 2>/dev/null; then
  # Step 3: Atomic rename (single syscall, atomic at OS level)
  mv deferred.tmp.jsonl deferred.jsonl
else
  # Validation failed, don't corrupt original
  echo "Error: Invalid data, aborting" >&2
  rm deferred.tmp.jsonl
fi
```

**If power loss occurs:**
- During temp file write: Original file unchanged
- After temp file validated: Original file unchanged
- During rename: OS guarantees atomicity (either old or new, never corrupted)

**Why this matters:**
From PHILOSOPHY.md: "Data integrity is non-negotiable."

Users trust the system with important decisions. Corruption is unacceptable.

### JSONL → SQLite Migration

**Naive implementation (broken):**
```bash
# Delete JSONL, create SQLite
rm deferred.jsonl
sqlite3 deferred.db < migrate.sql
```

**Problems:**
- JSONL deleted before SQLite proven working
- If migration fails, ALL DATA LOST
- No way to recover

**Our implementation (robust):**
```bash
# Step 1: Backup (timestamped, validated)
cp deferred.jsonl deferred.jsonl.backup-20251031-143022
validate_backup || exit 1

# Step 2: Create SQLite (doesn't touch JSONL)
sqlite3 deferred.db < schema.sql

# Step 3: Migrate data (transactional)
while IFS= read -r line; do
  sqlite3 deferred.db "BEGIN TRANSACTION; INSERT ...; COMMIT;"
done < deferred.jsonl

# Step 4: Validate migration
jsonl_count=$(wc -l < deferred.jsonl)
sqlite_count=$(sqlite3 deferred.db "SELECT COUNT(*) FROM deferred_items;")

if [[ $jsonl_count -ne $sqlite_count ]]; then
  echo "Migration failed, rolling back"
  rm deferred.db
  exit 1
fi

# Step 5: Atomic switch (rename, don't delete)
mv deferred.jsonl deferred.jsonl.pre-migration
touch .using-sqlite

# Step 6: Test
if ! sqlite3 deferred.db "SELECT * FROM deferred_items LIMIT 1;" &>/dev/null; then
  echo "SQLite test failed, rolling back"
  rm deferred.db .using-sqlite
  mv deferred.jsonl.pre-migration deferred.jsonl
  exit 1
fi

# Success: JSONL backup kept, SQLite working
echo "✅ Migration complete"
```

**If anything fails:** Complete rollback, no data loss.

**Why this matters:**
Migration is high-risk operation. Implement with paranoid level of safety.

## Layer 4: Magical Recovery

**Principle:** "Make mistakes impossible or reversible."

### Automatic Backups

**User doesn't request backup. System does it automatically.**

```bash
# Every write operation triggers backup (background)
after_write() {
  local file="$1"

  # Background backup (doesn't slow down user)
  (
    timestamp=$(date +%Y%m%d-%H%M%S)
    cp "$file" "$HOME/.later/backups/deferred-$timestamp.jsonl"

    # Prune old backups (keep last 10)
    ls -t ~/.later/backups/deferred-*.jsonl | tail -n +11 | xargs rm -f
  ) &
}
```

**User never thinks about backups. They just exist.**

### Rollback Command

**User makes mistake:**
```bash
/later done 3  # Oops, meant to do #5
```

**Immediate recovery:**
```bash
/later rollback

# Reverts last operation
✅ Undone: Mark item #3 as done
Item #3 restored to previous state
```

**Implementation:**
```bash
# Every mutating operation logs action
log_action() {
  local action="$1"
  local before_state="$2"
  local after_state="$3"

  echo "$(date +%s)|$action|$before_state|$after_state" >> ~/.later/action-log.jsonl
}

# Rollback reads log, inverts operation
rollback() {
  last_action=$(tail -1 ~/.later/action-log.jsonl)

  # Parse and invert
  case "$action" in
    done)
      # Invert: done → deferred
      restore_item_state "$item_id" "$before_state"
      ;;
    capture)
      # Invert: delete item
      delete_item "$item_id"
      ;;
    # ... other actions
  esac
}
```

**Why this matters:**
From PHILOSOPHY.md: "Users should feel confident to experiment, knowing mistakes are reversible."

### Archive (Never Delete)

**User archives old item:**
```bash
/later archive 3
```

**What happens:**
```bash
# NOT deleted, moved to archive
mv ~/.later/deferred.jsonl ~/.later/deferred-archive.jsonl

# Item #3 marked as archived, not deleted
jq '.id == 3 | .status = "archived"' ...
```

**Restore anytime:**
```bash
/later list --archived
/later restore 3
```

**Why this matters:**
Users might need that decision context years later. Never destroy data.

## Recursive Application

The 4-layer model applies **at every level**:

### Command Level
- Layer 1: Simple command
- Layer 2: Parse args, validate, orchestrate
- Layer 3: Error handling, exit codes
- Layer 4: Suggest corrections, guide recovery

### Storage Level
- Layer 1: Simple read/write API
- Layer 2: Select backend, handle format
- Layer 3: File locking, atomic writes
- Layer 4: Backups, corruption recovery

### Search Level
- Layer 1: Natural language query
- Layer 2: Rank results by relevance
- Layer 3: Optimize for JSONL vs SQLite
- Layer 4: Suggest refinements, related items

## Comparison to PHILOSOPHY.md Examples

**From PHILOSOPHY.md:**

> "iPhone example: Tap to open app (Layer 1). System manages memory, prioritizes tasks, updates in background (Layer 2). Handles low battery by throttling, handles crashes by auto-restart (Layer 3). iCloud backup means lost phone = restore everything (Layer 4)."

**Applied to /later:**

> "/later example: /later \"title\" captures (Layer 1). System extracts context, detects duplicates, auto-categorizes (Layer 2). Handles concurrent writes, corruption, scales JSONL → SQLite (Layer 3). Automatic backups, rollback, archive = never lose decisions (Layer 4)."

## Success Metrics

**Layer 1 success:**
- Time to first successful capture: < 30 seconds
- Commands memorized by user: 3-4 (capture, list, show, do)
- Documentation reads before productivity: 0

**Layer 2 success:**
- AI context extraction success rate: > 95%
- Duplicate detection accuracy: > 90%
- Auto-categorization accuracy: > 80%
- False positives (annoying user): < 5%

**Layer 3 success:**
- Data corruption incidents: 0
- Concurrent write failures: 0
- SQLite migration success rate: 100%
- Recovery from failures: 100%

**Layer 4 success:**
- Data loss incidents: 0
- User stress about mistakes: Minimal (rollback exists)
- Archive usage: Regular (users feel safe archiving)
- Backup space usage: Acceptable (< 50MB for 1000 items)

## Related Documents

- **Global PHILOSOPHY.md** - Original 4-layer model
- **[Progressive Disclosure](../user-experience/progressive-disclosure.md)** - Layer 1 in detail
- **[System Design](../../architecture/system/system-design.md)** - Layer 2 & 3 implementation
- **[Recovery Mechanisms](../../technical/implementation/recovery-mechanisms.md)** - Layer 4 implementation

---

**Design Status:** Complete
**Key Insight:** /later is a living example of Apple-style design applied to developer tools
