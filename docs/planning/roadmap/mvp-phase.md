# MVP Phase (v0.1-0.5)

**Goal:** Validate concept with minimal features

**Timeline:** 1-2 weeks

**Success Criteria:** Can capture and retrieve decisions without documentation

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

```bash
src/commands/
├── later-capture.sh
├── later-list.sh
├── later-show.sh
├── later-done.sh
└── later-search.sh

src/core/
└── utils.sh  # Shared functions (get_next_id, atomic_write)

~/.later/
└── deferred.jsonl
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

| Day | Task | Output |
|-----|------|--------|
| 1 | Capture command | Can create items |
| 2 | List command | Can view items |
| 3 | Show command | Can see details |
| 4 | Done command | Can mark complete |
| 5 | Search command | Can find items |
| 6 | Testing & polish | MVP ready |

**Total:** 6 days (1 week)

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
