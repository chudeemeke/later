# Architecture Decision: Schema Evolution Strategy

**Status:** Decided
**Date:** 2025-10-31
**Decision:** Flexible tag-based system with hierarchical structure instead of fixed category enums

## Problem Statement

Software systems evolve. What starts as simple categories ("optimization") becomes nuanced over time ("optimization:performance", "optimization:memory", "optimization:cost").

**Challenge:** How do we design the data schema to evolve over years without:
- Breaking existing data
- Requiring complex migrations
- Locking users into our assumptions
- Losing backward compatibility

**Real example:** Initially, "optimization" captures all optimization decisions. Six months later, you realize you need to distinguish between performance, memory, and cost optimizations. A year later, you add "optimization:database" and "optimization:frontend".

How does the schema handle this natural evolution?

## Bad Approach: Fixed Category Enum

**Anti-pattern:**
```json
{
  "id": 1,
  "title": "Optimize CLAUDE.md",
  "category": "optimization",  // Single, fixed category
  "priority": "medium"
}
```

**Problems:**
1. **Schema lock-in** - Only predefined categories allowed
2. **Breaks on evolution** - Adding "optimization:performance" requires schema change
3. **Migration hell** - Need to update all existing "optimization" items
4. **User frustration** - Can't create custom categories for their needs
5. **Forced choices** - Item might be both "optimization" AND "refactor"

**Evolution scenario:**
```
Week 1:  category = "optimization"  // OK
Week 10: Need "optimization:performance"  // BREAK - invalid category
         Must add to enum, migrate existing data
Week 20: Need "optimization:memory"  // BREAK again
```

Every evolution requires:
- Code changes (update enum)
- Data migration (update existing items)
- Testing (ensure nothing breaks)
- Deployment coordination
- User communication

This is **fragile, expensive, and frustrating**.

## Good Approach: Flexible Tags with Hierarchy

**Recommended pattern:**
```json
{
  "id": 1,
  "title": "Optimize CLAUDE.md size",
  "categories": ["optimization", "optimization:performance"],
  "tags": ["claude-md", "documentation", "token-efficiency"],
  "metadata": {
    "priority": "medium",
    "complexity": "moderate",
    "time_estimate": "2h"
  }
}
```

**Benefits:**
1. ✅ **Extensible** - Add new categories anytime, no schema change
2. ✅ **Backward compatible** - Old items still work
3. ✅ **Hierarchical** - Use `:` separator for sub-categories
4. ✅ **User-defined** - No validation, trust the user
5. ✅ **Multi-faceted** - Item can have multiple categories/tags

**Evolution scenario:**
```
Week 1:  categories: ["optimization"]  // Works
Week 10: categories: ["optimization", "optimization:performance"]  // Works
Week 20: categories: ["optimization", "optimization:memory"]  // Works
Week 52: categories: ["optimization:database:query"]  // Still works
```

No code changes, no migrations, no coordination. **Just works.**

## Design Principles

### 1. Categories vs Tags

**Categories:** Broad classification (what type of decision is this?)
- Examples: decision, optimization, refactor, feature, research, question, bug

**Tags:** Specific attributes (what does this relate to?)
- Examples: claude-md, performance, database, frontend, authentication

**Both are arrays:** An item can have multiple of each.

**No validation:** User can create any category or tag. Trust > control.

### 2. Hierarchical Structure with `:`

**Syntax:** `parent:child:grandchild`

**Examples:**
- `optimization` → General optimization
- `optimization:performance` → Performance-specific
- `optimization:performance:database` → Database performance
- `optimization:memory` → Memory optimization

**Search semantics:** Searching "optimization" matches ALL:
- `optimization`
- `optimization:performance`
- `optimization:performance:database`
- `optimization:memory`
- `optimization:cost`

This is implemented with simple prefix matching: `category.startsWith("optimization")`

**Why `:` not `/` or `.`?**
- `:` is clear and distinct
- `/` conflicts with file paths
- `.` conflicts with property access
- `:` is used by org-mode, Obsidian, and other knowledge tools (familiar)

### 3. Initial Categories (Suggestions, Not Requirements)

**Suggested categories:**
- `decision` - Choose between options
- `optimization` - Works but could be better
- `refactor` - Technical debt, restructuring
- `feature` - New capability to add
- `research` - Needs investigation
- `question` - Unresolved question
- `idea` - Random thought to explore
- `bug` - Known issue, not urgent
- `learning` - Skill/knowledge to acquire

**But users can:**
- Create `project-planning`, `architecture-review`, `security-audit`
- Use hierarchies: `feature:ui`, `feature:backend`, `feature:api`
- Ignore suggestions entirely and use their own taxonomy

**The tool provides suggestions** (auto-complete), but **never validates** (no errors for custom categories).

### 4. Metadata Structure

**Metadata fields** (all optional):
```json
{
  "metadata": {
    "priority": "high|medium|low",
    "complexity": "simple|moderate|complex",
    "time_estimate": "15m|1h|2h|1d|1w|1m",
    "effort": "quick-win|significant-work",
    "impact": "high|medium|low",
    "certainty": "confident|uncertain|speculative"
  }
}
```

These are **structured** (limited values) unlike categories/tags (freeform).

**Why structured?**
- Enables filtering: `/later list --priority high`
- Supports sorting: `/later list --sort priority`
- Provides UI affordances (dropdowns, not text input)

