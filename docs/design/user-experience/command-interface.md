# Command Interface Design

**Last Updated:** 2025-10-31
**Design Principle:** Simple commands, powerful options, consistent patterns

## Design Philosophy

The command interface follows **Apple's progressive disclosure** principle:
- **Layer 1:** Simple usage works without reading docs
- **Layer 2:** Common options are discoverable (`--help`)
- **Layer 3:** Advanced features available when needed
- **Layer 4:** Expert shortcuts for power users

**Key Insight:** The tool should be **intuitive for first use** but **efficient for frequent use**.

## Core Commands

### 1. `/later` (Capture)

**Simplest form:**
```bash
/later "Optimize CLAUDE.md size"
```

**With options:**
```bash
/later "Optimize CLAUDE.md size" --category optimization --priority high
```

**Full syntax:**
```bash
/later <title> [options]

Options:
  --category, -c <category>    Category (comma-separated for multiple)
  --priority, -p <level>       Priority: low|medium|high (default: medium)
  --tags, -t <tags>           Tags (comma-separated)
  --no-context                Skip AI context extraction
  --force                     Skip duplicate detection
  --depends-on <id>           Mark as dependent on item #N

Examples:
  /later "Refactor to plugin"
  /later "Optimize database" --category optimization:performance --priority high
  /later "Fix auth bug" --tags security,authentication --depends-on 15
```

**Design Rationale:**
- **Title is positional** - Most common argument, no flag needed
- **Options are optional** - Defaults work for 90% of cases
- **Long and short flags** - `--category` or `-c` (convenience)
- **Comma-separated multi-values** - `--tags foo,bar,baz` (no spaces needed)

### 2. `/later list` (Browse)

**Simplest form:**
```bash
/later list
```

**Output:**
```
Deferred Items (12 total)

[1] Optimize CLAUDE.md size                    optimization    180d  medium
[2] Refactor to plugin structure               refactor         90d  high
[3] Add dependency tracking                    feature          45d  low
[12] Review security audit                     security          2d  high

Show details: /later show <id>
Filter: /later list --category <category>
```

**With filters:**
```bash
/later list --category optimization
/later list --priority high
/later list --status deferred
/later list --older-than 90d
/later list --tags security
```

**Full syntax:**
```bash
/later list [options]

Options:
  --category, -c <category>    Filter by category (prefix match)
  --priority, -p <level>       Filter by priority
  --status, -s <status>        Filter by status: deferred|in_progress|done
  --older-than <days>          Only items older than N days
  --newer-than <days>          Only items newer than N days
  --tags, -t <tags>           Filter by tags (any match)
  --limit, -n <count>          Limit results (default: 20)
  --sort <field>               Sort by: date|priority|title (default: date)
  --format <format>            Output format: table|json|ids

Examples:
  /later list                                    # Recent 20 items
  /later list --category optimization            # All optimization items
  /later list --priority high --status deferred  # High priority, not started
  /later list --older-than 180d                  # Items > 6 months old
  /later list --tags security,authentication     # Security-related
  /later list --format json                      # JSON output (for scripting)
```

**Design Rationale:**
- **Zero-config default** - `list` shows most relevant items
- **Composable filters** - Combine multiple filters (AND logic)
- **Multiple output formats** - Human (table) or machine (JSON)
- **Smart defaults** - Sort by date DESC (most recent first)

### 3. `/later show` (Details)

**Simplest form:**
```bash
/later show 3
```

**Output:**
```
────────────────────────────────────────────────────────────
Item #3: Optimize CLAUDE.md size
────────────────────────────────────────────────────────────

Status:       deferred
Category:     optimization, decision
Tags:         claude-md, documentation, token-efficiency
Priority:     medium
Captured:     2025-10-31 (180 days ago)
Updated:      2025-11-15 (165 days ago)

Context:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User asked about CLAUDE.md token count. Currently 3,343 words
(~4,500 tokens). Anthropic guidelines suggest 1,000-5,000 tokens.

Options considered:
1. Hybrid: Move examples to separate skill files
2. Minimal: Keep only core rules, remove examples
3. Keep as-is: Accept current size

Recommendation: Hybrid approach
- Balances clarity with token efficiency
- Examples still accessible via skills
- Reduces size by ~25-30%

User decided to defer for later review.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Links:
  Conversation: https://claude.ai/chat/abc123...
  Related items: #5 (skill file organization)
  Depends on: None
  Blocks: None

Actions:
  Convert to todos: /later do 3
  Mark as done: /later done 3
  Edit: /later edit 3
  Archive: /later archive 3
────────────────────────────────────────────────────────────
```

**Full syntax:**
```bash
/later show <id> [options]

Options:
  --format <format>    Output format: full|summary|json
  --no-context        Hide context (show metadata only)

Examples:
  /later show 3                # Full details
  /later show 3 --format json  # Machine-readable
  /later show 3 --no-context   # Metadata only
```

**Design Rationale:**
- **ID is required** - Clear what you're viewing
- **Rich default output** - All relevant info visible
- **Visual separators** - Unicode box drawing for clarity
- **Actionable next steps** - Show available commands at bottom

