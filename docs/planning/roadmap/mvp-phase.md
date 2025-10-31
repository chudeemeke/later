# MVP Phase (v0.1-0.5)

**Goal:** Validate concept with minimal features

**Timeline:** 4-6 hours (slash command) OR 6-8 hours (MCP server)

**Success Criteria:** Can capture and retrieve decisions without documentation

## Implementation Options

### Option A: Slash Command + Bash Script
**When:** Quick validation, time-constrained
**Effort:** 4-6 hours
**Output:** `~/.claude/commands/later.md` + `~/.local/bin/later`

**Pros:**
- ✅ Fast to implement
- ✅ Simple bash + jq
- ✅ Good enough to validate concept

**Cons:**
- ❌ Claude can't invoke automatically
- ❌ User must manually type `/later`

### Option B: MCP Server (Recommended)
**When:** Want full integration from start
**Effort:** 6-8 hours
**Output:** `~/Projects/later/dist/index.js` (Node.js MCP server)

**Pros:**
- ✅ First-class tool integration
- ✅ Claude invokes proactively
- ✅ Schema validation, better errors
- ✅ Clean migration path to V1

**Cons:**
- ❌ More upfront work
- ❌ Requires Node.js/TypeScript

### Migration Path
Clean upgrade from Option A → Option B available via automated migration script.
See [Migration Strategy](../../architecture/decisions/migration-strategy.md).

## Core Features

### 1. Capture (Day 1-2)
```bash
/later "Decision title"
```

**Implementation:**
- Simple append to JSONL
- Auto-generate ID
- Timestamp (captured_at)
- Status: deferred (default)

**No AI, no context extraction** - Just title and timestamp.

### 2. List (Day 2-3)
```bash
/later list
```

**Implementation:**
- Read JSONL, display table
- Show: ID, title, age, status
- Limit to 20 most recent
- Sort by date DESC

### 3. Show (Day 3-4)
```bash
/later show 3
```

**Implementation:**
- Direct line access
- Display full item details
- Format with boxes/separators

### 4. Done (Day 4-5)
```bash
/later done 3
```

**Implementation:**
- Update status to "done"
- Update updated_at timestamp
- Atomic write (temp + rename)

### 5. Basic Search (Day 5-6)
```bash
/later search "optimize"
```

**Implementation:**
- Grep-based (title only)
- Case-insensitive
- Display matches

## Not Included in MVP

- ❌ AI context extraction (manual only)
- ❌ Duplicate detection (user responsibility)
- ❌ Categories/tags (just title)
- ❌ Dependencies (not needed yet)
- ❌ TodoWrite integration (future)
- ❌ SQLite (JSONL sufficient)

## File Structure

### Option A: Slash Command
```bash
~/.claude/commands/
└── later.md              # Slash command definition

~/.local/bin/
└── later                 # Bash script with subcommands

~/.later/
├── items.jsonl           # Data storage
└── config.json           # Version tracking
```

### Option B: MCP Server
```bash
~/Projects/later/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts         # MCP entry point
│   ├── tools/           # Tool handlers
│   ├── storage/         # Storage layer
│   └── utils/           # Utilities
└── dist/
    └── index.js         # Compiled output

~/.later/
├── items.jsonl          # Data storage (same format)
└── config.json          # Version tracking
```

## MVP Item Format

```json
{
  "id": 1,
  "title": "Optimize CLAUDE.md size",
  "status": "deferred",
  "captured_at": "2025-10-31T14:30:00Z",
  "updated_at": "2025-10-31T14:30:00Z"
}
```

**That's it.** Minimal but functional.

## Testing

```bash
# Happy path
later "Test item"  # Should create item #1
later list          # Should show item
later show 1        # Should display details
later done 1        # Should mark done
later list          # Should show as done

# Edge cases
later ""            # Should error (empty title)
later show 999      # Should error (not found)
```

## Success Metrics

- ✅ Can capture decision in < 5 seconds
- ✅ Can find decision in < 10 seconds
- ✅ Zero crashes in normal usage
- ✅ Data file remains valid JSON lines

## Timeline

### Option A: Slash Command (4-6 hours)

| Phase | Duration | Output |
|-------|----------|--------|
| Setup | 30 min | Project structure, slash command file |
| Capture | 1 hour | Can create items |
| List | 1 hour | Can view items |
| Show | 30 min | Can see details |
| Done | 30 min | Can mark complete |
| Testing | 1 hour | MVP validated |

**Total:** 4-6 hours

### Option B: MCP Server (6-8 hours)

| Phase | Duration | Output |
|-------|----------|--------|
| Setup | 30 min | npm project, TypeScript config |
| Types | 15 min | Type definitions |
| Storage (TDD) | 1.5 hours | JSONL storage with tests |
| Utilities (TDD) | 2 hours | Duplicate detection, sanitization |
| Tools (TDD) | 2.5 hours | All 4 tool handlers with tests |
| MCP Server | 1 hour | Server integration, registration |
| Testing | 1 hour | Full validation |

**Total:** 6-8 hours

See [Standalone Implementation Guide](../../getting-started/standalone-implementation-guide.md) for detailed step-by-step instructions.

## Risks

**Technical:**
- File corruption (mitigated by atomic writes)
- Concurrent access (mitigated by append-only)

**User:**
- Feature too minimal (mitigated by quick V1 follow-up)
- Complex decisions need context (documented limitation)

## Next Phase

After MVP validation → **V1 Enhanced** (add categories, tags, context)

## Related

- [V1 Enhanced](v1-enhanced.md) - Feature additions
- [JSONL Format](../../technical/schema/jsonl-format.md) - Data format
