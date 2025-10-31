# Progressive Disclosure in /later

**Last Updated:** 2025-10-31
**Design Principle:** Show users only what they need, when they need it

## What is Progressive Disclosure?

**Definition:** A design pattern that reveals complexity gradually, starting with simple defaults and exposing advanced features only when users need them.

**Why it matters:** Users shouldn't have to understand SQLite, dependency graphs, or fuzzy matching algorithms to capture a simple decision. But power users shouldn't be limited by simplified interfaces.

**The /later approach:** 4 levels of disclosure, each building on the previous.

## Level 1: First-Time User (Zero Configuration)

**Goal:** Capture first decision in < 30 seconds without reading docs.

### The Simplest Possible Interaction

```bash
User: /later "Optimize CLAUDE.md size"

System: ✅ Captured as item #1
```

**What the user sees:**
- Single command
- Immediate success feedback
- No configuration required
- No decisions to make

**What the system does invisibly:**
- Auto-generates ID (1)
- Extracts context from conversation
- Assigns default priority (medium)
- Auto-categorizes (decision, optimization)
- Stores to JSONL file
- Creates backup
- Links to conversation

**User cognitive load:** Minimal - just remember `/later "title"`

### Viewing Items (Still Zero Config)

```bash
User: /later list

System:
Deferred Items (1 total)

[1] Optimize CLAUDE.md size    optimization    0d  medium

Show details: /later show 1
```

**What the user sees:**
- Clean list
- Basic info (title, category, age, priority)
- Hint for next action

**What they don't see yet:**
- Filters (`--category`, `--priority`)
- Search functionality
- Export options
- SQLite migration

**Why hide these:** Not needed yet. User has 1 item. Keep it simple.

## Level 2: Regular User (Discovery)

**Goal:** User discovers features as they naturally need them.

### Trigger: More Items Captured

After 5-10 captures:

```bash
User: /later list

System:
Deferred Items (8 total, showing recent 5)

[8] Review security audit          security       2d  high
[7] Optimize image processing      optimization   5d  low
[6] Refactor auth system          refactor       12d  high
[5] Add telemetry                 feature        15d  medium
[4] Database migration plan       architecture   20d  medium

See all: /later list --limit 20
Filter: /later list --category <category>
Search: /later search <query>
```

**What changed:**
- More items → system suggests filters
- "showing recent 5" → hints at pagination
- Related commands shown at bottom

**Progressive disclosure:** Filter options only mentioned when list is long enough to benefit from filtering.

### Trigger: Need to Find Something

```bash
User: /later list
# User scans 20 items, doesn't find what they want

System: (at bottom of list)
Can't find what you're looking for?
  Search: /later search <query>
  Filter: /later list --category <category>
  Sort: /later list --sort priority
```

**Contextual help:** Anticipate frustration, offer solutions.

### Trigger: Duplicate Capture

```bash
User: /later "Optimize CLAUDE.md"

System:
⚠️  Similar item already exists:
  [1] Optimize CLAUDE.md size (captured 30d ago)

Options:
  [U]pdate existing item with new context
  [C]reate new item anyway
  [V]iew existing item first
  [A]bort

Choice: _
```

**What the user learns:**
- System detects duplicates
- Updating existing items is possible
- They control the decision

**Progressive disclosure:** Duplicate detection only activates after enough items exist to make collisions likely.

## Level 3: Power User (Efficiency)

**Goal:** Provide shortcuts and advanced features for frequent users.

### Discovered Through `--help`

```bash
User: /later --help

System:
/later - Deferred Decision Management

Common Commands:
  /later "<title>"           Capture decision
  /later list                List items
  /later show <id>           Show details
  /later search "<query>"    Search items
  /later do <id>             Convert to todos

Advanced Commands:
  /later edit <id>           Edit existing item
  /later archive             Archive old items
  /later export              Backup to JSONL

Quick Edits:
  /later edit <id> --priority high
  /later edit <id> --add-tag performance

Power Features:
  /later list --format json         # Machine-readable output
  /later search "query" --category  # Combined search + filter
  /later migrate-to-sqlite          # Scale to 10K+ items

See: /later help <command> for detailed usage
```

**Progressive disclosure:** Help system itself has layers (common → advanced → power).

### Quick Edits (No Interactive Prompts)

**Beginner way:**
```bash
/later edit 3
# Opens interactive editor
# Shows all fields with current values
# User navigates, edits, saves
```

**Power user way:**
```bash
/later edit 3 --priority high --add-tag security
# Instant, scriptable, composable
```

**Why both exist:**
- Interactive: Discoverable, safe, guided
- Flags: Fast, scriptable, combinable

### Bulk Operations

**Becomes visible when beneficial:**

After 50+ items:
```bash
User: /later list --status done

System:
Found 35 completed items.

Consider archiving old items to keep list clean:
  /later archive --older-than 180d --status done

This will move 28 items to archive (reversible).
```

**Progressive disclosure:** Bulk operations only suggested when they'd help.

## Level 4: Expert User (Automation)

**Goal:** Full control, scriptability, integration with other tools.

### Machine-Readable Output

```bash
# Get IDs of high-priority deferred items
ITEMS=$(later list --priority high --status deferred --format ids)

# Loop through and convert to todos
for id in $ITEMS; do
  later do $id --no-breakdown
done
```

**What's exposed:**
- JSON output (`--format json`)
- ID-only output (`--format ids`)
- Non-interactive modes (`--force`, `--no-breakdown`)
- Exit codes (0 = success, 1 = error)

### Direct Backend Access

**For debugging or advanced manipulation:**

