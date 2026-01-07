# SPECS: Later V2 & V3

**Document Type:** Requirements Specification
**Version:** 1.0
**Date:** 2026-01-07
**Status:** Approved

---

## Overview

Transform `/later` from a personal deferred decision tool into a scalable decision intelligence platform with dependency tracking, intelligent reminders, AI-powered categorization, and decision retrospectives.

---

## Functional Requirements

### Must Have (P0)

#### V2.1: SQLite Migration & Normalized Schema
- [ ] Migrate from JSONL to SQLite as primary storage
- [ ] Normalized schema with separate tables: `items`, `tags`, `dependencies`, `retrospectives`
- [ ] Auto-detect storage backend (SQLite if exists, else initialize new SQLite DB)
- [ ] One-time migration command for existing JSONL data
- [ ] JSONL export/import for backup and portability
- [ ] Full-text search using SQLite FTS5

#### V2.2: Dependency Tracking
- [ ] Add dependencies field to items (blocks relationship)
- [ ] Soft blocking: warn when doing item with unresolved deps, allow `--force` override
- [ ] Cycle detection: prevent circular dependencies
- [ ] Extensible design for future relationship types (relates-to, duplicates, parent-child)
- [ ] CLI: `later show --deps` to visualize dependency tree
- [ ] CLI: `later list --blocked` to show items with unresolved deps

#### V3.1: Smart Reminders
- [ ] Time-based triggers: item deferred > N days (configurable)
- [ ] Context triggers: dependency resolved, related file modified
- [ ] Activity triggers: working in related code area, similar item captured
- [ ] Notification channels: CLI output, system notifications, MCP proactive mention
- [ ] Configurable sensitivity/frequency

#### V3.2: AI Categorization
- [ ] Auto-suggest tags based on decision content
- [ ] Auto-suggest priority based on content analysis
- [ ] Two modes:
  - Claude Code session: AI features work during active session
  - API mode: Optional `ANTHROPIC_API_KEY` for standalone AI features
- [ ] Rule-based fallback when AI unavailable

#### V3.3: Decision Retrospectives
- [ ] Prompt for outcome data when marking item "done"
- [ ] Track: outcome (success/failure/partial), quantified impact, effort vs estimate
- [ ] Git-linked: auto-detect commits with `later:#123` or `resolves-later:123` tags
- [ ] Lessons learned field
- [ ] Retrospective analytics: success rate, common patterns

#### V3.4: Context Auto-Refresh
- [ ] Staleness detection:
  - Time-based: flag items > N days old
  - Dependency-triggered: deps status changed
  - File change detection: git diff on files mentioned in context
  - Hash-based verification on access
- [ ] On-demand check (no background process)
- [ ] Prompt to refresh when viewing stale item

### Should Have (P1)

- [ ] Bulk dependency operations: `later deps add 5 --to 1,2,3`
- [ ] Dependency visualization in CLI (ASCII tree)
- [ ] Reminder snooze: `later snooze 5 --days 7`
- [ ] Export retrospective data for analysis
- [ ] Pattern detection across retrospectives

### Nice to Have (P2)

- [ ] Web dashboard for retrospective analytics
- [ ] Cross-project global decision library
- [ ] Team collaboration features
- [ ] Calendar integration for time-based reminders

---

## Technical Specifications

### Architecture

**Pattern:** Strict Hexagonal (Ports & Adapters)

```
src/
├── domain/                 # Core business logic (no external deps)
│   ├── entities/          # Item, Dependency, Retrospective
│   ├── value-objects/     # Status, Priority, Outcome
│   ├── services/          # DependencyResolver, StalenessChecker
│   └── ports/             # Interfaces for adapters
│       ├── IStoragePort.ts
│       ├── INotificationPort.ts
│       ├── IAIPort.ts
│       └── IGitPort.ts
├── application/           # Use cases
│   ├── commands/          # CaptureItem, ResolveItem, AddDependency
│   └── queries/           # ListItems, GetBlockedItems, GetStaleItems
├── infrastructure/        # Adapters
│   ├── storage/
│   │   ├── SQLiteAdapter.ts
│   │   └── JSONLAdapter.ts (export/import only)
│   ├── notifications/
│   │   ├── CLINotificationAdapter.ts
│   │   ├── SystemNotificationAdapter.ts
│   │   └── MCPNotificationAdapter.ts
│   ├── ai/
│   │   ├── ClaudeAPIAdapter.ts
│   │   ├── ClaudeCodeAdapter.ts
│   │   └── RuleBasedAdapter.ts
│   └── git/
│       └── GitAdapter.ts
└── presentation/          # CLI & MCP handlers
    ├── cli/
    └── mcp/
```

### Data Model

#### SQLite Schema (Normalized)

