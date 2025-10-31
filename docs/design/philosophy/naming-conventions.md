# Naming Conventions: Why "later"

**Last Updated:** 2025-10-31
**Design Principle:** Names should reveal intent, not implementation

## Why "/later"?

### The Genesis

**Original problem statement:**
> "I'll leave it as is for now but I want to come back to visit if in the future and don't want to have to deal with trying to remember all the relevant issues, details, pros, cons, your recommendations, my inclinations, etc when I return."

**Key insight:** The user wants to defer a decision to **later**, not forget it or delete it or schedule it. Just... later.

### Name Candidates Considered

**1. /defer**
- ✅ Technically accurate
- ❌ Too formal, sounds bureaucratic
- ❌ "Defer" implies procrastination (negative connotation)
- ❌ Harder to say ("dee-fer" vs "lay-ter")

**2. /postpone**
- ❌ Too long (9 characters vs 5)
- ❌ Implies specific future time (we don't require scheduling)
- ❌ Sounds like avoiding the decision

**3. /wishlist**
- ❌ Implies desires, not decisions
- ❌ Associated with shopping/gifts (wrong metaphor)
- ❌ Too specific (not all deferred items are "wishes")

**4. /todolist**
- ❌ Conflicts with existing TodoWrite tool
- ❌ Implies immediate action (opposite of deferring)
- ❌ Two words mashed together (awkward)

**5. /planlist**
- ❌ Implies structured planning (too heavy)
- ❌ Not all deferred items are "plans" (some are questions)

**6. /backlog**
- ✅ Common in software development
- ❌ Agile-specific jargon (not universal)
- ❌ Implies work you *should* be doing (guilt)
- ❌ Associated with technical debt (negative)

**7. /later** ✅
- ✅ Simple, natural English word
- ✅ Conversational ("I'll do it later")
- ✅ No negative connotation
- ✅ Short (5 characters, easy to type)
- ✅ Clear intent: Not now, but not never
- ✅ Pronounceable in all languages (universal)
- ✅ No technical jargon

**Winner:** /later

**Rationale:** Matches how humans actually think and speak about deferring decisions.

## Command Naming Philosophy

### Principle 1: Use Natural Language Verbs

**Good examples:**
```bash
/later capture "Title"    # Natural: "capture a decision"
/later list               # Natural: "list the items"
/later show 3             # Natural: "show me item 3"
/later search "query"     # Natural: "search for query"
/later do 3               # Natural: "do item 3"
```

**Bad examples (what we avoided):**
```bash
/later add "Title"        # Too generic (add what?)
/later get 3              # Too technical (get vs show)
/later find "query"       # Ambiguous (find by ID? by text?)
/later execute 3          # Too formal (execute sounds like code)
```

### Principle 2: Commands Should Read Like Sentences

**Test:** Can you speak the command naturally?

**Examples:**
```bash
/later "Optimize CLAUDE.md"
  → "Later, optimize CLAUDE.md"
  → ✅ Reads naturally

/later list --category optimization
  → "Later, list the optimization category"
  → ✅ Reads naturally

/later do 3
  → "Later, do item 3"
  → ✅ Reads naturally
```

**Counter-examples (what we avoided):**
```bash
/later create item "Title"
  → "Later create item Title"
  → ❌ Awkward, redundant "item"

/later retrieve id 3
  → "Later retrieve ID 3"
  → ❌ Too technical, sounds like database query
```

### Principle 3: Prefer Implicit Over Explicit

**Good (implicit):**
```bash
/later "Title"              # Implicit: This is a capture
/later 3                    # Could be implicit show (future feature)
```

**Bad (explicit):**
```bash
/later capture "Title"      # Explicit: Verbose for common case
/later show 3               # Explicit: Necessary (avoid ambiguity)
```

**Why this matters:** The most common operation (capture) should be the shortest command.

### Principle 4: Consistency Across Commands

**ID references:**
- Always accept plain numbers: `3`, `15`, `99`
- Also accept with hash: `#3`, `#15`, `#99`
- Never require hash: `/later show #3` and `/later show 3` both work

**Filters:**
- Always use long flag: `--category`, `--priority`, `--status`
- Always provide short flag: `-c`, `-p`, `-s`
- Always use same pattern: `--flag value` (not `--flag=value`)

**Boolean flags:**
- Presence = true: `--force`, `--no-context`
- Absence = false (no `--no-force` needed)

**Status values:**
- Consistent across commands: `deferred`, `in_progress`, `done`, `archived`
- Never shorten: Not `defer`, `progress`, `complete` (ambiguous)

## Specific Command Names

### Primary Commands

#### `/later` (Capture)

**Why "later" with no subcommand:**
- Most common operation should be shortest
- Matches natural speech: "I'll do it later"
- Follows Unix tradition (git commit, docker run)

**Alternatives considered:**
- `/later capture` - Too verbose for common case
- `/later add` - Too generic
- `/later new` - Sounds like creating something permanent

#### `/later list`

**Why "list":**
- Universal verb (todos list, files list, emails list)
- Clear intent: Show me the collection
- Short and memorable

**Alternatives considered:**
- `/later ls` - Too Unix-y, not intuitive for non-technical users
- `/later show` - Conflicts with "show single item"
- `/later all` - Not a verb (violates Principle 1)

#### `/later show`

**Why "show":**
- Natural verb: "Show me details"
- Distinct from "list" (one vs many)
- Common in CLI tools (docker show, kubectl get)

**Alternatives considered:**
- `/later get` - Too technical (sounds like API call)
- `/later view` - Longer, less common
- `/later display` - Too formal

#### `/later search`

**Why "search":**
- Universal action (Google search, file search)
- Clear intent: Find by content
- Distinct from "list" (filtered) and "show" (by ID)

**Alternatives considered:**
- `/later find` - Ambiguous (find by ID? by keyword?)
- `/later grep` - Too Unix-y, technical
- `/later query` - Too database-y

#### `/later do`

**Why "do":**
- Shortest verb for "convert to action"
- Natural: "Let's do this"
- Implies starting work (status change: deferred → in_progress)

**Alternatives considered:**
- `/later start` - Longer, implies duration
- `/later begin` - Too formal
- `/later execute` - Way too formal
- `/later work-on` - Too long, awkward

#### `/later done`

**Why "done":**
- Natural completion marker
- Mirrors "do" (start vs finish)
- Common in task management (mark done)

**Alternatives considered:**
- `/later complete` - Too long
- `/later finish` - Less common
- `/later mark-done` - Verbose

### Secondary Commands

#### `/later edit`

**Why "edit":**
- Universal action (edit file, edit email)
- Clear intent: Modify existing item
- Short and common

#### `/later archive`

**Why "archive":**
- Distinct from "delete" (reversible)
- Implies preservation (not destruction)
- Common in email clients (Gmail archive)

**Alternatives considered:**
- `/later hide` - Doesn't imply long-term storage
- `/later remove` - Sounds like deletion
- `/later stash` - Too git-specific

#### `/later export`

**Why "export":**
- Universal data portability term
- Clear intent: Get data out
- Implies format conversion

**Alternatives considered:**
- `/later backup` - Too specific (export has other uses)
- `/later dump` - Too technical, sounds destructive
- `/later save` - Ambiguous (save what? where?)

### Utility Commands

#### `/later migrate-to-sqlite`

**Why "migrate-to-sqlite":**
- Explicit (this is advanced operation)
- Clear destination (sqlite)
- Follows migration convention

**Alternatives considered:**
- `/later upgrade` - Ambiguous (upgrade what?)
- `/later sqlite` - Too short, not clear it's migration
- `/later convert` - Doesn't imply backend change

#### `/later rollback`

**Why "rollback":**
- Database term (familiar to developers)
- Clear intent: Undo last change
- One word (not "roll-back")

**Alternatives considered:**
- `/later undo` - Good alternative, but less specific
- `/later revert` - Git-specific jargon
- `/later restore` - Implies restoring from backup (different)

## Flag Naming

### Consistent Patterns

**Category filters:**
```bash
--category, -c       # Singular (one category at a time)
                     # But accepts multiple: --category a,b,c
```

**Priority filters:**
```bash
--priority, -p       # Singular
--priority high      # Value is unquoted single word
```

**Status filters:**
```bash
--status, -s         # Singular
--status deferred    # Value is unquoted single word
```

**Time filters:**
```bash
--older-than         # Natural language
--newer-than         # Parallel structure
--after              # Alternative (absolute date)
--before             # Alternative (absolute date)
```

### Boolean Flags

**Pattern:** Positive by default, `--no-*` for negation.

```bash
--context            # Include context (default)
--no-context         # Skip context extraction

--force              # Skip confirmations
# (no --no-force, absence = false)

--breakdown          # AI breakdown (default)
--no-breakdown       # Single todo
```

### Output Format Flags

**Pattern:** `--format <type>`

```bash
--format table       # Human-readable (default)
--format json        # Machine-readable
--format ids         # ID list only (for scripting)
--format csv         # Spreadsheet import
```

## Naming Anti-Patterns (What to Avoid)

### Anti-Pattern 1: Abbreviations

**Bad:**
```bash
/later cap "Title"   # What is "cap"?
/later lst           # Harder to remember
/later shw 3         # Saves 2 characters, loses clarity
```

**Good:**
```bash
/later capture "Title"  # Or just /later "Title"
/later list
/later show 3
```

**Why:** Abbreviations optimize for typing over reading. Code is read 10x more than written.

### Anti-Pattern 2: Technical Jargon

**Bad:**
```bash
/later persist "Title"      # Database term
/later SELECT id FROM ...   # SQL in CLI
/later deserialize          # OOP term
```

**Good:**
```bash
/later "Title"              # Natural language
/later list                 # Clear intent
/later show 3               # Simple verb
```

**Why:** Tool should be accessible to all users, not just database experts.

### Anti-Pattern 3: Inconsistent Terminology

**Bad:**
```bash
/later create "Title"       # Uses "create"
/later delete 3             # Uses "delete"
/later remove-tag           # Uses "remove"
/later archive --destroy    # Uses "destroy"
```

**Good:**
```bash
/later "Title"              # Implicit create
/later archive 3            # Non-destructive (consistent)
/later edit 3 --remove-tag  # Consistent with "add-tag"
/later archive              # Never destroy
```

**Why:** Consistency reduces cognitive load. Users learn patterns, not individual commands.

### Anti-Pattern 4: Ambiguous Names

**Bad:**
```bash
/later set 3                # Set what?
/later update               # Update what? Update how?
/later process 3            # Process how?
```

**Good:**
```bash
/later edit 3 --priority high  # Clear what's being set
/later edit 3 --add-tag foo    # Clear what's being updated
/later do 3                    # Clear what processing means
```

**Why:** Ambiguity requires reading docs. Clear names are self-documenting.

## Evolution of Naming

**As project grows:**

1. **Keep core commands stable** - `/later`, `list`, `show`, `do`, `done` should never change
2. **Add, don't replace** - New commands augment, don't replace existing
3. **Deprecate slowly** - If renaming is necessary, support old name for 2+ versions
4. **Alias for common needs** - `/later undo` → `rollback`, `/later rm` → `archive` (aliases, not renames)

**Example evolution:**
```
V1:   /later, /later list, /later show
V2:   + /later search, /later do, /later done
V3:   + /later edit, /later archive, /later export
V4:   + /later rollback (alias: /later undo)
```

Core commands (V1) never change. New commands add capabilities.

## Cultural Considerations

**Language-neutral design:**

- "later" translates well across languages (más tarde, plus tard, später, 后来)
- Avoid idioms ("in the queue", "on the backburner")
- Use universal verbs (list, show, search, edit)
- Avoid cultural references

**Pronunciation:**
- All commands should be easily pronounceable
- Avoid consonant clusters (e.g., "strt", "xpt")
- Prefer common words over technical terms

## Testing Naming Choices

**Questions to ask:**

1. **Can a new user guess what this does?**
   - `/later list` → Yes, obviously lists items
   - `/later foo` → No, what's foo?

2. **Can it be spoken naturally?**
   - "Later, list the items" → Yes
   - "Later, foo the bar" → No

3. **Is it memorable after one use?**
   - `show` → Yes, simple verb
   - `display-details` → No, too long

4. **Is it consistent with similar commands?**
   - `--add-tag` / `--remove-tag` → Yes, parallel
   - `--add-tag` / `--delete-tag` → No, inconsistent verbs

5. **Does it age well?**
   - `list` → Timeless
   - `webapp-export` → Dated, assumes web UI exists

## Related Documents

- **[Command Interface](../user-experience/command-interface.md)** - Command specifications
- **[Apple-Style Philosophy](apple-style-philosophy.md)** - Design principles
- **[Progressive Disclosure](../user-experience/progressive-disclosure.md)** - Revealing complexity

---

**Design Status:** Complete
**Key Principle:** Names should reveal intent immediately, without documentation
