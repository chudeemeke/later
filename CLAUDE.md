# /later - Development Guide

**Project:** Deferred decision management for Claude Code
**Phase:** Design complete, implementation pending
**Target:** Personal use, designed for power users

## Quick Navigation

- **Getting Started:** [docs/getting-started/](docs/getting-started/)
- **Architecture:** [docs/architecture/](docs/architecture/)
- **Design & UX:** [docs/design/](docs/design/)
- **Technical Specs:** [docs/technical/](docs/technical/)
- **Edge Cases:** [docs/reference/edge-cases/](docs/reference/edge-cases/)
- **Roadmap:** [docs/planning/roadmap/](docs/planning/roadmap/)

## Project Genesis

**Problem identified:** During complex work, you encounter decisions that aren't urgent but require significant context. Without `/later`, this context gets lost in conversation history and is expensive to reconstruct.

**Concrete example:** "Should I optimize CLAUDE.md (currently 3,343 words, ~4,500 tokens)? Options: Hybrid (move examples to skills), Minimal (rules only), Keep as-is. Recommendation: Hybrid. User chose to defer for later review."

**The insight:** Need a universal tool for capturing decisions + full context for revisiting later without memory overhead.

See [docs/project/context.md](docs/project/context.md) for full project history.

## Key Design Decisions

### 1. Storage Mechanism: Hybrid JSONL → SQLite

**Decision:** Start with JSONL (simple, validates concept), migrate to SQLite when items > 500 OR search becomes slow.

**Rationale:**
- ✅ Progressive enhancement (Apple way)
- ✅ Avoid over-engineering
- ✅ Clear migration path
- ✅ Always provide JSONL export (longevity)

**Details:** [docs/architecture/decisions/storage-mechanism.md](docs/architecture/decisions/storage-mechanism.md)

### 2. Schema: Flexible Tags > Rigid Categories

**Decision:** Use extensible tag system with hierarchical structure (`optimization:performance`) instead of fixed category enum.

**Rationale:**
- ✅ No schema lock-in as needs evolve
- ✅ Backward compatible (old items still work)
- ✅ Supports user-defined categories
- ✅ 10-year longevity

**Details:** [docs/architecture/decisions/schema-evolution.md](docs/architecture/decisions/schema-evolution.md)

### 3. Context Capture: Smart Extraction

**Decision:** AI-powered summaries (200-500 words) + last 5-10 messages, not full conversation dumps.

**Rationale:**
- ✅ Practical storage (full convo could be 100KB+)
- ✅ Token-efficient
- ✅ Link to conversation_id for full retrieval if needed
- ✅ Privacy (can sanitize secrets)

**Details:** [docs/technical/implementation/context-extraction.md](docs/technical/implementation/context-extraction.md)

### 4. Duplicate Detection: Fuzzy Matching

**Decision:** Detect similar captures (Levenshtein distance < 20% OR keyword overlap > 80%), offer to update existing instead of creating duplicate.

