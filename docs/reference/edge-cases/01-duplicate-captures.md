# Edge Case: Duplicate Captures

**Scenario:** User captures same/similar decision multiple times

## Problem

Without duplicate detection:
- Cluttered list (multiple entries for same decision)
- Confusion (which is the latest?)
- Wasted storage
- Poor search results (duplicates rank equally)

**Example:**
```bash
Day 1: /later "Optimize CLAUDE.md"
Day 7: /later "Optimize CLAUDE.md size"  # Similar but not identical
Day 14: /later "CLAUDE.md optimization"  # Same intent, different wording
```

Result: 3 items, all tracking same decision.

## Solution

**Fuzzy duplicate detection** using:
1. Levenshtein distance (< 20% = similar)
2. Keyword overlap (> 80% = similar)
3. Combined similarity score

**User experience:**
```
⚠️  Similar item exists:
  [1] Optimize CLAUDE.md (captured 7d ago)

Options:
  [U]pdate existing with new context
  [C]reate new anyway
  [V]iew existing first

Choice [U]: _
```

## Implementation

See [duplicate-detection.md](../../technical/implementation/duplicate-detection.md) for full algorithm.

**Key points:**
- Only check last 50 items (performance)
- Offer choice, don't force (user control)
- `--force` flag skips check (power users)

## Testing

```bash
test_duplicate_warning() {
  /later "Optimize database"
  output=$(/later "Optimize database queries" 2>&1)
  assert_contains "$output" "Similar item"
}

test_force_flag() {
  /later "Item 1"
  /later "Item 1" --force  # No warning
  assert_equals $(wc -l < deferred.jsonl) "2"
}
```

## Related

- [Duplicate Detection Implementation](../../technical/implementation/duplicate-detection.md)
- [Error Handling](../../design/user-experience/error-handling.md)
