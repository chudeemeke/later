# Error Handling: User-Friendly Recovery

**Last Updated:** 2025-10-31
**Design Principle:** Errors should teach, not punish

## Philosophy

**Traditional error handling:**
```
Error: ENOENT
Exit code: 127
```

**Our error handling:**
```
Error: Item #15 does not exist

Did you mean:
  #5  (Database optimization)
  #51 (Security audit)

See all items: /later list
Search by title: /later search <query>
```

**Key differences:**
- **Explain what went wrong** (not just error code)
- **Suggest what to do next** (actionable recovery)
- **Anticipate user intent** (fuzzy matching, "did you mean")
- **Link to relevant commands** (guide to success)

## Error Categories

### 1. User Input Errors

**Cause:** User provided invalid or missing input.

**Principle:** Validate early, guide immediately.

#### Missing Required Arguments

**Bad:**
```
Error: Missing argument
Usage: /later <title>
```

**Good:**
```
Error: Missing title

Capture a deferred decision:
  /later "Optimize database queries"

Include options:
  /later "Refactor auth" --priority high --category refactor

See more: /later help capture
```

**Why better:**
- Shows correct usage
- Provides concrete examples
- Links to more help

#### Invalid Values

**Bad:**
```
Error: Invalid priority
```

**Good:**
```
Error: Invalid priority "urgent"

Valid priorities:
  low     - Can wait indefinitely
  medium  - Should do eventually (default)
  high    - Should do soon

Example:
  /later edit 3 --priority high
```

**Why better:**
- Lists valid options
- Explains what each means
- Shows correct syntax

#### Malformed Input

**Bad:**
```
Error: Parse error at position 42
```

**Good:**
```
Error: Title contains invalid characters: <, >

Titles should be plain text without special symbols.

Did you mean:
  /later "Optimize CLAUDE.md"

Instead of:
  /later "<title>"  # Don't include < > literally
```

**Why better:**
- Identifies specific problem
- Explains constraint
- Shows correct alternative

### 2. Not Found Errors

**Cause:** User references something that doesn't exist.

**Principle:** Don't just say "no", suggest alternatives.

#### Item Not Found

**Bad:**
```
Error: Item not found
```

**Good:**
```
Error: Item #99 does not exist

Did you mean one of these?
  #9  (Optimize database queries)      90d ago
  #19 (Security audit review)          45d ago
  #29 (Refactor authentication)        30d ago

Or search by title:
  /later search <keyword>

Or list all items:
  /later list
```

**Implementation:**
```bash
handle_not_found() {
  local id="$1"

  echo "Error: Item #$id does not exist" >&2
  echo >&2

  # Find similar IDs (Levenshtein distance)
  similar=$(find_similar_ids "$id")

  if [[ -n "$similar" ]]; then
    echo "Did you mean one of these?" >&2
    echo "$similar" | while read similar_id; do
      title=$(get_item_title "$similar_id")
      age=$(get_item_age "$similar_id")
      echo "  #$similar_id ($title) $age ago" >&2
    done
    echo >&2
  fi

  echo "Or search by title:" >&2
  echo "  /later search <keyword>" >&2
  echo >&2
  echo "Or list all items:" >&2
  echo "  /later list" >&2

  return 1
}
```

#### Empty Results

**Bad:**
```
No results found
```

**Good:**
```
No items found matching: --category optimization --priority high

Suggestions:
  ✓ Remove filters to see more results:
    /later list --category optimization

  ✓ Search instead of filter:
    /later search "optimization"

  ✓ Check spelling:
    Did you mean "optimisation"?

  ✓ List available categories:
    /later list --format json | jq -r '.[] | .categories[]' | sort -u
```

**Why better:**
- Acknowledges the search wasn't wrong
- Offers multiple recovery paths
- Teaches alternative approaches

### 3. State Errors

**Cause:** Operation invalid given current state.

**Principle:** Explain why, show valid transitions.

#### Already Done

**Bad:**
```
Error: Cannot mark as done (already done)
```

**Good:**
```
Item #3 is already marked as done (completed 2025-10-31)

Options:
  [V]iew completion details: /later show 3
  [U]ndo (mark as deferred): /later edit 3 --status deferred
  [A]rchive: /later archive 3
  [C]ancel

Choice: _
```

**Why better:**
- Shows current state
- Offers valid next actions
- Makes undo obvious

#### Circular Dependency

**Bad:**
```
Error: Circular dependency detected
```

