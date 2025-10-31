# System Design: /later Architecture

**Last Updated:** 2025-10-31
**Status:** Design Complete
**Implementation:** Pending

## Overview

The `/later` system implements a **4-layer Apple-style architecture** with progressive enhancement. Each layer builds on the previous, creating a cohesive system that's simple on the surface but robust underneath.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: User Interface (Commands)                     │
│  /later "title" | /later list | /later show N           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Orchestration (Core Logic)                    │
│  Context extraction, Duplicate detection, Search         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Storage Backend (JSONL/SQLite)                │
│  File operations, Transactions, Indexes                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Recovery & Export                             │
│  Backups, Export, Archive, Undo operations              │
└─────────────────────────────────────────────────────────┘
```

## System Components

### 1. Command Interface (src/commands/)

**Purpose:** User-facing commands that implement the Apple-style "simple surface" principle.

**Files:**
```bash
src/commands/
├── later-capture.sh    # Capture new item
├── later-list.sh       # List items with filters
├── later-show.sh       # Show single item details
├── later-search.sh     # Full-text search
├── later-do.sh         # Convert to TodoWrite
├── later-done.sh       # Mark as complete
├── later-edit.sh       # Edit existing item
├── later-archive.sh    # Archive old items
├── later-export.sh     # Export to JSONL/JSON
└── later-migrate.sh    # Migrate to SQLite
```

**Design Pattern:** Each command is:
- **Independent** - Can be called standalone
- **Composable** - Can pipe output to other commands
- **Self-documenting** - `--help` flag explains usage
- **Error-friendly** - Clear messages, non-zero exit codes

**Example Command Structure:**
```bash
#!/usr/bin/env bash
# later-capture.sh - Capture deferred decision with context

set -euo pipefail

# Parse arguments
TITLE="${1:-}"
CATEGORY="${2:-}"
PRIORITY="${3:-medium}"

# Validate inputs
if [[ -z "$TITLE" ]]; then
  echo "Error: Title required" >&2
  echo "Usage: /later \"Decision title\" [category] [priority]" >&2
  exit 1
fi

# Call core logic
source "$(dirname "$0")/../core/capture.sh"
capture_item "$TITLE" "$CATEGORY" "$PRIORITY"
```

### 2. Core Logic (src/core/)

**Purpose:** Hidden orchestration layer implementing business logic.

**Files:**
```bash
src/core/
├── capture.sh          # Capture orchestration
├── context.sh          # Context extraction (AI-powered)
├── duplicate.sh        # Fuzzy duplicate detection
├── search.sh           # Search ranking algorithm
├── dependencies.sh     # Dependency graph validation
├── categorize.sh       # Auto-categorization logic
└── validation.sh       # Input validation & sanitization
```

**Example: Capture Orchestration Flow**

```bash
# capture.sh - Multi-step capture process

capture_item() {
  local title="$1"
  local category="$2"
  local priority="$3"

  # Step 1: Extract context from conversation
  local context=$(extract_context "$title")

  # Step 2: Check for duplicates (fuzzy matching)
  if has_duplicate "$title" "$context"; then
    read -p "Similar item exists. Update existing? [Y/n] " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      update_existing "$title" "$context"
      return 0
    fi
  fi

  # Step 3: Auto-categorize if not provided
  if [[ -z "$category" ]]; then
    category=$(auto_categorize "$title" "$context")
  fi

  # Step 4: Generate unique ID
  local id=$(next_id)

  # Step 5: Create item structure
  local item=$(build_item "$id" "$title" "$context" "$category" "$priority")

  # Step 6: Store (delegates to storage layer)
  store_item "$item"

  # Step 7: Success feedback
  echo "✅ Captured as item #$id"

  # Step 8: Link to conversation (if available)
  if [[ -n "$CONVERSATION_ID" ]]; then
    link_conversation "$id" "$CONVERSATION_ID"
  fi
}
```

### 3. Storage Backend (src/storage/)

**Purpose:** Abstract storage operations, support multiple backends (JSONL, SQLite).

**Files:**
```bash
src/storage/
├── jsonl/
│   ├── jsonl-store.sh      # JSONL storage operations
│   ├── jsonl-search.sh     # JSONL search (grep-based)
│   └── jsonl-migrate.sh    # JSONL → SQLite migration
├── sqlite/
│   ├── sqlite-store.sh     # SQLite storage operations
│   ├── sqlite-search.sh    # SQLite search (FTS5)
│   └── schema.sql          # Database schema
└── backend-selector.sh     # Auto-select JSONL or SQLite
```

**Backend Selection Logic:**

```bash
# backend-selector.sh

