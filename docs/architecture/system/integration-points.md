# Integration Points

**Last Updated:** 2025-10-31
**Status:** Design Complete

## Overview

The `/later` system integrates with existing tools and conventions to provide a seamless workflow. Rather than being isolated, it acts as a **bridge** between:

- **Decision capture** (what to defer)
- **Action execution** (when to do it) via TodoWrite
- **Code history** (why it was done) via Git
- **Design philosophy** (how it exemplifies principles) via PHILOSOPHY.md

This document details each integration point with concrete examples and implementation guidance.

## 1. TodoWrite Integration

**Purpose:** Convert deferred decisions into actionable tasks with full context.

**Flow:** Deferred item → Breakdown → TodoWrite todos → Execution → Mark done

### Detailed Flow

```
User: /later do 3

Step 1: Retrieve Item
┌─────────────────────────────────────────────────────────┐
│ Item #3: Optimize CLAUDE.md size                        │
│ Category: optimization, decision                         │
│ Context: Current size 3,343 words (~4,500 tokens).      │
│          Options:                                        │
│          1. Hybrid (move examples to skills)             │
│          2. Minimal (rules only)                         │
│          3. Keep as-is                                   │
│          Recommendation: Hybrid approach                 │
│ Priority: medium                                         │
│ Captured: 2025-10-31 (0d ago)                           │
└─────────────────────────────────────────────────────────┘

Step 2: AI-Powered Breakdown
┌─────────────────────────────────────────────────────────┐
│ Suggested breakdown:                                     │
│   1. Analyze current CLAUDE.md structure                │
│   2. Identify examples to move to skills                │
│   3. Create new skill files for examples                │
│   4. Update CLAUDE.md with references                   │
│   5. Test that skills load correctly                    │
│   6. Compare token counts (before/after)                │
│                                                           │
│ Proceed with this breakdown? [Y/n/edit]                 │
└─────────────────────────────────────────────────────────┘

Step 3: Create TodoWrite Items
┌─────────────────────────────────────────────────────────┐
│ TodoWrite({                                              │
│   todos: [                                               │
│     {                                                    │
│       content: "Analyze CLAUDE.md structure",           │
│       activeForm: "Analyzing CLAUDE.md structure",      │
│       status: "pending"                                  │
│     },                                                   │
│     {                                                    │
│       content: "Identify examples for skill extraction",│
│       activeForm: "Identifying examples",               │
│       status: "pending"                                  │
│     },                                                   │
│     {                                                    │
│       content: "Create skill files",                    │
│       activeForm: "Creating skill files",               │
│       status: "pending"                                  │
│     },                                                   │
│     {                                                    │
│       content: "Update CLAUDE.md with references",      │
│       activeForm: "Updating CLAUDE.md",                 │
│       status: "pending"                                  │
│     },                                                   │
│     {                                                    │
│       content: "Test skill loading",                    │
│       activeForm: "Testing skill loading",              │
│       status: "pending"                                  │
│     },                                                   │
│     {                                                    │
│       content: "Compare token counts",                  │
│       activeForm: "Comparing token counts",             │
│       status: "pending"                                  │
│     }                                                    │
│   ]                                                      │
│ })                                                       │
└─────────────────────────────────────────────────────────┘

Step 4: Link Back to Deferred Item
┌─────────────────────────────────────────────────────────┐
│ ✅ Created 6 todos from /later #3                       │
│ 📎 Link: Each todo includes "From: /later #3"           │
│ 🔄 Item #3 status: deferred → in_progress               │
└─────────────────────────────────────────────────────────┘

Step 5: Execution (User works through todos)
User marks todos complete one by one...

Step 6: Completion Callback
When all todos done:
┌─────────────────────────────────────────────────────────┐
│ All todos from /later #3 complete!                      │
│ Mark deferred item as done? [Y/n]                       │
└─────────────────────────────────────────────────────────┘

User: Y

Step 7: Archive Decision
┌─────────────────────────────────────────────────────────┐
│ ✅ Item #3 marked as "done"                             │
│ 📊 Stats updated:                                        │
│    - 6 todos created                                     │
│    - Completed in 2 hours                                │
│    - Token reduction: 1,200 tokens (27%)                │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

**Backend Storage:**
```json
{
  "id": 3,
  "title": "Optimize CLAUDE.md size",
  "status": "in_progress",
  "linked_todos": [
    {"todo_id": 1, "status": "completed"},
    {"todo_id": 2, "status": "completed"},
    {"todo_id": 3, "status": "in_progress"},
    {"todo_id": 4, "status": "pending"},
    {"todo_id": 5, "status": "pending"},
    {"todo_id": 6, "status": "pending"}
  ],
  "execution_started": "2025-10-31T14:30:00Z",
  "execution_completed": null
}
```

**Bidirectional Linking:**
- Deferred item → Todo IDs
- Todo → Source deferred item ID

This allows:
- Show progress in `/later show 3`
- Jump to context from todo
- Auto-complete deferred item when todos done

### Error Handling

**If breakdown fails:**
```bash
⚠️  Warning: AI breakdown unavailable
Please provide manual breakdown:
  1. [Enter step 1]
  2. [Enter step 2]
  ...
