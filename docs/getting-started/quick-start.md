# Quick Start Guide

**Get productive with /later in 5 minutes**

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/later.git
cd later

# Install dependencies
# Requires: bash 4.0+, jq, sqlite3 (optional)

# Run setup
./install.sh

# Verify installation
/later --version
```

## First Capture (30 seconds)

```bash
# Capture your first deferred decision
/later "Optimize CLAUDE.md size"

# Output:
✅ Captured as item #1
```

**That's it!** Your decision is saved with context.

## View Your Items (10 seconds)

```bash
# List all items
/later list

# Output:
Deferred Items (1 total)

[1] Optimize CLAUDE.md size    decision    0d  medium

Show details: /later show 1
```

## Get Details (10 seconds)

```bash
# Show full context
/later show 1

# Output:
────────────────────────────────────
Item #1: Optimize CLAUDE.md size
────────────────────────────────────

Status:       deferred
Category:     decision, optimization
Priority:     medium
Captured:     2025-10-31 (0 days ago)

Context:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User asked about CLAUDE.md token count.
Currently 3,343 words (~4,500 tokens).

Options considered:
1. Hybrid: Move examples to skills
2. Minimal: Keep only rules
3. Keep as-is

Recommendation: Hybrid approach
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actions:
  Convert to todos: /later do 1
  Mark as done: /later done 1
────────────────────────────────────
```

## Search Items (15 seconds)

```bash
# Search by keyword
/later search "optimize"

# Output:
Search: "optimize" (1 result)

[1] Optimize CLAUDE.md size    0d  medium
    Context: ...User asked about CLAUDE.md token count...
```

## Convert to Action (30 seconds)

```bash
# Convert deferred item to todos
/later do 1

# AI suggests breakdown:
Suggested breakdown:
  1. Analyze current CLAUDE.md structure
  2. Identify examples to move to skills
  3. Create new skill files
  4. Update CLAUDE.md with references
  5. Test skill loading
  6. Compare token counts

Proceed? [Y/n] Y

✅ Created 6 todos from /later #1
```

## Mark Complete (5 seconds)

```bash
# After todos done
/later done 1

✅ Item #1 marked as done
```

## Common Workflows

### Weekly Review

```bash
# List old items
/later list --older-than 90d

# Archive done items
/later archive --status done --older-than 365d
```

### Find Specific Item

```bash
# Search by keyword
/later search "database"

# Filter by category
/later list --category optimization

# Filter by priority
/later list --priority high
```

### Update Item

```bash
# Change priority
/later edit 1 --priority high

# Add tags
/later edit 1 --add-tag performance

# Refresh context
/later edit 1 --refresh-context
```

## Tips

**Capture quickly:**
- Just title is enough: `/later "Title"`
- Context extracted automatically
- Categories suggested

**Search efficiently:**
- Search ranks by relevance (not date)
- Use specific terms for better results
- Combine with filters: `--category`, `--priority`

**Stay organized:**
- Review items monthly
- Archive old done items
- Use categories consistently

## Next Steps

- **[Installation Guide](installation.md)** - Detailed setup
- **[Basic Workflow](../examples/usage/basic-workflow.md)** - Common use cases
- **[Command Reference](../design/user-experience/command-interface.md)** - All commands

## Getting Help

```bash
# Command help
/later --help
/later list --help

# Examples
/later help examples

# Documentation
# See docs/ folder
```

---

**Ready to start?** Capture your first decision now:

```bash
/later "Your first deferred decision"
```