select_backend() {
  local data_dir="$HOME/.later"

  # Check for flag file
  if [[ -f "$data_dir/.using-sqlite" ]]; then
    echo "sqlite"
    return 0
  fi

  # Check if JSONL exists
  if [[ -f "$data_dir/deferred.jsonl" ]]; then
    echo "jsonl"
    return 0
  fi

  # Default to JSONL for new installs
  echo "jsonl"
}

# Get backend-specific function
store_item() {
  local backend=$(select_backend)

  case $backend in
    jsonl)
      jsonl_store_item "$@"
      ;;
    sqlite)
      sqlite_store_item "$@"
      ;;
  esac
}
```

**Storage Interface (Abstract API):**

All backends implement these functions:
- `store_item(item)` - Create new item
- `get_item(id)` - Retrieve by ID
- `list_items(filters)` - List with filters
- `search_items(query)` - Full-text search
- `update_item(id, changes)` - Update existing
- `delete_item(id)` - Soft delete (mark archived)
- `count_items()` - Count active items
- `export_items()` - Export all to JSONL

### 4. Utilities (src/utils/)

**Purpose:** Shared helper functions used across components.

**Files:**
```bash
src/utils/
├── date.sh            # Date formatting, relative dates
├── json.sh            # JSON parsing (jq wrappers)
├── fuzzy.sh           # Levenshtein distance, fuzzy matching
├── file-lock.sh       # File locking (flock wrapper)
├── atomic-write.sh    # Atomic file operations
└── sanitize.sh        # Secret sanitization, input cleaning
```

**Example: Atomic Write Pattern**

```bash
# atomic-write.sh - Safe file updates

atomic_write() {
  local target_file="$1"
  local content="$2"

  # Create temp file in same directory (same filesystem)
  local temp_file="${target_file}.tmp.$$"

  # Write to temp
  echo "$content" > "$temp_file"

  # Validate (ensure it's valid JSON/JSONL)
  if ! validate_content "$temp_file"; then
    rm "$temp_file"
    return 1
  fi

  # Atomic rename (single syscall)
  mv "$temp_file" "$target_file"
}

# Usage in storage layer
jsonl_store_item() {
  local item="$1"
  local file="$HOME/.later/deferred.jsonl"

  # File locking for concurrent access
  flock "$file.lock" -c "echo '$item' >> $file"
}
```

## Data Flow Diagrams

### Capture Flow (Layer 1 → Layer 4)

```
User: /later "Optimize CLAUDE.md size"
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: later-capture.sh                               │
│ - Parse arguments                                        │
│ - Validate input                                         │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Core Orchestration                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. extract_context()                                │ │
│ │    → Call Claude API with conversation history     │ │
│ │    → Get 200-500 word summary                       │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 2. has_duplicate()                                  │ │
│ │    → Fuzzy match title + context                    │ │
│ │    → Levenshtein distance < 20%                     │ │
│ │    → Offer to update existing                       │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 3. auto_categorize()                                │ │
│ │    → Keyword extraction                             │ │
│ │    → Match to existing categories                   │ │
│ │    → Suggest based on similarity                    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 4. build_item()                                     │ │
│ │    → Generate unique ID                             │ │
│ │    → Create JSON structure                          │ │
│ │    → Add metadata (date, priority)                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Storage Backend                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 5. store_item()                                     │ │
│ │    → Select backend (JSONL or SQLite)               │ │
│ │    → Acquire file lock                              │ │
│ │    → Append to file (JSONL) OR INSERT (SQLite)      │ │
│ │    → Release lock                                   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Backup & Recovery                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 6. auto_backup()                                    │ │
│ │    → Create timestamped backup (background)         │ │
│ │    → Keep last 10 backups                           │ │
│ │    → Prune old backups                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  │
  ▼