**Why optional?**
- Not every item needs all metadata
- Capture should be fast (don't force fields)
- Can be added later: `/later edit 3 --priority high`

## Real-World Evolution Example

**Month 1:** User captures decisions simply
```json
{
  "categories": ["decision"],
  "tags": ["claude-md"]
}
```

**Month 3:** User realizes they have many "optimization" decisions
```json
{
  "categories": ["decision", "optimization"],
  "tags": ["claude-md", "performance"]
}
```

**Month 6:** User wants to distinguish types of optimization
```json
{
  "categories": ["decision", "optimization:performance"],
  "tags": ["claude-md", "token-efficiency", "documentation"]
}
```

**Month 12:** User develops entire taxonomy
```json
{
  "categories": [
    "optimization:performance:search",
    "architecture:decision",
    "documentation:technical"
  ],
  "tags": ["claude-md", "token-efficiency", "documentation", "scaling"]
}
```

**All items remain valid.** Old items with `["decision"]` still work. New items with complex hierarchies work. Search and filter work across all.

## Implementation Details

### Storage

**JSONL:**
```json
{"id":1,"categories":["optimization"],"tags":["claude-md"]}
{"id":2,"categories":["optimization","optimization:performance"],"tags":["claude-md","token-efficiency"]}
```

Arrays stored as JSON arrays. Simple. No special parsing needed.

**SQLite:**
```sql
-- Many-to-many relationships
CREATE TABLE categories (
  item_id INTEGER,
  category TEXT,
  FOREIGN KEY (item_id) REFERENCES deferred_items(id)
);

CREATE INDEX idx_categories_category ON categories(category);
```

Separate table allows multiple categories per item, efficient querying.

### Search Implementation

**Exact match:**
```bash
jq '.[] | select(.categories[] == "optimization")' deferred.jsonl
```

**Hierarchical match:**
```bash
jq '.[] | select(.categories[] | startswith("optimization"))' deferred.jsonl
```

**SQLite:**
```sql
SELECT * FROM deferred_items
WHERE id IN (
  SELECT item_id FROM categories
  WHERE category LIKE 'optimization%'
);
```

### Auto-complete Suggestions

Track category usage frequency:
```json
{
  "optimization": 42,  // Used 42 times
  "optimization:performance": 15,
  "optimization:memory": 8,
  "decision": 35,
  "refactor": 20
}
```

When user types `/later capture`, suggest most-used categories.

When user types `optim`, filter to matching suggestions.

**Never validate.** Always allow custom input.

## Migration Strategy (Not Needed!)

**The beauty of this approach:** No migrations needed.

If we later realize we need a new top-level field (e.g., "dependencies"), we just:
1. Add field to schema documentation
2. Start populating it in new items
3. Old items without the field still work (treat as empty)

**Example:**
```json
// Old item (still valid)
{"id":1,"categories":["optimization"]}

// New item (also valid)
{"id":2,"categories":["optimization"],"depends_on":[1]}
```

Both work. No migration. No breakage.

## Why This Matters for 10-Year Longevity

**Year 1:** Simple categories
**Year 3:** Developed hierarchy
**Year 5:** Rich taxonomy with 50+ categories
**Year 10:** Complex multi-faceted classification

**With rigid schema:** Multiple migrations, data loss risk, user frustration

**With flexible tags:** Seamless evolution, no migrations, no breakage

This is **future-proof by design**.

## Comparison to Other Systems

**org-mode:** Uses tags like `:work:project:urgent:`
- Similar concept
- We use `:` as separator within category, not wrapper
- More structured (categories vs tags distinction)

**Obsidian:** Uses `#tags` and `#nested/tags`
- Similar hierarchical approach
- We use `/` would conflict with paths, `:` is clearer

**GitHub labels:** Freeform tags with colors
- Similar flexibility
- We add hierarchy support

**JIRA issue types:** Fixed enum (Bug, Feature, Task)
- Opposite approach
- We learned from their rigidity

## Trade-offs

**Flexibility vs Structure:**
- Flexible schema → harder to enforce consistency
- User might create "optim" and "optimization" (duplicates)
- Mitigated by: auto-complete suggestions, fuzzy search

**No Validation:**
- User can create any category → potential chaos
- But: trust the user, they know their needs
- They can always refactor later: `/later edit 3 --category correct-spelling`

**Array Overhead:**
- Storing arrays vs single value → slightly more storage
- But: minimal (few bytes per item)
- Benefit: far exceeds cost

## Related Decisions

- [Storage Mechanism](storage-mechanism.md) - JSONL/SQLite both support arrays well
- [Search Ranking](../../technical/implementation/search-ranking.md) - How hierarchical search works
- [JSONL Format](../../technical/schema/jsonl-format.md) - Array syntax
- [SQLite Schema](../../technical/schema/sqlite-schema.md) - Many-to-many tables

## Future Enhancements

**Potential additions** (all additive, no breaking changes):

1. **Category inheritance:**
   - Define `optimization:performance` inherits from `optimization`
   - Auto-apply parent tags

2. **Category aliases:**
   - `optim` → `optimization`
   - `perf` → `optimization:performance`
   - Resolve at query time

3. **Suggested hierarchies:**
   - When user types `optimization:`, suggest common children
   - Learn from usage patterns

4. **Category analytics:**
   - Show usage distribution
   - Identify orphaned categories
   - Suggest consolidation

All of these are **additive**. They don't require changing existing data.

---

**Decision Date:** 2025-10-31
**Decided By:** User (power user, long-term thinking)
**Status:** Approved for implementation

**Key Insight:** The best schema is one that doesn't need to be changed. Flexibility > structure for evolving systems.
