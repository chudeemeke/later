# /later - Deferred Decision Management

**A Claude Code command for capturing decisions with full context, to be revisited later without memory overhead.**

## The Problem

During complex work, you encounter decisions that:
- Aren't urgent enough to do now
- Require significant context to understand later
- Get lost in conversation history
- Are expensive to reconstruct from memory

**Example:** "Should I optimize CLAUDE.md (3,343 words) now or later? What were the options? What was recommended?"

## The Solution

```bash
/later "Optimize CLAUDE.md size"
# ✅ Captured with full context

# Later...
/later list
# [1] Optimize CLAUDE.md size (180d old, optimization)

/later show 1
# Full context restored: options, pros/cons, recommendation

/later do 1
# Convert to actionable todos with all context loaded
```

## Apple-Style Philosophy

**Layer 1 (Simple):** `/later "Title"` - One command captures everything

**Layer 2 (Orchestration):** Auto-extracts context, categorizes, stores with metadata

**Layer 3 (Implementation):** JSONL → SQLite scaling, fuzzy duplication detection, dependency tracking

**Layer 4 (Recovery):** Easy search, filter, convert to action, undo/archive

## Current Status

**Phase:** Design complete, implementation pending

**Next:** MVP (JSONL-based, 200 lines bash, 4-6 hours)

## Documentation

- **[docs/DESIGN.md](docs/DESIGN.md)** - Comprehensive design analysis (storage, edge cases, scaling)
- **[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)** - User stories, command specs, data schema
- **[docs/IMPLEMENTATION-PHASES.md](docs/IMPLEMENTATION-PHASES.md)** - Build roadmap (MVP → V3)
- **[docs/EDGE-CASES.md](docs/EDGE-CASES.md)** - All edge cases + solutions
- **[docs/SCHEMA.md](docs/SCHEMA.md)** - JSONL and SQLite data formats
- **[docs/CONTEXT.md](docs/CONTEXT.md)** - How this project started

## Quick Start (When Implemented)

```bash
# Capture decision
/later "Should I refactor to plugin structure?"

# Review deferred items
/later list
/later list --category refactor
/later list --priority high

# Get details
/later show 3

# Search
/later search "plugin"

# Convert to action
/later do 3  # Creates todos with full context

# Maintain
/later done 3
/later archive --older-than 180d
```

## Project Structure

```
later/
├── README.md (this file)
├── CLAUDE.md (development guidance)
├── docs/ (detailed design documentation)
├── src/ (future implementation)
├── tests/ (test strategy)
└── examples/ (sample data, usage examples)
```

## Integration

**Works with:**
- TodoWrite - Convert deferred items to active todos
- PHILOSOPHY.md - Demonstrates Apple-style design
- Git - Link commits to deferred decisions

## Development

See [CLAUDE.md](CLAUDE.md) for development guidelines and [docs/IMPLEMENTATION-PHASES.md](docs/IMPLEMENTATION-PHASES.md) for build roadmap.

## License

MIT (or your choice - TBD)

---

**Genesis:** Born from the insight "I want to revisit this later without having to remember all the context."