User: ✅ Captured as item #3
```

### Search Flow (Optimized Path)

```
User: /later search "optimization"
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: later-search.sh                                │
│ - Parse query                                            │
│ - Parse filters (--category, --priority, --status)       │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: search.sh                                       │
│ - Normalize query (lowercase, trim)                      │
│ - Build search context (which fields to search)          │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Storage Backend Search                         │
│                                                           │
│ IF JSONL:                     IF SQLite:                 │
│ ┌─────────────────────┐      ┌─────────────────────┐   │
│ │ grep-based search   │      │ FTS5 indexed search │   │
│ │ - jq filter         │      │ - SELECT * FROM ... │   │
│ │ - O(n) linear scan  │      │ - O(log n) lookup   │   │
│ │ - 100-800ms @ 500   │      │ - < 10ms @ 10K      │   │
│ └─────────────────────┘      └─────────────────────┘   │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: search.sh (Ranking)                            │
│ - Score by relevance (title > context > tags)           │
│ - Boost recent items                                     │
│ - Sort by score DESC                                     │
└─────────────────────────────────────────────────────────┘
  │
  ▼
User: [3 results shown, ranked by relevance]
```

### Convert to Todo Flow (Integration)

```
User: /later do 3
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: later-do.sh                                     │
│ - Validate ID exists                                     │
│ - Retrieve full item                                     │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Core - convert_to_todo()                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Load item with full context                      │ │
│ │ 2. Break down into actionable steps                 │ │
│ │    - Use AI to suggest breakdown                    │ │
│ │    - User confirms or edits                         │ │
│ │ 3. Create TodoWrite items                           │ │
│ │    - Each step becomes a todo                       │ │
│ │    - Link back to deferred item                     │ │
│ │ 4. Update deferred item status → "in_progress"      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Integration: TodoWrite Tool                              │
│ - Creates todos with activeForm/content                  │
│ - Includes context from deferred item                    │
│ - Links: "From /later #3"                                │
└─────────────────────────────────────────────────────────┘
  │
  ▼
User: ✅ Created 4 todos from deferred item #3
      Item #3 marked as "in_progress"
```

## Progressive Enhancement Architecture

The system is designed to **start simple and scale up** only when needed.

### Phase 1: JSONL Backend (MVP)

**What's included:**
- Basic capture, list, show, done commands
- Simple grep-based search
- File locking for concurrency
- No AI features (manual categorization)

**What's NOT included:**
- SQLite (too complex for < 100 items)
- AI-powered context extraction (use last 10 messages)
- Duplicate detection (manual check by user)
- Dependencies (not needed yet)

**Why this works:**
- Fast to implement (200 lines bash)
- Validates the concept
- Handles < 500 items efficiently
- Easy to debug (cat the file)

### Phase 2: Enhanced Features (V1)

**Add when users need it:**
- Categories & tags (user-defined)
- Priority levels
- Smart search with ranking
- Duplicate detection (fuzzy matching)
- Convert to TodoWrite

**What changes:**
- Core logic layer expands
- Storage layer unchanged (still JSONL)
- New utility functions

**Why this works:**
- Features are opt-in (backward compatible)
- JSONL still handles load
- No migration needed

### Phase 3: SQLite Migration (V2)

**Trigger when:**
- Items > 500 (measured degradation)
- Search > 500ms (user experiencing slowness)
- User requests: `/later migrate-to-sqlite`

**What changes:**
- Storage layer switches to SQLite
- Search becomes FTS5-based
- Indexes added for performance
- JSONL kept as backup/export

**Why this works:**
- Automatic migration offer (user-friendly)
- Non-destructive (keeps JSONL)
- Massive performance gain (10-100x)

### Phase 4: Intelligence Features (V3)

**Add when system is mature:**
- AI-powered categorization
- Context auto-refresh (update stale context)
- Smart reminders ("Item #3 deferred 6 months ago")
- Dependency auto-detection

**What changes:**
- Core logic becomes more sophisticated
- Claude API integration deepens
- Storage unchanged (SQLite handles it)

**Why this works:**
- Foundation is solid (storage, search)
- Intelligence is additive
- Performance already solved

## Error Handling Strategy

**Principle:** Fail gracefully, preserve data, guide user to recovery.

**Layers of Protection:**

1. **Input Validation (Layer 1)**
   - Check required args
   - Sanitize dangerous input
   - Reject malformed data EARLY

2. **Atomic Operations (Layer 3)**
   - Write to temp file first
   - Validate before committing
   - Rename atomically (single syscall)

3. **Automatic Backups (Layer 4)**
   - Backup before risky operations
   - Timestamped (keep history)
   - Quick rollback: `/later rollback`

4. **Corruption Recovery**
   - JSONL: Bad line doesn't corrupt file
   - SQLite: WAL mode prevents corruption
   - Export/import as last resort

**Example Error Handling:**

```bash
# Capture with full error handling