```sql
-- Core items table
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in-progress', 'done', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- V2 fields
  context_hash TEXT,          -- For staleness detection
  context_files TEXT,         -- JSON array of referenced files
  -- PII tokenization (from V1)
  context_tokens TEXT,        -- JSON object
  context_pii_types TEXT      -- JSON object
);

-- Tags (many-to-many)
CREATE TABLE tags (
  item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  source TEXT DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  PRIMARY KEY (item_id, tag),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Dependencies (DAG)
CREATE TABLE dependencies (
  item_id INTEGER NOT NULL,
  depends_on_id INTEGER NOT NULL,
  dep_type TEXT NOT NULL DEFAULT 'blocks'
    CHECK (dep_type IN ('blocks', 'relates-to', 'duplicates', 'parent-of')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (item_id, depends_on_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES items(id) ON DELETE CASCADE,
  CHECK (item_id != depends_on_id)
);

-- Retrospectives (1-to-1 with items)
CREATE TABLE retrospectives (
  item_id INTEGER PRIMARY KEY,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
  impact_time_saved INTEGER,      -- minutes
  impact_cost_saved REAL,         -- currency amount
  effort_estimated INTEGER,       -- minutes
  effort_actual INTEGER,          -- minutes
  lessons_learned TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Git links (auto-detected commits)
CREATE TABLE git_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  commit_hash TEXT NOT NULL,
  commit_message TEXT,
  commit_date TEXT,
  repo_path TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  UNIQUE (item_id, commit_hash)
);

-- Reminders (scheduled notifications)
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('time', 'dependency', 'file_change', 'activity')),
  trigger_config TEXT,            -- JSON config for trigger
  triggered_at TEXT,              -- NULL if not yet triggered
  dismissed_at TEXT,              -- NULL if not dismissed
  snoozed_until TEXT,             -- NULL if not snoozed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Full-text search
CREATE VIRTUAL TABLE items_fts USING fts5(
  decision,
  context,
  content='items',
  content_rowid='id'
);

-- Indexes
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_priority ON items(priority);
CREATE INDEX idx_items_created ON items(created_at);
CREATE INDEX idx_deps_depends_on ON dependencies(depends_on_id);
CREATE INDEX idx_tags_tag ON tags(tag);
CREATE INDEX idx_git_links_commit ON git_links(commit_hash);
CREATE INDEX idx_reminders_item ON reminders(item_id);
```

### API Changes

#### Extended MCP Tools

**later_capture** (extended)
```typescript
interface CaptureArgs {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  // V2 additions
  depends_on?: number[];           // Item IDs this depends on
  auto_categorize?: boolean;       // Use AI to suggest tags (default: true if available)
}
```

**later_list** (extended)
```typescript
interface ListArgs {
  status?: string;
  priority?: string;
  tags?: string[];
  // V2 additions
  blocked?: boolean;               // Show only items with unresolved deps
  stale?: boolean;                 // Show only stale items
  stale_days?: number;             // Threshold for staleness (default: 30)
  include_deps?: boolean;          // Include dependency info in response
}
```

**later_show** (extended)
```typescript
interface ShowArgs {
  id: number;
  // V2 additions
  include_deps?: boolean;          // Show dependency tree
  include_retro?: boolean;         // Show retrospective if exists
  include_git?: boolean;           // Show linked commits
  check_staleness?: boolean;       // Check and report staleness
}
```

**later_do** (extended)
```typescript
interface DoArgs {
  id: number;
  // V2 additions
  force?: boolean;                 // Override soft block from deps
  // V3 additions
  outcome?: 'success' | 'failure' | 'partial';
  impact_time_saved?: number;
  impact_cost_saved?: number;
  effort_actual?: number;
  lessons_learned?: string;
  skip_retro?: boolean;            // Don't prompt for retrospective
}
```

**later_update** (extended)
```typescript
interface UpdateArgs {
  id: number;
  // Existing fields...
  // V2 additions
  add_deps?: number[];
  remove_deps?: number[];
  refresh_context?: string;        // Refresh with new context
}
```

#### New MCP Tools (V3 only if needed)

**later_remind** (if extending existing tools is insufficient)
```typescript
interface RemindArgs {
  id: number;
  action: 'check' | 'snooze' | 'dismiss';
  snooze_days?: number;
}
```

### CLI Changes

#### Extended Commands

```bash
# Capture with dependencies
later capture "Optimize queries" --depends-on 3,5

# List blocked items
later list --blocked
later list --stale --stale-days 14

# Show with full context
later show 5 --deps --retro --git

# Do with retrospective inline
later do 5 --outcome success --time-saved 120 --lessons "Index was the right call"

# Do with force (override soft block)
later do 5 --force

# Update dependencies
later update 5 --add-deps 7,8 --remove-deps 3

# Check reminders
later remind check
later remind snooze 5 --days 7
```

### Configuration

**~/.later/config.json**
```json
{
  "storage": {
    "backend": "sqlite",
    "path": "~/.later/later.db"
  },
  "reminders": {
    "stale_threshold_days": 30,
    "triggers": {
      "time": true,
      "dependency": true,
      "file_change": true,
      "activity": true
    },
    "notifications": {
      "cli": true,
      "system": true,
      "mcp": true
    }
  },
  "ai": {
    "enabled": true,
    "provider": "claude-code",
    "auto_categorize": true,
    "api_key_env": "ANTHROPIC_API_KEY"
  },
  "git": {
    "detect_commits": true,
    "tag_patterns": ["later:#(\\d+)", "resolves-later:(\\d+)"]
  }
}
```