### 4. `/later search` (Find)

**Simplest form:**
```bash
/later search "optimization"
```

**Output:**
```
Search: "optimization" (3 results)

[1] Optimize CLAUDE.md size                    optimization    180d  medium
    Context: ...User asked about CLAUDE.md token count...
    Match: title, category

[3] Database query optimization                optimization    120d  high
    Context: ...Slow queries on large datasets...
    Match: title, context

[7] Memory optimization for image processing   optimization     30d  low
    Context: ...Images taking 500MB+ RAM...
    Match: title, tags

Refine: /later search "optimization" --category performance
Show: /later show <id>
```

**Full syntax:**
```bash
/later search <query> [options]

Options:
  --category, -c <category>    Limit to category
  --priority, -p <level>       Limit to priority
  --status, -s <status>        Limit to status
  --tags, -t <tags>           Limit to tags
  --limit, -n <count>          Max results (default: 20)
  --format <format>            Output format: ranked|json|ids

Search behavior:
  - Searches: title, context, tags, categories
  - Ranks by relevance (title matches > context matches)
  - Highlights matching terms
  - Case-insensitive
  - Supports phrases: "exact phrase"

Examples:
  /later search "database"                      # All mentions
  /later search "optimization" --category perf  # Specific category
  /later search "security" --priority high      # High-priority security items
```

**Design Rationale:**
- **Natural language query** - Type what you remember
- **Ranked results** - Most relevant first (not chronological)
- **Match highlighting** - See why it matched
- **Refinement suggestions** - Guide to better results

### 5. `/later do` (Convert to Action)

**Simplest form:**
```bash
/later do 3
```

**Interactive flow:**
```
Item #3: Optimize CLAUDE.md size

Suggested breakdown:
  1. Analyze current CLAUDE.md structure
  2. Identify examples to move to skills
  3. Create new skill files
  4. Update CLAUDE.md with skill references
  5. Test skill loading
  6. Compare token counts

Proceed with this breakdown? [Y/n/edit]
```

**User types:** `Y`

```
✅ Created 6 todos from /later #3
🔄 Item #3 marked as "in_progress"

View todos: (displayed in todo list)
```

**Full syntax:**
```bash
/later do <id> [options]

Options:
  --no-breakdown    Create single todo (skip breakdown)
  --manual          Skip AI breakdown, provide manual steps

Examples:
  /later do 3                  # AI-powered breakdown
  /later do 3 --no-breakdown   # Single todo with full context
  /later do 3 --manual         # Manual step entry
```

**Design Rationale:**
- **AI assistance by default** - Suggest intelligent breakdown
- **User confirmation** - Show plan before executing
- **Manual fallback** - AI not required
- **Bidirectional linking** - Todos ↔ deferred item

### 6. `/later done` (Mark Complete)

**Simplest form:**
```bash
/later done 3
```

**Output:**
```
✅ Item #3 marked as done
📊 Stats:
   - Deferred on: 2025-10-31
   - Completed on: 2025-11-15
   - Duration: 15 days
   - Todos created: 6
   - All todos completed

Archive item? [Y/n]
```

**Full syntax:**
```bash
/later done <id> [options]

Options:
  --no-archive    Mark done but keep in active list
  --notes <text>  Add completion notes

Examples:
  /later done 3
  /later done 3 --notes "Used hybrid approach, saved 1,200 tokens"
```

**Design Rationale:**
- **Completion tracking** - Measure how long decisions take
- **Auto-archive offer** - Keep active list clean
- **Optional notes** - Capture outcome for future reference

### 7. `/later edit` (Modify)

**Simplest form:**
```bash
/later edit 3
```

**Interactive editor:**
```
Editing Item #3

Title: Optimize CLAUDE.md size
Category (current: optimization, decision): [Enter to keep, or new value]
Priority (current: medium): [low/medium/high]
Tags (current: claude-md, documentation): [comma-separated]
Status (current: deferred): [deferred/in_progress/done]

Save changes? [Y/n]
```

**Quick edit:**
```bash
/later edit 3 --priority high
/later edit 3 --add-tag performance
/later edit 3 --category optimization:performance
```

**Full syntax:**
```bash
/later edit <id> [options]

Options:
  --title <text>          Change title
  --category <category>   Change category
  --priority <level>      Change priority
  --add-tag <tag>         Add tag (keeps existing)
  --remove-tag <tag>      Remove tag
  --status <status>       Change status
  --refresh-context       Re-extract context from conversation

Examples:
  /later edit 3                           # Interactive editor
  /later edit 3 --priority high           # Quick priority change
  /later edit 3 --add-tag security        # Add tag
  /later edit 3 --refresh-context         # Update stale context
```

**Design Rationale:**
- **Interactive default** - Show current values, easy to modify
- **Quick edits** - Common changes via flags (no editor)
- **Additive operations** - `--add-tag` doesn't replace, adds
- **Context refresh** - Handle stale context gracefully

### 8. `/later archive` (Bulk Archive)

**Simplest form:**
```bash
/later archive --older-than 365d
```

