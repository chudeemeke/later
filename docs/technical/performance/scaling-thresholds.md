# Scaling Thresholds and Triggers

**Last Updated:** 2025-10-31
**Purpose:** Define when and how to trigger JSONL → SQLite migration

## Overview

Migration should be:
- **Automatic** - System detects and suggests
- **Timely** - Before UX degrades significantly
- **Safe** - Non-destructive, reversible
- **User-controlled** - User makes final decision

## Trigger Conditions

### Trigger 1: Item Count > 500

**Rationale:**
- JSONL performance starts degrading noticeably
- Search: 420ms (approaching 500ms threshold)
- List: 120ms (still acceptable but slower)
- Proactive migration before frustration

**Detection:**
```bash
check_item_count() {
  local count=$(wc -l < ~/.later/deferred.jsonl)

  if [[ $count -gt 500 ]] && [[ ! -f ~/.later/.using-sqlite ]]; then
    return 0  # Trigger migration offer
  fi

  return 1  # No trigger
}
```

**Offer message:**
```
Performance Notice:
You have 512 deferred items. Search performance is degrading.

Migrate to SQLite for instant search? (< 10ms vs current ~600ms)
✅ Safe (keeps JSONL backup)
✅ Automatic (no manual work)
✅ Reversible (can export back to JSONL)

Migrate now? [Y/n]
```

### Trigger 2: Search Time > 500ms

**Rationale:**
- User is actively experiencing slowness
- 500ms is perceptible, feels sluggish
- Measured real-world performance, not estimate

**Detection:**
```bash
track_search_time() {
  local start=$(date +%s%N)
  # Perform search
  search_operation "$@"
  local end=$(date +%s%N)

  local duration=$(( (end - start) / 1000000 ))  # ms

  # Log to performance history
  echo "$(date +%s)|search|$duration" >> ~/.later/performance.log

  # Check if slow
  if [[ $duration -gt 500 ]]; then
    return 0  # Slow search detected
  fi

  return 1
}

check_slow_searches() {
  # Get last 5 searches
  local recent=$(tail -5 ~/.later/performance.log | grep search)
  local slow_count=0

  while read timestamp op duration; do
    [[ $duration -gt 500 ]] && slow_count=$((slow_count + 1))
  done <<< "$recent"

  # If 3+ of last 5 searches were slow
  if [[ $slow_count -ge 3 ]] && [[ ! -f ~/.later/.using-sqlite ]]; then
    return 0  # Trigger migration offer
  fi

  return 1
}
```

**Offer message:**
```
That search took 750ms (slow). You have 850 items.

Migrate to SQLite for instant search?
After migration, this search would take < 10ms.

Migrate now? [Y/n]
```

### Trigger 3: User-Initiated

**Command:**
```bash
/later migrate-to-sqlite
```

**Rationale:**
- User wants performance benefits proactively
- User anticipates growth
- User prefers SQLite for advanced features (FTS5, relations)

**No prompt - immediate migration:**
```
Migrating to SQLite...
✅ Backup created: deferred.jsonl.backup-20251031-143022
✅ SQLite database created
✅ Migrating 350 items... 100%
✅ Building indexes...
✅ Validation passed (350 items)
✅ Migration complete

Search is now < 10ms. Enjoy!
```

## Migration Decision Logic

```bash
should_offer_migration() {
  # Skip if already using SQLite
  [[ -f ~/.later/.using-sqlite ]] && return 1

  # Skip if recently declined
  if [[ -f ~/.later/.migration-declined ]]; then
    local decline_time=$(stat -f %m ~/.later/.migration-declined)
    local now=$(date +%s)
    local age=$((now - decline_time))

    # Don't ask again for 30 days
    [[ $age -lt 2592000 ]] && return 1
  fi

  # Check triggers
  if check_item_count; then
    echo "trigger=item_count"
    return 0
  fi

  if check_slow_searches; then
    echo "trigger=slow_searches"
    return 0
  fi

  return 1  # No migration needed
}
```

