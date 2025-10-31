# Edge Case: Bulk Operations

**Scenario:** User wants to modify/archive many items at once

## Problem

**Manual operations are tedious:**
```bash
# Archive 50 old items one by one
/later archive 1
/later archive 2
/later archive 3
# ... 47 more times
```

**Accidental bulk operations:**
```bash
/later archive --older-than 30d
# Oops, archived 85 items (meant 365d)
```

## Solution

### 1. Preview Before Action

```bash
/later archive --older-than 180d

Archive candidates: 23 items older than 180 days

[1]  Optimize database   done      200d  medium
[5]  Refactor auth       abandoned  190d  high
[12] Add telemetry       deferred   185d  low
... (20 more)

Preview shows first 10. View all: /later list --older-than 180d

Proceed with archive? [y/N] _
```

**Default:** Require confirmation (capital N = no by default)

### 2. Dry-Run Mode

```bash
/later archive --older-than 180d --dry-run

Would archive 23 items:
  [1] Optimize database (done, 200d)
  [5] Refactor auth (abandoned, 190d)
  ...

No changes made (dry-run mode).
Run without --dry-run to apply.
```

### 3. Undo Bulk Operations

```bash
# After bulk archive
✅ Archived 23 items

Undo: /later rollback
```

**Implementation:**
```bash
# Log bulk operation
echo "$(date +%s)|bulk_archive|23|ids:1,5,12,..." >> ~/.later/action-log.jsonl

# Rollback reverses operation
rollback() {
  local last_action=$(tail -1 ~/.later/action-log.jsonl)
  local action=$(echo "$last_action" | cut -d'|' -f2)
  local ids=$(echo "$last_action" | cut -d'|' -f4 | cut -d':' -f2)

  case "$action" in
    bulk_archive)
      # Restore archived items
      for id in ${ids//,/ }; do
        update_item "$id" '.status = "deferred"'
      done
      ;;
  esac
}
```

### 4. Incremental Confirmation

**For very large operations:**
```bash
/later archive --older-than 365d

Found 250 items to archive.

This is a large operation. Confirm in batches?
  [A]ll at once
  [B]atches of 50
  [R]eview each batch
  [C]ancel

Choice [B]: B

Batch 1/5 (50 items):
  [1-50] ...
Archive batch 1? [Y/n] Y
✅ Archived batch 1

Batch 2/5 (50 items):
  [51-100] ...
Archive batch 2? [Y/n] n
Aborted. 50 items archived, 200 remaining.
```

## Safe Bulk Operations

```bash
bulk_operation() {
  local operation="$1"
  local items="$2"
  local force="${3:-false}"

  local count=$(echo "$items" | wc -l)

  # Preview (unless --force)
  if [[ "$force" != "true" ]]; then
    echo "About to $operation $count items" >&2
    echo "$items" | head -10 >&2

    if [[ $count -gt 10 ]]; then
      echo "... and $((count - 10)) more" >&2
    fi

    read -p "Proceed? [y/N] " -r
    [[ ! $REPLY =~ ^[Yy]$ ]] && return 1
  fi

  # Log for rollback
  local ids=$(echo "$items" | jq -r '.id' | tr '\n' ',')
  echo "$(date +%s)|bulk_$operation|$count|ids:$ids" >> ~/.later/action-log.jsonl

  # Execute with progress
  local current=0
  while read item; do
    current=$((current + 1))
    apply_operation "$operation" "$item"

    # Progress every 10 items
    if [[ $((current % 10)) -eq 0 ]]; then
      echo "  $current/$count..." >&2
    fi
  done <<< "$items"

  echo "✅ $operation complete: $count items" >&2
}
```

## Bulk Operation Types

**Archive:**
```bash
/later archive --older-than 365d
/later archive --status done
/later archive --category obsolete
```

**Edit (batch update):**
```bash
/later bulk-edit --category optimization --set-priority high
# Update all optimization items to high priority
```

**Export:**
```bash
/later export --status done --format csv > completed.csv
# Export all completed items
```

## Testing

```bash
test_bulk_preview() {
  # Create 25 old items
  for i in {1..25}; do
    create_old_item "$i" "200d"
  done

  # Bulk archive with preview
  output=$(later archive --older-than 180d <<< "n")

  # Should show preview
  assert_contains "$output" "23 items"
  assert_contains "$output" "Proceed"

  # Should not archive (user said no)
  assert_equals $(count_archived) "0"
}

test_dry_run() {
  output=$(later archive --older-than 180d --dry-run)

  assert_contains "$output" "Would archive"
  assert_contains "$output" "No changes made"
}

test_rollback() {
  # Bulk archive
  later archive --older-than 180d <<< "y"

  # Rollback
  later rollback

  # Items should be restored
  assert_equals $(count_archived) "0"
}
```

## Related

- [Archive Command](../../design/user-experience/command-interface.md#later-archive)
- [Rollback](../../technical/implementation/rollback.md)
