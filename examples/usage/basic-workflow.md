# Basic Workflow Examples

## Daily Use Cases

### Capture During Work

```bash
# During code review
/later "Refactor error handling in API module"

# During meeting
/later "Evaluate new logging framework options"

# During debugging
/later "Investigate memory leak in worker process"
```

### Weekly Review

```bash
# See what needs attention
/later list --priority high

# Review old items
/later list --older-than 30d

# Search for specific topic
/later search "database"
```

### Monthly Cleanup

```bash
# Archive completed items
/later archive --status done --older-than 90d

# Review deferred items
/later list --status deferred --older-than 90d

# Update stale contexts
/later edit 5 --refresh-context
```

## Complete Workflows

### Workflow 1: Technical Decision

```bash
# 1. Capture during research
/later "Choose between REST and GraphQL for new API"

# Output:
✅ Captured as item #10
   Context extracted from conversation

# 2. Weeks later, ready to decide
/later search "API"

# 3. Review full context
/later show 10

# 4. Convert to actionable todos
/later do 10

# AI suggests:
#   1. List API requirements and constraints
#   2. Create proof-of-concept for both approaches
#   3. Compare developer experience
#   4. Evaluate performance characteristics
#   5. Make final decision
#   6. Document choice in ADR

# 5. After completing todos
/later done 10
```

### Workflow 2: Performance Optimization

```bash
# 1. Defer investigation
/later "Optimize database query performance" --priority high --category optimization:performance

# 2. Add context manually
/later edit 1 --add-context "user_events table, 50M rows, 2.5s queries"

# 3. Link related items
/later "Add database indexes" --depends-on 1

# 4. When ready, work on it
/later do 1

# 5. Mark complete with notes
/later done 1 --notes "Added composite index, queries now < 100ms"
```

### Workflow 3: Feature Planning

```bash
# 1. Capture feature idea
/later "Add dark mode support" --category feature --tags ui,accessibility

# 2. Break down when ready
/later do 3

# Suggested breakdown:
#   1. Design dark mode color palette
#   2. Implement CSS variable system
#   3. Add toggle UI component
#   4. Update all components for dark mode
#   5. Add user preference persistence
#   6. Test accessibility

# 3. As work progresses, update
/later edit 3 --priority high  # User requested

# 4. Complete
/later done 3
```

## Power User Workflows

### Batch Operations

```bash
# Archive all done items > 6 months
/later list --status done --older-than 180d --format ids | \
  xargs -I {} /later archive {}

# Update priority for category
/later list --category security --format ids | \
  xargs -I {} /later edit {} --priority high

# Export specific category
/later export --category optimization --output optimizations.jsonl
```

### Scripted Workflows

```bash
#!/bin/bash
# weekly-review.sh

echo "=== High Priority Items ==="
/later list --priority high --status deferred

echo -e "\n=== Old Deferred Items ==="
/later list --older-than 90d --status deferred

echo -e "\n=== Recently Completed ==="
/later list --status done --newer-than 7d

echo -e "\n=== Suggest Archive? ==="
OLD_COUNT=$(/later list --status done --older-than 180d --format ids | wc -l)
if [[ $OLD_COUNT -gt 0 ]]; then
  echo "$OLD_COUNT items ready to archive"
  echo "Run: /later archive --status done --older-than 180d"
fi
```

### Integration with Git

```bash
# 1. Defer during development
/later "Refactor authentication module" --priority high

# 2. Work on it
/later do 5
# Creates todos

# 3. Make commits referencing decision
git commit -m "refactor(auth): extract OAuth logic

Breaking auth module into smaller pieces for better testability.

Resolves: /later #5"

# 4. Mark complete
/later done 5
```

## Anti-Patterns (What NOT to Do)

### ❌ Don't Use as Regular Todo List

```bash
# Wrong:
/later "Buy groceries"
/later "Call dentist"
/later "Reply to email"

# Right: Use TodoWrite for immediate tasks
# /later is for decisions you'll revisit later
```

### ❌ Don't Defer Everything

```bash
# Wrong:
/later "Fix typo in README"  # Just do it now

# Right: Only defer decisions that:
# - Need more information
# - Depend on other work
# - Require deeper thought
# - Have uncertain timing
```

### ❌ Don't Ignore Old Items

```bash
# Wrong: Capture 100 items, never review
/later list  # Shows 100 items, 90 days old

# Right: Regular reviews
# - Weekly: High priority items
# - Monthly: All deferred items
# - Quarterly: Archive old done items
```

## Related

- [Advanced Features](advanced-features.md) - Power user tips
- [Command Reference](../../design/user-experience/command-interface.md) - All commands
- [Workflow Automation](../../technical/integration/) - Scripts and integrations