```bash
# JSONL backend
cat ~/.later/deferred.jsonl | jq '.[] | select(.priority == "high")'

# SQLite backend (after migration)
sqlite3 ~/.later/deferred.db "SELECT * FROM deferred_items WHERE priority = 'high'"
```

**Progressive disclosure:** Documentation mentions backend formats, but users don't need to know them.

### Integration with Other Tools

**Git hooks:**
```bash
# .git/hooks/pre-commit
RELATED=$(later search "$(git diff --name-only)")
if [[ -n "$RELATED" ]]; then
  echo "Related deferred items: $RELATED"
fi
```

**CI/CD:**
```bash
# Check if any high-priority items are blocking release
later list --priority high --tags release-blocker --format json > blockers.json
if [[ $(jq 'length' blockers.json) -gt 0 ]]; then
  echo "Cannot release: high-priority items remain"
  exit 1
fi
```

**Progressive disclosure:** Integration capabilities exist but aren't prominently advertised (docs only).

## Disclosure Triggers (When to Show More)

### Automatic Triggers

**Item count thresholds:**
- 10 items → Suggest search
- 50 items → Suggest filters
- 100 items → Suggest categories/tags organization
- 500 items → Offer SQLite migration

**Performance thresholds:**
- Search > 500ms → "Search is slow, migrate to SQLite?"
- List > 100ms → "Try filters to reduce results"

**Usage patterns:**
- 3 captures in 10 minutes → "Use `--force` to skip duplicate checks"
- 5 edits of same item → "Consider breaking down into subtasks"
- 10 searches without filters → "Try category filters for faster results"

### User-Initiated Discovery

**Help system:**
```bash
/later help          # Overview
/later help capture  # Specific command
/later help advanced # Power features
/later help examples # Common workflows
```

**Error messages as teaching moments:**
```bash
User: /later show 99

System:
Error: Item #99 does not exist

Did you mean:
  #9  (Database optimization)
  #19 (Security audit)

Tip: Use /later search if you're not sure of the ID
```

## Comparison: Without vs With Progressive Disclosure

### Without Progressive Disclosure (All at Once)

**Hypothetical bad design:**
```bash
User: /later

System:
/later - Deferred Decision Management

Required:
  --title <text>              Decision title
  --backend <jsonl|sqlite>    Storage backend
  --id-strategy <auto|manual> ID assignment

Optional:
  --category <category>       Category (supports hierarchy with :)
  --priority <low|medium|high>
  --tags <tag,tag,tag>
  --context <text>            Or use --auto-extract-context
  --duplicate-check <fuzzy|exact|off>
  --fuzzy-threshold <0-100>   Levenshtein distance %
  --conversation-id <id>      For context extraction
  --backup-before-write       Default: true
  --atomic-writes            Default: true

See /later --help-advanced for 47 more options
```

**Problems:**
- Overwhelming (cognitive overload)
- Required options that should be automatic
- Exposes implementation details (Levenshtein?)
- No guidance on what's important

**User reaction:** "This is too complex, I'll just use notes."

### With Progressive Disclosure (Our Design)

**Our actual design:**
```bash
User: /later "Optimize CLAUDE.md size"

System: ✅ Captured as item #1

# That's it. Everything else is automatic.
```

**Benefits:**
- Immediate success
- No decisions required
- Can learn advanced features gradually
- Never blocked by complexity

**User reaction:** "This just works!"

## Design Patterns for Progressive Disclosure

### Pattern 1: Sane Defaults

**Principle:** Make the common case require zero configuration.

**Examples:**
- Priority defaults to `medium`
- Context auto-extracted (not required)
- Category auto-suggested
- Backend auto-selected (JSONL → SQLite when needed)
- Sort defaults to date DESC (most recent first)

### Pattern 2: Discoverable Options

**Principle:** Options are visible but not required.

**Examples:**
- `--help` shows all options
- Error messages suggest relevant options
- Output includes related commands
- Interactive modes show available choices

### Pattern 3: Graceful Degradation

**Principle:** Advanced features fail gracefully, falling back to simple alternatives.

**Examples:**
- AI context extraction fails → use last 10 messages
- Duplicate detection unavailable → skip check
- SQLite migration fails → rollback to JSONL
- Category auto-suggestion fails → prompt user

### Pattern 4: Contextual Guidance

**Principle:** Offer help at the moment it's relevant.

**Examples:**
- Long list → suggest filters
- Slow search → suggest migration
- Many edits → suggest breakdown
- Old items → suggest archive

### Pattern 5: Non-Blocking Enhancements

**Principle:** Advanced features are additive, not required.

**Examples:**
- Tags are optional (but helpful for search)
- Dependencies are optional (but helpful for ordering)
- Categories are optional (but helpful for filtering)
- Context is optional (but helpful for recall)

## Testing Progressive Disclosure

**Evaluation criteria:**

1. **First-time user test:** Can someone capture first decision in < 30 seconds?
2. **Discoverability test:** Can user find advanced features without reading full docs?
3. **Gradual learning test:** Does complexity reveal itself naturally over time?
4. **No dead-ends test:** Is every feature reachable from common starting points?
5. **Efficiency test:** Can power users bypass interactive modes?

**Success metrics:**
- Time to first successful capture: < 30s
- Commands before discovering search: < 10
- Time to SQLite migration offer: When actually beneficial
- Advanced feature usage: Correlates with item count

## Related Documents

- **[Command Interface](command-interface.md)** - Command design details
- **[Error Handling](error-handling.md)** - Errors as teaching moments
- **[Apple-Style Philosophy](../philosophy/apple-style-philosophy.md)** - 4-layer model

---

**Design Status:** Complete, ready for implementation
**Key Principle:** Simple by default, powerful when needed