**Good:**
```
Error: Cannot add dependency #5 → #3

This creates a circular dependency:
  #3 depends on #5
  #5 depends on #12
  #12 depends on #3  ← Creates cycle

Dependency chains must be acyclic (no loops).

To fix:
  1. Remove existing dependency: /later edit 12 --remove-depends-on 3
  2. Or choose different dependency for #5

View dependency graph:
  /later show 3 --deps
```

**Why better:**
- Visualizes the problem
- Explains constraint (acyclic)
- Offers specific solutions

### 4. System Errors

**Cause:** File I/O, permissions, resource limits.

**Principle:** Distinguish user error from system error.

#### Disk Full

**Bad:**
```
Error: No space left on device
```

**Good:**
```
Error: Cannot save item (disk full)

Your deferred item has been saved to emergency backup:
  ~/.later/emergency-backup.jsonl

To recover:
  1. Free up disk space
  2. Import backup: /later import ~/.later/emergency-backup.jsonl

Current disk usage:
  / (root): 95% full (need 5MB for operation)

Clean up old archives:
  /later archive --older-than 365d --force
```

**Why better:**
- Item not lost (emergency backup)
- Clear recovery steps
- Actionable suggestions (archive old items)

#### Permission Denied

**Bad:**
```
Error: Permission denied
```

**Good:**
```
Error: Cannot write to ~/.later/deferred.jsonl (permission denied)

This usually means file permissions are incorrect.

Quick fix:
  chmod 600 ~/.later/deferred.jsonl
  chmod 700 ~/.later/

If that doesn't work:
  ls -la ~/.later/  # Check ownership
  # Should be owned by: <your username>

Need help? See:
  /later help troubleshooting
```

**Why better:**
- Explains likely cause
- Provides exact fix commands
- Links to detailed troubleshooting

#### File Corruption

**Bad:**
```
Error: Invalid JSON
```

**Good:**
```
Error: Data file is corrupted (line 42: invalid JSON)

Don't panic! Your data is likely recoverable.

Automatic recovery attempt:
  1. Loading last good backup...
  2. Found: ~/.later/backups/deferred-20251030-140523.jsonl
  3. Backup contains 44 items (1 day old)

Options:
  [R]estore from backup (recommended)
  [M]anual repair (for experts)
  [E]xport damaged file for inspection
  [C]ancel

Choice: _
```

**Why better:**
- Reduces panic (data recoverable)
- Shows automatic backup found
- Offers guided recovery

### 5. Integration Errors

**Cause:** External dependencies (TodoWrite, Claude API, Git).

**Principle:** Degrade gracefully, offer alternatives.

#### TodoWrite Unavailable

**Bad:**
```
Error: TodoWrite failed
```

**Good:**
```
Warning: TodoWrite is not available

Item #3 remains in "deferred" state.

Alternatives:
  ✓ Create todos manually (copy context from item)
  ✓ Export item to markdown: /later show 3 --format md > todo.md
  ✓ Retry later: /later do 3

Export context now? [Y/n]
```

**Why better:**
- Doesn't block user
- Offers practical alternatives
- Explains state (item unchanged)

#### AI Context Extraction Failed

**Bad:**
```
Error: Claude API error
```

**Good:**
```
Warning: AI context extraction unavailable (Claude API timeout)

Fallback options:
  [L]ast 10 messages (quick, automatic)
  [M]anual context entry
  [S]kip context (capture title only)

Recommendation: Use last 10 messages (press Enter)

Choice [L]: _
```

**Why better:**
- Degrades gracefully
- Offers immediate fallback
- Recommends default action

### 6. Validation Errors

**Cause:** Data doesn't meet constraints.

**Principle:** Explain the constraint, show how to satisfy it.

#### Title Too Long

**Bad:**
```
Error: Title exceeds maximum length
```

**Good:**
```
Error: Title is too long (312 characters, max 200)

Current title:
  "Optimize CLAUDE.md by extracting examples into separate
   skill files while maintaining clarity and ensuring that..."

Suggestions:
  ✓ Shorten to core idea:
    "Optimize CLAUDE.md by extracting examples to skills"

  ✓ Put details in context (automatic), not title

  ✓ Use tags for specifics:
    --tags "examples,skills,optimization"

Try again: /later <shortened title>
```

**Why better:**
- Shows actual vs limit
- Provides concrete rewrite suggestion
- Explains where details belong

#### Invalid Characters

**Bad:**
```
Error: Invalid character in title
```