capture_item() {
  local title="$1"

  # Validation layer
  if ! validate_title "$title"; then
    echo "Error: Invalid title (max 200 chars, no special chars)" >&2
    return 1
  fi

  # Context extraction (can fail if AI unavailable)
  local context=""
  if ! context=$(extract_context "$title" 2>/dev/null); then
    echo "⚠️  Warning: AI context extraction failed, using manual mode" >&2
    context="[Context extraction unavailable]"
  fi

  # Storage layer (can fail if disk full)
  if ! store_item "$item"; then
    echo "Error: Failed to store item (check disk space)" >&2
    # Try to store in emergency backup location
    echo "$item" >> "$HOME/.later/emergency-backup.jsonl"
    echo "✅ Saved to emergency backup" >&2
    return 1
  fi

  # Success
  echo "✅ Captured as item #$id"
  return 0
}
```

## Performance Characteristics

**Design Targets:**

| Operation | JSONL (< 500 items) | SQLite (10K+ items) |
|-----------|---------------------|---------------------|
| Capture | < 100ms | < 100ms |
| List | < 50ms | < 10ms |
| Search | < 500ms | < 50ms |
| Show | < 10ms | < 5ms |
| Convert to todo | < 200ms | < 200ms |

**Scaling Behavior:**

```
Performance vs Dataset Size

Search Time (ms)
│
1000│                    JSONL
    │                   /
 500│─────────────────/  ← Migration threshold
    │               /
 100│            /
    │          /            SQLite
  10│═══════════════════════════════
    │
    └────┬─────┬─────┬─────┬─────┬──→ Items
        100   500  1000  5000 10000

Legend:
  /     JSONL (linear growth, O(n))
  ═     SQLite (log growth, O(log n))
```

**Why This Design Works:**

1. **Start where users are** - Most have < 100 items (JSONL perfect)
2. **Measure, don't guess** - Offer migration when actually slow
3. **Non-disruptive** - Migration is automatic, safe, reversible
4. **Performance ceiling** - SQLite handles millions (won't outgrow)

## Security Considerations

**Design Principle:** Defense in depth - multiple layers of protection.

**Layer 1 (Input):**
- Sanitize titles (remove dangerous chars)
- Reject overly long input (DoS protection)
- Escape shell metacharacters

**Layer 2 (Context):**
- Auto-detect secrets (API keys, tokens)
- Sanitize before storing
- Warn user if potential secret detected
- `--no-context` flag for sensitive decisions

**Layer 3 (Storage):**
- File permissions: 600 (user-only)
- Optional GPG encryption at rest
- Secure temp file handling (predictable names)

**Layer 4 (Export):**
- Warn before exporting to insecure locations
- Strip secrets on export (optional)
- Audit log of exports

See [docs/reference/security-considerations.md](../../reference/security-considerations.md) for complete details.

## Related Documents

- **[Storage Mechanism](../decisions/storage-mechanism.md)** - Why JSONL → SQLite hybrid
- **[Schema Evolution](../decisions/schema-evolution.md)** - Flexible tags design
- **[Scaling Strategy](../decisions/scaling-strategy.md)** - Performance thresholds
- **[Integration Points](integration-points.md)** - TodoWrite, Git, PHILOSOPHY.md
- **[Apple-Style Philosophy](../../design/philosophy/apple-style-philosophy.md)** - 4-layer model application

---

**Design Status:** Complete, ready for implementation
**Implementation Phase:** MVP (JSONL-based, 200 lines bash)
**Time Estimate:** 4-6 hours for MVP, 2-3 days for V1