---

## UI/UX Specifications

### CLI Output Examples

#### Dependency Tree
```
later show 5 --deps

#5: Optimize database queries [pending] [high]
Created: 30 days ago | Updated: 5 days ago

Context:
  Need to add composite index on (user_id, created_at)...

Dependencies:
  ├── #3: Review query patterns [done] ✓
  └── #7: Set up staging DB [in-progress] ⏳

Blocked by: #7 (in-progress)

Tags: optimization, database
```

#### Stale Item Warning
```
later show 12

⚠️  STALE ITEM (45 days since update)

#12: Migrate to React 19 [pending] [medium]
...

Context may be outdated:
  • src/App.tsx changed 12 times since capture
  • Dependency #8 completed 30 days ago
  • React 19.2.0 released (was 19.0.0 at capture)

Refresh context? [y/N]
```

#### Retrospective Prompt
```
later do 5

Marking #5 as done...

📊 Quick Retrospective (optional, Ctrl+C to skip)

Outcome: [success/failure/partial] success
Time saved (minutes): 120
Actual effort (minutes): 90
Lessons learned: Index optimization was straightforward, should do earlier next time

✅ Item #5 completed with retrospective recorded
```

#### Reminder Notification
```
🔔 Later Reminders

#5: Optimize database queries
    ⏰ Deferred 45 days ago (threshold: 30)
    📁 Related file changed: src/db/queries.ts

#12: Migrate to React 19
    ✅ Dependency resolved: #8 completed
    📦 Package update: react 19.2.0 available

Actions: later show <id> | later snooze <id> --days 7 | later dismiss <id>
```

---

## Trade-offs & Decisions

| Decision | Choice Made | Rationale |
|----------|-------------|-----------|
| Schema design | Normalized tables | Scalability, complex relationship queries |
| Storage backend | SQLite primary | Better for scale, FTS5 search |
| JSONL role | Export/import only | Backup/portability, not primary storage |
| Dependency blocking | Soft block | Flexibility, user override with --force |
| AI provider | Claude Code + optional API | No extra cost, graceful degradation |
| File monitoring | On-demand git diff + hash | No background process, explicit check |
| Notification channels | All (CLI + system + MCP) | Maximum flexibility |
| Architecture | Strict hexagonal | Testability, adapter swappability |

---

## Success Criteria

- [ ] Daily active use without friction
- [ ] Decision quality improvement measurable via retrospectives
- [ ] Zero maintenance burden (auto-migration, auto-reminders)
- [ ] Portfolio-worthy: demonstrates SQLite, hexagonal arch, AI integration
- [ ] 95%+ test coverage maintained at each metric
- [ ] All existing tests continue passing

---

## Out of Scope

- Web dashboard (P2 future)
- Cross-project global library (P2 future)
- Team collaboration (P2 future)
- Real-time filesystem watching (too heavy)
- Mandatory AI features (always graceful degradation)

---

## Open Questions

- [x] Schema: normalized vs single table → **Normalized**
- [x] AI access: API vs Claude Code → **Both, Claude Code primary**
- [x] File monitoring: active vs on-demand → **On-demand**
- [x] JSONL fate: keep vs drop → **Export/import only**

---

## Implementation Phases

### Phase 1: V2.1 - SQLite Foundation (1 week)
1. Hexagonal architecture refactor (ports/adapters)
2. SQLite adapter with normalized schema
3. Migration command from JSONL
4. FTS5 search integration
5. JSONL export/import utilities

### Phase 2: V2.2 - Dependencies (3-4 days)
1. Dependencies table and domain logic
2. Cycle detection algorithm
3. Soft blocking in `later_do`
4. CLI flags: `--deps`, `--blocked`
5. Dependency visualization

### Phase 3: V3.1 - Retrospectives (3-4 days)
1. Retrospectives table and domain logic
2. Prompt flow on completion
3. Git link detection
4. Retrospective analytics queries

### Phase 4: V3.2 - Smart Reminders (4-5 days)
1. Reminders table and trigger system
2. Staleness detection (time, deps, files)
3. Notification adapters (CLI, system, MCP)
4. Snooze/dismiss functionality

### Phase 5: V3.3 - AI Categorization (3-4 days)
1. AI port with multiple adapters
2. Claude Code session detection
3. Rule-based fallback
4. Auto-categorize on capture

### Phase 6: V3.4 - Context Refresh (2-3 days)
1. File hash storage and comparison
2. Git diff integration
3. Refresh prompt flow
4. Staleness indicators in CLI

---

## Appendix: Migration Path

### JSONL to SQLite Migration

```bash
later migrate

Migrating from JSONL to SQLite...

Found: 47 items in ~/.later/items.jsonl
Creating: ~/.later/later.db

Progress: [████████████████████] 100%

Migration complete:
  ✅ 47 items migrated
  ✅ 156 tags extracted
  ✅ FTS5 index built

Backup saved: ~/.later/items.jsonl.backup.20260107

SQLite is now the primary storage.
```
