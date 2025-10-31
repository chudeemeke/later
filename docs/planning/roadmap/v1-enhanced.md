# V1 Enhanced (v1.0-1.5)

**Goal:** Add intelligence and organization features

**Timeline:** 2-3 weeks after MVP

**Success Criteria:** Decisions are well-organized and contextually rich

## New Features

### 1. AI Context Extraction

```bash
/later "Optimize database queries"
# Automatically extracts context from conversation
```

**Implementation:**
- Claude API integration (Haiku 4.5)
- 200-500 word summary
- Structured output (options, recommendation)
- Fallback to manual entry

**Impact:** Users can revisit decisions with full context

### 2. Categories & Tags

```bash
/later "Title" --category optimization --tags performance,database
```

**Implementation:**
- Add categories array (hierarchical)
- Add tags array (flat)
- Auto-categorization (keyword matching)

**Impact:** Better organization and filtering

### 3. Priority Levels

```bash
/later "Title" --priority high
```

**Implementation:**
- Add priority field (low|medium|high)
- Default: medium
- Filter by priority in list

**Impact:** Focus on important items

### 4. Duplicate Detection

**Automatic on capture:**
```
⚠️  Similar item exists: [3] Optimize database
Update existing or create new?
```

**Implementation:**
- Levenshtein distance < 20%
- Keyword overlap > 80%
- Offer update vs create

**Impact:** Prevent cluttered list

### 5. Edit Command

```bash
/later edit 3 --priority high --add-tag security
```

**Implementation:**
- Interactive editor (default)
- Quick edits via flags
- Update updated_at timestamp

**Impact:** Maintain items over time

### 6. Enhanced Search

**Ranked results:**
```bash
/later search "database performance"
# Title matches ranked higher than context matches
```

**Implementation:**
- Weighted scoring (title 60%, context 30%, tags 10%)
- Recency boost
- Highlight matches

**Impact:** Find relevant items faster

### 7. Archive Command

```bash
/later archive --older-than 365d
```

**Implementation:**
- Bulk archive with preview
- Status → archived (not deleted)
- Restore capability

**Impact:** Keep active list clean

## Updated Item Format

```json
{
  "id": 3,
  "title": "Optimize database queries",
  "status": "deferred",
  "categories": ["optimization", "optimization:performance"],
  "tags": ["database", "postgres", "query-performance"],
  "priority": "high",
  "captured_at": "2025-10-31T14:30:00Z",
  "updated_at": "2025-11-15T09:20:00Z",
  "context": {
    "summary": "User reported slow queries...",
    "options": ["Add index", "Partition table", "Add caching"],
    "recommendation": "Start with composite index",
    "key_considerations": ["50M rows", "2.5s → < 100ms target"]
  }
}
```

## New Commands

```bash
/later edit <id>           # Edit existing item
/later archive             # Archive old items
/later list --category     # Filter by category
/later list --priority     # Filter by priority
/later search <query>      # Enhanced search
```

## Performance Targets

- Context extraction: < 2s
- Duplicate detection: < 100ms
- Search (500 items): < 300ms
- List (500 items): < 100ms

## Timeline

| Week | Features | Status |
|------|----------|--------|
| 1 | AI context, categories | Core intelligence |
| 2 | Duplicate detection, edit | Quality of life |
| 3 | Enhanced search, archive | Organization |

## Migration from MVP

**Backward compatible:**
```bash
# MVP items still valid
{"id":1,"title":"Item","status":"deferred","captured_at":"..."}

# V1 reads MVP items, adds defaults:
{
  "id": 1,
  "title": "Item",
  "status": "deferred",
  "categories": [],  # Added
  "tags": [],        # Added
  "priority": "medium",  # Added
  "captured_at": "...",
  "updated_at": "...",   # Added
  "context": {}      # Added
}
```

## User Communication

**On upgrade:**
```
✅ Upgraded to v1.0

New features:
  - AI context extraction (automatic)
  - Categories and tags (organize items)
  - Duplicate detection (prevent clutter)
  - Enhanced search (ranked results)

See: /later help
```

## Success Metrics

- Context extraction success rate: > 95%
- Duplicate detection accuracy: > 90%
- User time saved per search: ~10s
- Items with categories: > 80%

## Risks

**API dependency:**
- Claude API outage → Fallback to manual
- Cost per capture: ~$0.001 (acceptable)

**Complexity creep:**
- Too many options → Keep defaults sane
- Feature discovery → Progressive disclosure

## Next Phase

After V1 stabilizes → **V2 SQLite Migration** (performance at scale)

## Related

- [MVP Phase](mvp-phase.md) - Foundation
- [V2 SQLite](v2-sqlite.md) - Scaling solution
- [Context Extraction](../../technical/implementation/context-extraction.md) - Technical details