**Good:**
```
Error: Title contains shell metacharacters: $ ( )

These characters can cause issues in shell scripts.

Your title:
  "Calculate $(cost * users) per month"

Suggested fix:
  "Calculate cost per user per month"

Or escape manually:
  /later 'Calculate \$(cost * users) per month'

Note: Context field allows any characters (it's quoted).
```

**Why better:**
- Identifies specific characters
- Explains why they're problematic
- Shows both sanitized and escaped options

## Error Message Template

**Standard structure:**

```
[Level]: [What went wrong]

[Why this happened / Current state]

[Options for recovery]
  ✓ Option 1 (recommended)
  ✓ Option 2
  ✓ Option 3

[Related commands / See also]
```

**Example implementation:**

```bash
error_template() {
  local level="$1"      # Error|Warning|Info
  local what="$2"       # What went wrong
  local why="$3"        # Why it happened
  local options="$4"    # Recovery options (array)
  local see_also="$5"   # Related commands

  echo "$level: $what" >&2
  echo >&2

  if [[ -n "$why" ]]; then
    echo "$why" >&2
    echo >&2
  fi

  if [[ -n "$options" ]]; then
    echo "Options:" >&2
    echo "$options" | while IFS= read -r option; do
      echo "  ✓ $option" >&2
    done
    echo >&2
  fi

  if [[ -n "$see_also" ]]; then
    echo "See also:" >&2
    echo "  $see_also" >&2
  fi
}

# Usage
error_template \
  "Error" \
  "Item #99 does not exist" \
  "You may have the wrong ID or the item was archived." \
  "Search by title: /later search <keyword>
List all items: /later list
View archived: /later list --archived" \
  "/later help"
```

## Exit Codes

**Standard Unix convention:**

```bash
0   Success
1   General error
2   Misuse of command (invalid arguments)
64  Input data invalid
65  Input file missing
66  Output file error
69  Service unavailable (API, TodoWrite)
73  Can't create output file
74  I/O error
75  Temporary failure (retry may succeed)
77  Permission denied
```

**Usage in scripts:**

```bash
# Check if item exists before proceeding
if ! later show 3 &>/dev/null; then
  echo "Item #3 not found, skipping"
  exit 0  # Not an error for script, item just doesn't exist
fi

# Capture must succeed
if ! later "New decision"; then
  echo "Failed to capture, aborting deployment"
  exit 1
fi
```

## Recovery Mechanisms

### Automatic Recovery

**Built-in safeguards:**

1. **Emergency backup on write failure**
   - Write to `.later/emergency-backup.jsonl`
   - Warn user, show recovery command

2. **Automatic rollback on corruption**
   - Detect corrupted file on load
   - Offer restore from last backup
   - Show backup timestamp, item count

3. **Graceful degradation**
   - AI unavailable → use simple extraction
   - SQLite unavailable → fallback to JSONL
   - TodoWrite unavailable → export markdown

### Manual Recovery

**User-initiated fixes:**

```bash
# Rollback last operation
/later rollback

# Restore from specific backup
/later restore --backup ~/.later/backups/deferred-20251030.jsonl

# Repair corrupted file
/later repair
  # Attempts to salvage valid lines
  # Skips corrupted entries
  # Reports what was lost

# Force re-index (SQLite only)
/later migrate-to-sqlite --rebuild-index

# Reset to clean state (nuclear option)
/later init --reset
  # Offers to backup first
  # Clears current data
  # Starts fresh
```

## Testing Error Handling

**Test scenarios:**

1. **Invalid inputs**
   - Missing arguments
   - Invalid values
   - Malformed data
   - Out-of-range numbers

2. **Not found cases**
   - Non-existent item IDs
   - Empty search results
   - Missing files

3. **State conflicts**
   - Already done items
   - Circular dependencies
   - Conflicting edits

4. **System failures**
   - Disk full
   - Permission denied
   - File corruption
   - Network timeout

5. **Integration failures**
   - TodoWrite unavailable
   - Claude API down
   - Git not installed

**Success criteria:**
- User understands what went wrong
- User knows how to recover
- No data loss (emergency backup works)
- Graceful degradation (no complete failure)

## Related Documents

- **[Command Interface](command-interface.md)** - Command design
- **[Progressive Disclosure](progressive-disclosure.md)** - Revealing complexity
- **[Recovery Mechanisms](../../technical/implementation/recovery-mechanisms.md)** - Technical details

---

**Design Status:** Complete, ready for implementation
**Key Principle:** Errors should guide users to success, not frustrate them