Or skip breakdown and create single todo? [Y/n]
```

**If todo creation fails:**
```bash
❌ Error: TodoWrite failed (check Claude Code status)
Item #3 remains in "deferred" state
Retry with: /later do 3
```

## 2. Git Integration

**Purpose:** Link code commits to deferred decisions, creating traceable decision history.

**Flow:** Deferred item → Work on solution → Commit with reference → Audit trail

### Commit Message Convention

**Format:**
```
<type>(<scope>): <subject>

<body>

Resolves: /later #3

<footer>
```

**Example:**
```
refactor(docs): split CLAUDE.md examples into skills

Move 15 code examples from CLAUDE.md to separate skill files:
- project-creation.md (project structure examples)
- git-workflow.md (commit message examples)
- tdd-approach.md (TDD cycle examples)

Updated CLAUDE.md to reference skills instead of inline examples.
Reduces token count from 4,500 to 3,300 (27% reduction).

Resolves: /later #3
```

### Why This Matters

**Traceable Decision History:**
```bash
# View all commits related to deferred item #3
git log --grep="later #3"

# View decision context
/later show 3

# Understand WHY the code changed
# (Not just WHAT changed)
```

**Example Audit Trail:**
```
2025-10-31  User defers "Optimize CLAUDE.md" with context
            ↓
2025-11-15  User converts to todos: /later do 3
            ↓
2025-11-15  Multiple commits with "Resolves: /later #3"
            ↓
2025-11-15  User marks item done: /later done 3
            ↓
Future      Code reviewer sees commit message
            Git log → /later #3 → Full decision context
```

### Git Hooks Integration

**Pre-commit hook:** Suggest deferred items related to changed files.

```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit

# Get changed files
CHANGED_FILES=$(git diff --cached --name-only)

# Search deferred items mentioning these files
for file in $CHANGED_FILES; do
  RELATED=$(later search "$file" --format=ids)

  if [[ -n "$RELATED" ]]; then
    echo "ℹ️  Related deferred items: $RELATED"
    echo "   Consider adding: Resolves: /later #N"
  fi
done
```

**Commit-msg hook:** Validate `/later #N` references exist.

```bash
#!/usr/bin/env bash
# .git/hooks/commit-msg

COMMIT_MSG=$(cat "$1")

# Extract /later references
LATER_REFS=$(echo "$COMMIT_MSG" | grep -oP 'later #\K\d+')

# Validate each reference exists
for ref in $LATER_REFS; do
  if ! /later show "$ref" &>/dev/null; then
    echo "❌ Error: /later #$ref does not exist" >&2
    exit 1
  fi
done
```

### Advanced: Automatic Issue Closing

**GitHub/GitLab integration:**

When commit message includes `Resolves: /later #3`, automatically:
1. Mark item as "done" in local database
2. Create GitHub issue comment with decision context
3. Link commit SHA to deferred item

**Example:**
```bash
# In commit message
Resolves: /later #3

# Auto-triggers:
later done 3 --commit-sha abc123ef

# Updates item:
{
  "id": 3,
  "status": "done",
  "resolved_by": "abc123ef",
  "resolved_at": "2025-10-31T16:45:00Z"
}
```

## 3. PHILOSOPHY.md Integration

**Purpose:** `/later` is a **living example** of Apple-style design philosophy.

**How it demonstrates each layer:**

### Layer 1: Simple Interface

**Principle:** "Make it simple on the surface."

**Implementation:**
```bash
/later "Title"          # One command captures everything
/later list             # Zero-config, just works
/later do 3             # Convert to action
```

**No Required Args:**
- Category? Auto-detected
- Priority? Defaults to medium
- Context? Auto-extracted
- Tags? Suggested based on content

### Layer 2: Hidden Orchestration

**Principle:** "Complex coordination happens invisibly."

**Implementation:**
- AI extracts context summary (200-500 words)
- Fuzzy matching detects duplicates
- Auto-categorization by keywords
- Performance monitoring (offer migration when slow)

**User sees:** Simple capture
**System does:** 8-step orchestration

### Layer 3: Robust Implementation

**Principle:** "Build for edge cases, corruption, scale."

**Implementation:**
- File locking (concurrent access)
- Atomic writes (corruption prevention)
- JSONL → SQLite migration (scale)
- Dependency cycle detection (graph validation)

**User sees:** It just works
**System does:** Defense in depth

### Layer 4: Magical Recovery

**Principle:** "Make mistakes reversible, data recoverable."

**Implementation:**
- `/later rollback` - Undo last operation
- `/later export` - Full JSONL backup
- `/later archive` - Never delete, just hide
- Auto-backups before risky operations

**User sees:** Confidence to experiment
**System does:** Automatic safety nets

### Documentation Reference

