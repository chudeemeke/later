# Project Context: How /later Was Born

**Date:** 2025-10-31
**Origin:** Real user need during Claude Code session

## The Problem

User was working on optimizing CLAUDE.md size when they realized:

> "I'll leave it as is for now but I want to come back to visit if in the future and don't want to have to deal with trying to remember all the relevant issues, details, pros, cons, your recommendations, my inclinations, etc when I return."

**The universal pattern:** Need to defer a decision without losing context.

## Initial Brainstorming

**Names considered:**
- /defer - Too formal
- /wishlist - Wrong metaphor (not wishes)
- /todolist - Conflicts with TodoWrite
- /backlog - Agile jargon
- **/later** ✅ - Natural, conversational

**Why /later won:** Matches how humans actually speak ("I'll do it later")

## Design Constraints

**From user requirements:**
1. **No context pollution** - Self-contained project
2. **Well thought through** - Comprehensive edge case coverage
3. **No skimming** - Full quality despite context windows
4. **Regular commits** - Small, focused git commits
5. **Production-ready** - GitHub and Claude Code sandbox ready

## Key Design Decisions

See [decisions-log.md](decisions-log.md) for full list.

**Most impactful:**
1. **JSONL → SQLite hybrid** - Start simple, scale when needed
2. **Apple-style 4-layer model** - Simple surface, robust underneath
3. **AI-powered context extraction** - Intelligent by default, works without AI
4. **10-year longevity test** - Plain text formats, future-proof

## User Requirements

**Explicit:**
- Capture decisions with full context
- Find them later without effort
- Convert to actionable todos when ready

**Implicit (discovered through ultrathinking):**
- Handle duplicates (fuzzy matching)
- Scale gracefully (JSONL → SQLite)
- Never lose data (atomic writes, backups)
- Work offline (AI optional)
- Portable (export always available)

## Development Approach

**Methodology:**
1. **Architecture first** - Think deeply before coding
2. **TDD** - Tests define behavior
3. **Progressive enhancement** - MVP → V1 → V2 → V3
4. **Documentation driven** - Docs before code

**Tools:**
- Claude Sonnet 4.5 for design thinking
- Plain bash for implementation (universal)
- jq for JSON processing
- SQLite for scaling

## Timeline

- **Day 1:** Concept, ultrathinking, architecture
- **Day 1-2:** Complete documentation (you are here)
- **Week 1:** MVP implementation
- **Week 2-3:** V1 enhancements
- **Month 2:** V2 SQLite migration (user-triggered)
- **Month 6+:** V3 intelligence features

## Success Criteria

**MVP (Week 1):**
- Can capture decision in < 5s
- Can find decision in < 10s
- Zero data loss

**V1 (Week 3):**
- AI context extraction > 95% success rate
- Duplicate detection > 90% accuracy
- User can defer 10+ decisions, revisit months later

**V2 (Month 2):**
- Search < 10ms (any dataset size)
- Handle 10,000+ items effortlessly
- Migration success rate 100%

**V3 (Month 6+):**
- Smart reminders save 5+ min/week
- Auto-categorization > 85% accuracy
- User says: "It suggests before I think of it"

## Lessons Learned (So Far)

**Documentation phase insights:**
1. **Ultrathinking pays off** - Deep analysis prevented major issues
2. **Write docs first** - Clarifies design before coding
3. **Edge cases are features** - Most value is in handling edge cases well
4. **Regular commits work** - Small commits show progress, easier to review
5. **Quality over speed** - No skimming maintained high standards

## Related

- [Decisions Log](decisions-log.md) - All design decisions
- [Architecture Overview](../architecture/system/system-design.md) - System design
- [Roadmap](../planning/roadmap/mvp-phase.md) - Implementation phases

---

**This document captures the "why" behind /later**
**For the "how", see the extensive documentation in docs/**
