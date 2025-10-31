# Edge Case: File Corruption

**Scenario:** Power loss, disk failure, or bug corrupts data file

## Problem

**Partial write corruption:**
```json
{"id":1,"title":"Item 1"}
{"id":2,"title":"Item 2"}
{"id":3,"tit  # Power loss mid-write
```

**Full file corruption:**
- Disk failure
- Filesystem errors
- Accidental truncation

## Solution Layers

### Layer 1: Atomic Writes (Prevent Corruption)

```bash
atomic_write() {
  local target="$1"
  local content="$2"

  # Write to temp file
  local temp="${target}.tmp.$$"
  echo "$content" > "$temp"

  # Validate
  if ! jq empty "$temp" 2>/dev/null; then
    rm "$temp"
    return 1
  fi

  # Atomic rename (single syscall)
  mv "$temp" "$target"
}
```

**Why atomic:** `mv` is atomic at OS level - either old file or new file, never corrupted.

### Layer 2: Automatic Backups (Recover from Corruption)

```bash
# Backup on every write (background)
backup_file() {
  local file="$1"
  local timestamp=$(date +%Y%m%d-%H%M%S)
  local backup="$HOME/.later/backups/deferred-$timestamp.jsonl"

  (cp "$file" "$backup" &)

  # Prune old backups (keep last 10)
  ls -t ~/.later/backups/deferred-*.jsonl | tail -n +11 | xargs rm -f
}
```

### Layer 3: Corruption Detection (Validate on Load)

```bash
validate_file() {
  local file="$1"
  local line_num=0
  local errors=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    if ! echo "$line" | jq empty 2>/dev/null; then
      echo "ERROR: Invalid JSON at line $line_num" >&2
      echo "  $line" >&2
      errors=$((errors + 1))
    fi
  done < "$file"

  return $errors
}
```

### Layer 4: Automatic Recovery

```bash
recover_corrupted_file() {
  local file="$1"

  echo "⚠️  Data file corrupted" >&2
  echo >&2

  # Find latest valid backup
  local backup=$(ls -t ~/.later/backups/deferred-*.jsonl | head -1)

  if [[ -n "$backup" ]]; then
    local backup_time=$(stat -f %Sm "$backup")
    local backup_count=$(wc -l < "$backup")

    echo "Latest backup found:" >&2
    echo "  File: $backup" >&2
    echo "  Time: $backup_time" >&2
    echo "  Items: $backup_count" >&2
    echo >&2

    read -p "Restore from backup? [Y/n] " -r
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
      cp "$backup" "$file"
      echo "✅ Restored from backup" >&2
    fi
  else
    echo "No backups found" >&2
    echo "Attempting repair..." >&2
    repair_file "$file"
  fi
}
```

### Layer 5: Repair (Salvage Valid Lines)

```bash
repair_file() {
  local file="$1"
  local temp="${file}.repaired"
  local salvaged=0
  local lost=0

  while IFS= read -r line; do
    if echo "$line" | jq empty 2>/dev/null; then
      echo "$line" >> "$temp"
      salvaged=$((salvaged + 1))
    else
      lost=$((lost + 1))
    fi
  done < "$file"

  echo "Repair results:" >&2
  echo "  Salvaged: $salvaged items" >&2
  echo "  Lost: $lost items" >&2

  if [[ $salvaged -gt 0 ]]; then
    mv "$temp" "$file"
    echo "✅ File repaired" >&2
  else
    echo "❌ No valid items found" >&2
    rm "$temp"
  fi
}
```

## Testing

```bash
test_corruption_detection() {
  # Create corrupted file
  cat > test.jsonl <<EOF
{"id":1,"title":"Valid"}
{"id":2,"invalid json}
{"id":3,"title":"Valid"}
EOF

  # Should detect corruption
  assert_failure validate_file test.jsonl
}

test_automatic_recovery() {
  # Create backup
  echo '{"id":1,"title":"Item"}' > backup.jsonl
  mkdir -p ~/.later/backups
  cp backup.jsonl ~/.later/backups/deferred-20251031-143022.jsonl

  # Corrupt main file
  echo "invalid" > ~/.later/deferred.jsonl

  # Should offer recovery
  output=$(recover_corrupted_file ~/.later/deferred.jsonl <<< "Y")
  assert_contains "$output" "Restored from backup"
}
```

## User Experience

**Detection:**
```bash
$ /later list
⚠️  Data file corrupted

Latest backup found:
  File: ~/.later/backups/deferred-20251031-143022.jsonl
  Time: Oct 31 14:30
  Items: 42

Restore from backup? [Y/n] Y
✅ Restored from backup
```

**Prevention message:**
```bash
# On successful operation
✅ Captured as item #3
   (Backup created automatically)
```

## Related

- [Atomic Operations](../../technical/implementation/atomic-writes.md)
- [Backup Strategy](../../architecture/system/system-design.md#layer-4-recovery)
