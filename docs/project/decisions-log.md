# Design Decisions Log

**Chronological record of key design decisions**

## 2025-10-31: Initial Design

### Decision 1: Name - "/later"
**Options:** /defer, /wishlist, /todolist, /backlog, /later
**Chosen:** /later
**Rationale:** Natural language, conversational, matches user speech
**Impact:** User adoption, discoverability
**See:** [Naming Conventions](../design/philosophy/naming-conventions.md)

### Decision 2: Storage - JSONL → SQLite Hybrid
**Options:** JSONL only, SQLite only, Cloud DB, Hybrid
**Chosen:** Hybrid (JSONL → SQLite when > 500 items)
**Rationale:** Start simple, scale when needed, 10-year longevity
**Impact:** Performance, portability, future-proofing
**See:** [Storage Mechanism](../architecture/decisions/storage-mechanism.md)

### Decision 3: Schema - Flexible Tags
**Options:** Fixed categories, Strict hierarchy, Flexible tags
**Chosen:** Flexible tags with optional hierarchy
**Rationale:** Schema evolution without breaking changes
**Impact:** Extensibility, user freedom
**See:** [Schema Evolution](../architecture/decisions/schema-evolution.md)

### Decision 4: Context Extraction - AI with Fallbacks
**Options:** Manual only, AI required, AI optional
**Chosen:** AI default with manual fallback
**Rationale:** Intelligent by default, works without AI
**Impact:** User experience, cost, offline capability
**See:** [Context Extraction](../technical/implementation/context-extraction.md)

### Decision 5: Duplicate Detection - Fuzzy Matching
**Options:** Exact match, No detection, Fuzzy matching
**Chosen:** Fuzzy (Levenshtein + keyword overlap)
**Rationale:** Prevent clutter while allowing user override
**Impact:** Data quality, user autonomy
**See:** [Duplicate Detection](../technical/implementation/duplicate-detection.md)

### Decision 6: Migration Trigger - 500 Items
**Options:** Never migrate, Always SQLite, User choice, Auto at threshold
**Chosen:** Auto-offer at 500 items OR slow performance
**Rationale:** Proactive before frustration, user controlled
**Impact:** Performance, user experience
**See:** [Scaling Strategy](../architecture/decisions/scaling-strategy.md)

### Decision 7: Dependencies - Optional DAG
**Options:** No dependencies, Required DAG, Optional graph
**Chosen:** Optional DAG (most items independent)
**Rationale:** Powerful when needed, not mandatory
**Impact:** Complexity, use cases
**See:** [Dependency Tracking](../technical/implementation/dependency-tracking.md)

### Decision 8: Architecture - Apple-Style 4-Layer
**Options:** Monolith, Microservices, Layered
**Chosen:** 4-layer (Simple Interface, Orchestration, Robust Implementation, Recovery)
**Rationale:** Progressive disclosure, complexity hidden
**Impact:** Maintainability, user experience
**See:** [Apple-Style Philosophy](../design/philosophy/apple-style-philosophy.md)

### Decision 9: Error Handling - Teach, Don't Punish
**Options:** Terse errors, Verbose errors, Teaching errors
**Chosen:** Teaching errors with suggestions
**Rationale:** Errors guide users to success
**Impact:** User satisfaction, learning curve
**See:** [Error Handling](../design/user-experience/error-handling.md)

### Decision 10: Security - Defense in Depth
**Options:** Trust user, Lock everything, Layered security
**Chosen:** Layered (detect, warn, sanitize, encrypt)
**Rationale:** Protect by default, user controllable
**Impact:** Data safety, flexibility
**See:** [Security Considerations](../reference/security-considerations.md)

## Future Decisions (To Be Made)

### Pending 1: Team Collaboration
**Question:** Should /later support shared items?
**Options:** Personal only, Team features, Enterprise
**Timeline:** Post-V2 (after individual usage validated)

### Pending 2: Mobile Apps
**Question:** Native mobile vs web-based?
**Options:** Native iOS/Android, PWA, No mobile
**Timeline:** Post-V3 (after desktop mature)

### Pending 3: AI Model Choice
**Question:** Haiku 4.5 vs Sonnet 4.5 default?
**Options:** Haiku (fast/cheap), Sonnet (quality), User choice
**Timeline:** V1 (based on quality metrics)

### Pending 4: Export Formats
**Question:** Beyond JSONL/JSON/CSV?
**Options:** Markdown, PDF, HTML, Database dumps
**Timeline:** V2 (based on user requests)

## Decision Criteria

**Framework used for all decisions:**
1. **User value** - Does this solve a real problem?
2. **Complexity** - Is it worth the added complexity?
3. **Reversibility** - Can we change this later?
4. **Longevity** - Will this work in 10 years?
5. **Cost** - What's the implementation cost?

**Prioritization:**
- ✅ High value, low complexity → Do now
- ⚠️  High value, high complexity → Careful planning
- ⏳ Low value, low complexity → Maybe later
- ❌ Low value, high complexity → Reject

## Related Documents

- [Architecture Decisions](../architecture/decisions/) - Detailed rationale
- [Design Philosophy](../design/philosophy/) - Guiding principles
- [Project Context](context.md) - Origin story

---

**This log is living document**
**Add new decisions with: date, options, chosen, rationale, impact**
