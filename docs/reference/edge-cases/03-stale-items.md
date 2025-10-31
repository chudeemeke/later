# Edge Case: Stale Items

**Scenario:** Deferred items become outdated or irrelevant

## Problem

Items deferred 6+ months ago may be:
- **Obsolete** - Decision already made elsewhere
- **Irrelevant** - Context changed, no longer needed
- **Forgotten** - User can't remember why it was deferred

**Example:**
```bash
# 9 months ago
/later "Optimize for Python 3.8 compatibility"

# Today: Project now requires Python 3.11
# Item is obsolete but still in list
```

## Solution

**Proactive stale detection:**

1. **Flag old items** (> 180 days)
2. **Periodic review prompt** (weekly/monthly)
3. **Easy archival** (bulk operations)
4. **Context refresh** (update stale context)

**Implementation:**
```bash
check_stale_items() {
  local threshold_days=180
  local stale_count=$(jq -r --arg days "$threshold_days" '
    select(
      (.status == "deferred") and
      ((now - (.captured_at | fromdate)) / 86400 > ($days | tonumber))
    ) | .id
  ' ~/.later/deferred.jsonl | wc -l)

  if [[ $stale_count -gt 0 ]]; then
    echo "⚠️  You have $stale_count items deferred > $threshold_days days" >&2
    echo "   Review: /later list --older-than ${threshold_days}d" >&2
    echo "   Archive old items: /later archive --older-than 365d" >&2
  fi
}
```

**Weekly reminder:**
```bash
# Run on every shell load (once per day max)
LAST_CHECK=$(cat ~/.later/.last-stale-check 2>/dev/null || echo 0)
NOW=$(date +%s)
DAYS_SINCE=$(( (NOW - LAST_CHECK) / 86400 ))

if [[ $DAYS_SINCE -ge 7 ]]; then
  check_stale_items
  echo "$NOW" > ~/.later/.last-stale-check
fi
```

## User Actions

**Review old items:**
```bash
/later list --older-than 180d
# Shows items > 6 months old

/later show 42
# Refresh my memory on context
```

**Refresh context:**
```bash
/later edit 42 --refresh-context
# Re-extracts context from current state
# Useful if decision factors changed
```

**Bulk archive:**
```bash
/later archive --older-than 365d --status deferred
# Archive year-old items that were never started
```

**Mark obsolete:**
```bash
/later done 42 --notes "No longer needed (migrated to Python 3.11)"
# Mark as done even though not executed
```

## Preventing Staleness

**Set realistic priorities:**
- "High" = Do within 30 days
- "Medium" = Do within 90 days
- "Low" = Do within 180 days or archive

**Regular reviews:**
- Monthly: Review high-priority items
- Quarterly: Review all deferred items
- Annually: Archive items > 1 year old

**Context refresh for long-deferred items:**
```bash
# Auto-suggest refresh for items > 6 months
/later show 42
⚠️  This item is 7 months old. Context may be stale.
   Refresh context? [Y/n] _
```

## Testing

```bash
test_stale_detection() {
  # Create item with old timestamp
  old_date=$(date -d '200 days ago' -u +%Y-%m-%dT%H:%M:%SZ)
  jq -n --arg date "$old_date" '{
    id: 1,
    title: "Old item",
    status: "deferred",
    captured_at: $date
  }' >> deferred.jsonl

  # Should detect as stale
  assert_true check_stale_items
}
```

## Related

- [Archive Command](../../design/user-experience/command-interface.md#later-archive)
- [Context Refresh](../../technical/implementation/context-extraction.md)