## User Response Handling

```bash
offer_migration() {
  local trigger="$1"

  case "$trigger" in
    item_count)
      echo "You have $(wc -l < ~/.later/deferred.jsonl) deferred items."
      echo "Migrate to SQLite for better performance?"
      ;;
    slow_searches)
      echo "Recent searches have been slow (> 500ms)."
      echo "Migrate to SQLite for instant search?"
      ;;
  esac

  echo
  echo "✅ Safe (keeps JSONL backup)"
  echo "✅ Automatic (no manual work)"
  echo "✅ Reversible (can export back)"
  echo
  read -p "Migrate now? [Y/n] " -n 1 -r
  echo

  case $REPLY in
    Y|y|"")
      migrate_to_sqlite
      ;;
    N|n)
      # User declined, don't ask for 30 days
      touch ~/.later/.migration-declined
      echo "Migration declined. Won't ask again for 30 days."
      echo "To migrate manually: /later migrate-to-sqlite"
      ;;
    *)
      echo "Invalid choice. Migration cancelled."
      ;;
  esac
}
```

## Threshold Configuration

**Allow power users to customize:**

```bash
# ~/.later/config.json
{
  "migration": {
    "trigger_item_count": 500,
    "trigger_search_time_ms": 500,
    "trigger_slow_search_count": 3,
    "auto_migrate": false,  // Skip prompt, migrate automatically
    "never_migrate": false  // Never offer migration
  }
}
```

**Load configuration:**
```bash
load_config() {
  local config_file="$HOME/.later/config.json"

  if [[ -f "$config_file" ]]; then
    TRIGGER_ITEM_COUNT=$(jq -r '.migration.trigger_item_count // 500' "$config_file")
    TRIGGER_SEARCH_TIME=$(jq -r '.migration.trigger_search_time_ms // 500' "$config_file")
    AUTO_MIGRATE=$(jq -r '.migration.auto_migrate // false' "$config_file")
    NEVER_MIGRATE=$(jq -r '.migration.never_migrate // false' "$config_file")
  fi
}
```

## Performance Monitoring

**Log all operations:**
```bash
log_performance() {
  local operation="$1"
  local duration_ms="$2"

  echo "$(date +%s)|$operation|$duration_ms" >> ~/.later/performance.log
}

# Usage
start=$(date +%s%N)
later list
end=$(date +%s%N)
duration=$(( (end - start) / 1000000 ))
log_performance "list" "$duration"
```

**Analyze trends:**
```bash
analyze_performance() {
  # Average search time (last 30 days)
  local avg=$(tail -1000 ~/.later/performance.log | \
    awk -F'|' '/search/ {sum+=$3; count++} END {print int(sum/count)}')

  echo "Average search time: ${avg}ms"

  # If average > 400ms, warn user
  if [[ $avg -gt 400 ]]; then
    echo "⚠️  Search performance degrading"
    echo "   Consider migration: /later migrate-to-sqlite"
  fi
}
```

## Testing

```bash
test_trigger_on_count() {
  # Generate 501 items
  generate_test_data 501 > test.jsonl

  # Should trigger
  assert_true check_item_count
}

test_trigger_on_slow_searches() {
  # Simulate 3 slow searches
  for i in {1..3}; do
    echo "$(date +%s)|search|600" >> ~/.later/performance.log
  done

  # Should trigger
  assert_true check_slow_searches
}

test_no_trigger_after_decline() {
  # User declined
  touch ~/.later/.migration-declined

  # Should not trigger for 30 days
  assert_false should_offer_migration
}
```

## Related Documents

- **[Benchmarks](benchmarks.md)** - Measured performance data
- **[Scaling Strategy](../../architecture/decisions/scaling-strategy.md)** - Migration rationale
- **[Migration Guide](../schema/migration-guide.md)** - Step-by-step process

---

**Status:** Designed, ready for implementation
**Key Principle:** Measure, don't guess. Offer migration based on real performance data.