**Rationale:**
- ✅ Prevents clutter
- ✅ User-friendly (asks, doesn't force)
- ✅ Only checks recent items (performance)

**Details:** [docs/technical/implementation/duplicate-detection.md](docs/technical/implementation/duplicate-detection.md)

### 5. Dependencies: Optional DAG Structure

**Decision:** Support dependencies (item A blocks until B done) but make it optional, not required.

**Rationale:**
- ✅ Simple > complex
- ✅ Most items are independent
- ✅ Power feature for those who need it

**Details:** [docs/technical/implementation/dependency-tracking.md](docs/technical/implementation/dependency-tracking.md)

## Apple-Style Philosophy Application

**Layer 1 (Simple Interface):**
```bash
/later "Optimize CLAUDE.md size"
# ✅ Captured as item #3
```
One command, no required args, captures everything.

**Layer 2 (Hidden Orchestration):**
- Extract AI-powered context summary
- Detect duplicates (fuzzy match)
- Auto-categorize by keywords
- Store with metadata (date, priority, tags)
- Link to conversation for full context

**Layer 3 (Robust Implementation):**
- File locking for concurrent access
- Atomic writes with backups
- Corruption recovery (isolated to single line in JSONL)
- Graceful scaling (JSONL → SQLite when needed)
- Dependency cycle detection

**Layer 4 (Magical Recovery):**
- Easy search with smart ranking
- Convert to actionable todos with one command
- Automatic backups with timestamps
- Export/import for portability
- Archive old items without deletion

See [docs/design/philosophy/apple-style-philosophy.md](docs/design/philosophy/apple-style-philosophy.md) for detailed analysis.

## Implementation Phases

### MVP (JSONL-based) - 4-6 hours
- Basic capture, list, show, done
- Simple search (grep-based)
- 200 lines bash + jq

### V1 Enhanced - 2-3 days
- Categories & tags
- Priority levels
- Smart search/filter
- Duplicate detection
- Convert to TodoWrite

### V2 SQLite - 1 week
- Migration when scale requires
- Full-text search (FTS5)
- Indexed queries
- Relations & dependencies

### V3 Intelligence - 1 month
- AI-powered categorization
- Smart reminders
- Context auto-refresh
- Dependency auto-detection

See [docs/planning/roadmap/](docs/planning/roadmap/) for detailed phase plans.

## Development Guidelines

### File Organization

Follow WoW structure:
- `src/` - Implementation code (when built)
- `docs/` - All documentation (well-organized by topic)
- `tests/` - Unit, integration, fixtures
- `examples/` - Sample data and usage examples

### Documentation Standards

- **Comprehensive:** No skimming, full details
- **Organized:** Proper folder hierarchy, no root dumping
- **Cross-referenced:** Link related docs
- **Examples:** Show, don't just tell
- **Target:** Future you (power user, technical)

### Code Standards (When Implementing)

- **Start simple:** MVP is 200 lines bash
- **Progressive enhancement:** Add complexity only when needed
- **Test edge cases:** See [docs/reference/edge-cases/](docs/reference/edge-cases/)
- **Performance:** Benchmark (see [docs/technical/performance/](docs/technical/performance/))
- **Security:** Sanitize context (see [docs/reference/security-considerations.md](docs/reference/security-considerations.md))

## Testing Strategy

### Unit Tests
- Storage operations (JSONL read/write/append)
- Search ranking algorithm
- Duplicate detection logic
- Context extraction
- Dependency graph validation

### Integration Tests
- Full capture → store → retrieve flow
- Search with various filters
- Convert to TodoWrite
- Migration JSONL → SQLite
- Concurrent access (race conditions)

### Edge Case Tests
See [docs/reference/edge-cases/](docs/reference/edge-cases/) - all 10 edge cases must have tests.

## Integration Points

### TodoWrite
`/later do 3` creates todos with full context, links back to deferred item, marks as "in progress".

### Git
Commit messages can reference `/later #3`, tracking what decisions led to what code.

### PHILOSOPHY.md
Demonstrates Apple-style 4-layer model in practice.

See [docs/architecture/system/integration-points.md](docs/architecture/system/integration-points.md) for details.

## Security Considerations

- Auto-sanitize secrets (API keys: `sk-`, `ghp-`, etc.)
- Warn if potential secrets detected
- Optional `--no-context` flag
- Encryption at rest (optional GPG)
- Visibility control (personal vs team)

Full details: [docs/reference/security-considerations.md](docs/reference/security-considerations.md)

## Performance Targets

- **Capture:** < 100ms
- **List:** < 50ms (JSONL), < 10ms (SQLite)
- **Search:** < 500ms (JSONL at 500 items), < 50ms (SQLite)
- **Convert to todo:** < 200ms

Benchmarks: [docs/technical/performance/benchmarks.md](docs/technical/performance/benchmarks.md)

## Next Steps

1. ✅ **Design complete** (this documentation)
2. ⏳ **Push to GitHub** (make repository)
3. ⏳ **Test in Claude Code sandbox**
4. ⏳ **Implement MVP** (200 lines, 4-6 hours)
5. ⏳ **Validate concept** (use it for real decisions)
6. ⏳ **Enhance based on usage** (V1 features)

## Related Projects

- **ai-dev-environment:** Provides WoW structure conventions
- **TodoWrite:** Integration target for converting deferred → action
- **PHILOSOPHY.md:** Global reference for Apple-style design

---

**Remember:** This tool exists because of a real need - "I want to revisit this later without having to remember all the context." Keep that user need central to every design decision.