**In PHILOSOPHY.md:**
```markdown
## Real-World Examples

### /later - Deferred Decision Management

Demonstrates all 4 layers:

**Layer 1:** `/later "title"` - Simple capture
**Layer 2:** AI context extraction, duplicate detection
**Layer 3:** JSONL → SQLite scaling, file locking
**Layer 4:** Backups, export, archive, rollback

**Key Insight:** User doesn't know or care about SQLite migration.
System measures performance, offers migration when needed.
Migration is atomic, safe, reversible.

This is progressive enhancement done right.
```

## 4. Claude API Integration

**Purpose:** Use Claude for intelligent context extraction and categorization.

**API Calls:**

### Context Extraction

**Prompt:**
```
You are summarizing a conversation for later review.

Conversation History:
[Last 20 messages]

User wants to defer this decision: "{title}"

Provide a 200-500 word summary covering:
1. What decision is being deferred
2. Options considered (if any)
3. Pros/cons discussed
4. Recommendation made (if any)
5. Why it was deferred (timing, uncertainty, etc.)

Keep it concise but comprehensive. Focus on decision-relevant information.
```

**Response Format:**
```json
{
  "summary": "The user is considering optimizing CLAUDE.md...",
  "options": [
    "Hybrid approach (move examples to skills)",
    "Minimal approach (rules only)",
    "Keep as-is"
  ],
  "recommendation": "Hybrid approach balances clarity with token efficiency",
  "key_considerations": [
    "Current size: 3,343 words (~4,500 tokens)",
    "Anthropic guidelines: 1,000-5,000 tokens ideal",
    "Trade-off: Simplicity vs completeness"
  ]
}
```

### Auto-Categorization

**Prompt:**
```
Given this deferred decision title and context, suggest 1-3 categories:

Title: "{title}"
Context: "{summary}"

Existing categories in system: {existing_categories}

Suggest categories from existing list OR create new ones if needed.
Use hierarchical format (e.g., optimization:performance).

Return JSON:
{
  "categories": ["category1", "category2"],
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}
```

### Breakdown Suggestion (for TodoWrite)

**Prompt:**
```
Break down this deferred decision into 3-8 actionable steps:

Title: "{title}"
Context: "{summary}"
Options: {options}
Recommendation: "{recommendation}"

Create a logical sequence of steps to implement the decision.
Each step should be:
- Concrete (specific action)
- Testable (know when it's done)
- Sequential (logical order)

Return JSON:
{
  "steps": [
    {"action": "Analyze current structure", "estimated_time": "15m"},
    {"action": "Identify examples to extract", "estimated_time": "30m"},
    ...
  ]
}
```

### API Usage Optimization

**Caching Strategy:**
- Cache conversation context for 5 minutes
- If multiple captures in same session, reuse context
- Only call API for new information

**Fallback Strategy:**
- If API unavailable, use local extraction (last 10 messages)
- If API fails, prompt user for manual context
- Never block capture due to API issues

**Cost Management:**
- Context extraction: ~500 tokens input, ~300 tokens output
- Per capture cost: ~$0.0012 (Haiku 4.5)
- Budget: Acceptable for personal use

## 5. Future Integration Possibilities

### MCP (Model Context Protocol)

**Concept:** Expose `/later` as MCP server for other tools.

**Operations:**
```json
{
  "capture": "Create deferred item",
  "list": "Query deferred items",
  "show": "Get item details",
  "search": "Full-text search"
}
```

**Use Case:** Other AI tools can defer decisions to your system.

### Calendar Integration

**Concept:** Schedule reviews of deferred items.

**Flow:**
```bash
/later schedule 3 --review-in 30d

# Creates calendar event:
# "Review deferred decision: Optimize CLAUDE.md"
# With link to: /later show 3
```

### Slack/Discord Notifications

**Concept:** Remind about old deferred items.

**Flow:**
```bash
# Weekly digest
Every Monday: "You have 5 deferred items > 90 days old"
Click to review: /later list --older-than 90d
```

### Web Dashboard

**Concept:** Visual interface for managing deferred items.

**Features:**
- Timeline view (when decisions were made)
- Dependency graph visualization
- Category distribution charts
- Search with filters

**Implementation:** Read-only static site generated from JSONL export.

## Integration Testing

**Verify each integration:**

```bash
# TodoWrite integration
/later do 3
# Expect: Todos created, item marked in_progress

# Git integration
git commit -m "fix: resolve issue
Resolves: /later #3"
# Expect: Item marked done, commit linked

# Claude API integration
/later "Test AI extraction"
# Expect: Summary generated, categories suggested

# Export integration
/later export --format jsonl
# Expect: Valid JSONL, all items present
```

## Related Documents

- **[System Design](system-design.md)** - Overall architecture
- **[Storage Mechanism](../decisions/storage-mechanism.md)** - JSONL/SQLite backend
- **[Context Extraction](../../technical/implementation/context-extraction.md)** - AI prompts, fallbacks
- **[Apple-Style Philosophy](../../design/philosophy/apple-style-philosophy.md)** - 4-layer model

---

**Integration Status:** Designed, pending implementation
**Priority:** TodoWrite (P0), Git (P1), PHILOSOPHY.md (P1), Claude API (P0)
