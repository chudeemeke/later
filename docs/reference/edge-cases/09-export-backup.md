# Edge Case: Export and Backup

**Scenario:** User needs to backup, migrate, or inspect data

## Problem

**Data accessibility:**
- SQLite data not human-readable
- Need portable format for backups
- Want to inspect data without tool

**Migration needs:**
- Move to different machine
- Share subset with team
- Import into spreadsheet

## Solution

### 1. Always Provide JSONL Export

**Even after SQLite migration:**
```bash
/later export

Exported 450 items to: ~/.later/exports/deferred-20251031.jsonl
Format: JSONL (JSON Lines)
Size: 2.1 MB

Import with: /later import <file>
```

**Why JSONL:**
- Human-readable (cat, less, grep work)
- Line-by-line processing (large files OK)
- Language-agnostic (works in any language)
- 10-year stable (plain text never obsolete)

### 2. Multiple Export Formats

```bash
# JSONL (default, best for backup)
/later export

# JSON (single file, for APIs)
/later export --format json

# CSV (for spreadsheets)
/later export --format csv --no-context
# Columns: id,title,status,priority,captured_at,categories,tags
```

### 3. Selective Export

```bash
# Export only done items
/later export --status done

# Export specific category
/later export --category optimization

# Export date range
/later export --after 2025-01-01 --before 2025-12-31

# Combine filters
/later export --priority high --status deferred --category security
```

### 4. Automatic Backups

**On every write:**
```bash
after_write() {
  local file="$1"

  # Background backup (doesn't slow user)
  (
    timestamp=$(date +%Y%m%d-%H%M%S)
    cp "$file" "$HOME/.later/backups/deferred-$timestamp.jsonl"

    # Prune (keep last 10)
    ls -t ~/.later/backups/deferred-*.jsonl | tail -n +11 | xargs rm -f
  ) &
}
```

## Import Process

**From JSONL export:**
```bash
/later import backup.jsonl

Validating backup.jsonl...
✅ Valid JSONL (450 items)

Merge strategy:
  [M]erge with existing (skip duplicates)
  [R]eplace all (clear existing)
  [C]ancel

Choice [M]: M

Importing...
  ✅ 450 items processed
  ✅ 445 imported
  ⚠️  5 skipped (duplicates)

Import complete.
```

## Backup Best Practices

**Regular automated backups:**
```bash
# Cron job (daily backup)
0 2 * * * /later export --output ~/backups/later-$(date +\%Y\%m\%d).jsonl

# Weekly cleanup (keep 4 weeks)
find ~/backups -name "later-*.jsonl" -mtime +28 -delete
```

**Cloud sync:**
```bash
# Export to iCloud/Dropbox
/later export --output ~/iCloud/later/backup.jsonl

# Or use git
cd ~/.later
git add deferred.jsonl
git commit -m "Backup $(date +%Y-%m-%d)"
git push
```

## Export Validation

```bash
validate_export() {
  local file="$1"

  # Check JSONL syntax
  if ! jq empty "$file" 2>/dev/null; then
    echo "ERROR: Invalid JSONL" >&2
    return 1
  fi

  # Count items
  local count=$(wc -l < "$file")
  echo "✅ Valid JSONL ($count items)" >&2

  # Check required fields
  local missing=$(jq -r '
    select(.id == null or .title == null or .status == null)
    | .id // "unknown"
  ' "$file")

  if [[ -n "$missing" ]]; then
    echo "WARNING: Items missing required fields" >&2
    return 1
  fi

  return 0
}
```

## Testing

```bash
test_export_import_roundtrip() {
  # Create items
  later "Item 1"
  later "Item 2"
  later "Item 3"

  # Export
  later export --output test-export.jsonl

  # Clear data
  rm ~/.later/deferred.jsonl

  # Import
  later import test-export.jsonl

  # Verify count
  assert_equals $(wc -l < ~/.later/deferred.jsonl) "3"
}

test_selective_export() {
  later "High priority" --priority high
  later "Low priority" --priority low

  # Export only high
  later export --priority high --output high.jsonl

  count=$(wc -l < high.jsonl)
  assert_equals "$count" "1"
}
```

## Related

- [JSONL Format](../../technical/schema/jsonl-format.md)
- [Migration Guide](../../technical/schema/migration-guide.md)
