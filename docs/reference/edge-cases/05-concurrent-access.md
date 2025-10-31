# Edge Case: Concurrent Access

**Scenario:** Multiple Claude sessions modify same file simultaneously

## Problem

Without locking:
```bash
# Session 1: Reads file, appends item #42
# Session 2: Reads file (same time), appends item #43
# Both write simultaneously
# Result: Corrupted file or lost data
```

**JSONL vulnerability:**
```
{"id":42,"title":"..."}{"id":43,"title":"..."}  # Merged on same line = invalid JSON
```

## Solution

**File locking with flock:**

```bash
# JSONL append (safe)
append_item() {
  local item="$1"
  local file="$HOME/.later/deferred.jsonl"

  # Acquire exclusive lock, write, release atomically
  flock "$file.lock" -c "echo '$item' >> $file"
}

# JSONL read (no lock needed for reads)
list_items() {
  cat ~/.later/deferred.jsonl
}
```

**SQLite (built-in locking):**
```bash
# SQLite handles concurrent access natively
sqlite3 deferred.db "INSERT INTO deferred_items ..."
# Blocks if another write in progress
# Returns when lock available
```

## Testing Concurrent Access

```bash
test_concurrent_writes() {
  # Launch 10 parallel captures
  for i in {1..10}; do
    (later "Item $i" &)
  done

  # Wait for all
  wait

  # Validate file integrity
  assert_equals $(wc -l < deferred.jsonl) "10"
  assert_valid_jsonl deferred.jsonl
}
```

## File Lock Types

**Advisory locking (Linux/macOS):**
- Processes cooperate voluntarily
- Fast, efficient
- Used by flock

**Mandatory locking (rare):**
- OS enforces locks
- Slower, complex
- Not needed for /later

## Deadlock Prevention

**Rule:** Never hold multiple locks simultaneously

```bash
# Good: Sequential locking
flock file1.lock -c "..."
flock file2.lock -c "..."

# Bad: Nested locking (deadlock risk)
flock file1.lock -c "
  flock file2.lock -c \"...\"
"
```

## Related

- [Atomic Operations](../../technical/implementation/atomic-writes.md)
- [SQLite Concurrency](../../technical/schema/sqlite-schema.md#wal-mode)