**Output:**
```
Archive candidates: 8 items older than 365 days

[3]  Optimize CLAUDE.md size      done        380d  medium
[7]  Database migration plan       done        400d  high
[12] Refactor authentication       abandoned   370d  medium
...

Preview shows 8 items. Proceed with archive? [Y/n]
```

**Full syntax:**
```bash
/later archive [options]

Options:
  --older-than <days>    Archive items older than N days
  --status <status>      Only archive items with status
  --force               Skip confirmation
  <id>                  Archive specific item by ID

Examples:
  /later archive --older-than 365d              # Archive old items
  /later archive --older-than 180d --status done # Archive completed
  /later archive 3                              # Archive specific item
```

**Design Rationale:**
- **Bulk operations** - Clean up old items efficiently
- **Preview before action** - Show what will be archived
- **Non-destructive** - Archive, don't delete (reversible)
- **Selective filters** - Only archive what you want

### 9. `/later export` (Backup)

**Simplest form:**
```bash
/later export
```

**Output:**
```
Exported 45 items to: ~/.later/exports/deferred-20251031.jsonl
Format: JSONL (JSON Lines)
Size: 250 KB

Import with: /later import <file>
```

**Full syntax:**
```bash
/later export [options]

Options:
  --format <format>      Format: jsonl|json|csv (default: jsonl)
  --output <file>        Custom output path
  --status <status>      Only export items with status
  --category <category>  Only export category
  --no-context          Exclude context (smaller file)

Examples:
  /later export                              # Full backup (JSONL)
  /later export --format json                # Single JSON file
  /later export --format csv --no-context    # CSV for spreadsheet
  /later export --output backup.jsonl        # Custom path
```

**Design Rationale:**
- **Default is JSONL** - Best for long-term storage
- **Multiple formats** - Choose based on use case
- **Selective export** - Backup specific subsets
- **Portability** - Plain text formats work everywhere

### 10. `/later migrate-to-sqlite` (Scale)

**Triggered automatically:**
```
⚠️  Performance Notice
You have 520 deferred items. Search performance is degrading.

Migrate to SQLite for instant search? (< 10ms vs current 650ms)
✅ Safe (keeps JSONL backup)
✅ Automatic (no manual work)
✅ Reversible (can export back to JSONL)

Migrate now? [Y/n]
```

**Manual trigger:**
```bash
/later migrate-to-sqlite
```

**Full syntax:**
```bash
/later migrate-to-sqlite [options]

Options:
  --force          Skip confirmation
  --backup-path    Custom backup location

Post-migration:
  - JSONL backup: ~/.later/deferred.jsonl.backup-TIMESTAMP
  - SQLite database: ~/.later/deferred.db
  - Flag file: ~/.later/.using-sqlite

Examples:
  /later migrate-to-sqlite                 # Interactive migration
  /later migrate-to-sqlite --force         # Skip confirmation
```

**Design Rationale:**
- **Automatic offer** - System suggests when beneficial
- **User confirmation** - Explain benefits clearly
- **Non-destructive** - Always keep JSONL backup
- **Transparent** - User experience unchanged after migration

## Command Conventions

### Consistent Patterns

**ID references:**
- Always use `#N` format in output
- Accept `N` or `#N` as input
- Example: `/later show 3` or `/later show #3` (both work)

**Multi-value options:**
- Comma-separated, no spaces: `--tags foo,bar,baz`
- Quoted if spaces needed: `--tags "foo bar,baz"`

**Boolean flags:**
- Presence = true: `--force`
- No `--no-force` needed (absence = false)

**Date/time inputs:**
- Natural language: `--older-than 90d`, `--newer-than 1w`
- Absolute: `--after 2025-01-01`, `--before 2025-12-31`

**Output formats:**
- Human-readable by default (tables, colors)
- Machine-readable on request (`--format json`)
- Scriptable (`--format ids` returns just IDs)

### Error Messages

**Principle:** Be helpful, not just accurate.

**Bad:**
```
Error: Invalid ID
```

**Good:**
```
Error: Item #99 does not exist

Did you mean:
  #9  (Database optimization)
  #19 (Security audit)

List all: /later list
Search: /later search <query>
```

**Missing required args:**
```bash
/later
```

**Output:**
```
Error: Missing title

Usage: /later <title> [options]

Examples:
  /later "Optimize database queries"
  /later "Refactor auth system" --priority high

See: /later --help
```

### Help System

**Command-level help:**
```bash
/later --help
/later list --help
/later do --help
```

**Global help:**
```bash
/later help                 # Overview of all commands
/later help capture         # Detailed help for capture
/later help examples        # Common workflows
```

**Contextual help:**
- Show related commands after each operation
- Suggest next steps in output
- Link to relevant docs

## Related Documents

- **[Progressive Disclosure](progressive-disclosure.md)** - Simple → Advanced
- **[Error Handling](error-handling.md)** - User-friendly errors
- **[Naming Conventions](../philosophy/naming-conventions.md)** - Command naming rationale

---

**Design Status:** Complete, ready for implementation
**Key Principle:** Make simple things simple, complex things possible
