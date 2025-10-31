# Edge Case: Search Overwhelm

**Scenario:** Search returns too many results (100+ matches)

## Problem

**Broad queries:**
```bash
/later search "optimize"
# Returns 127 results
# User overwhelmed, can't find what they need
```

**Poor user experience:**
- Scrolling through 100+ items
- No obvious relevance ranking
- Can't refine easily

## Solution

### 1. Limit Results (Default 20)

```bash
search() {
  local query="$1"
  local limit="${2:-20}"  # Default 20

  # Search and rank
  results=$(search_and_rank "$query")

  # Limit output
  echo "$results" | head -n "$limit"

  # Show count
  local total=$(echo "$results" | wc -l)
  if [[ $total -gt $limit ]]; then
    echo >&2
    echo "Showing $limit of $total results" >&2
    echo "Refine: /later search \"$query\" --category <category>" >&2
    echo "More: /later search \"$query\" --limit 50" >&2
  fi
}
```

### 2. Suggest Refinements

```bash
# After search
Showing 20 of 127 results for "optimize"

Refine your search:
  --category optimization:performance  (45 matches)
  --category optimization:database     (32 matches)
  --category optimization:ui           (18 matches)
  --priority high                      (12 matches)
  --tags performance                   (38 matches)

Or search for more specific term:
  "optimize database queries" (8 matches)
  "optimize API performance" (15 matches)
```

### 3. Ranking by Relevance

**Most relevant first:**
```bash
# Title match > Context match > Tag match
# Recent > Old

search_and_rank() {
  local query="$1"

  while read item; do
    local score=$(rank_item "$item" "$query")
    local id=$(echo "$item" | jq -r '.id')
    echo "$score|$id|$item"
  done | sort -t'|' -k1 -rn | cut -d'|' -f3-
}
```

### 4. Interactive Refinement

```bash
/later search "optimize" --interactive

Found 127 results. Too many to display.

Filter by:
  [C]ategory
  [P]riority
  [T]ags
  [D]ate range
  [S]tatus

Choice [C]: C

Available categories:
  1. optimization:performance (45)
  2. optimization:database (32)
  3. optimization:ui (18)
  4. Other (32)

Select (1-4): 1

# Shows refined results
```

## Implementation

```bash
suggest_refinements() {
  local query="$1"
  local results="$2"

  # Analyze common categories in results
  local categories=$(echo "$results" | jq -r '.categories[]' | \
    sort | uniq -c | sort -rn | head -5)

  echo "Refine your search:" >&2

  while read count category; do
    echo "  --category $category  ($count matches)" >&2
  done <<< "$categories"

  # Suggest more specific queries
  local keywords=$(extract_common_keywords "$results" "$query")
  if [[ -n "$keywords" ]]; then
    echo >&2
    echo "Or search for more specific term:" >&2
    for kw in $keywords; do
      local kw_count=$(echo "$results" | grep -i "$query.*$kw" | wc -l)
      echo "  \"$query $kw\" ($kw_count matches)" >&2
    done
  fi
}
```

## User Control

**Increase limit:**
```bash
/later search "optimize" --limit 50
# Shows 50 results

/later search "optimize" --limit 0
# Shows all results (no limit)
```

**Narrow by filters:**
```bash
/later search "optimize" --category performance --priority high
# Combines search + filters
```

## Testing

```bash
test_search_limit() {
  # Create 100 items matching "test"
  for i in {1..100}; do
    later "Test item $i"
  done

  # Search should limit to 20
  results=$(later search "test")
  count=$(echo "$results" | wc -l)

  assert_equals "$count" "20"
}

test_refinement_suggestions() {
  # Search with many results
  output=$(later search "optimize" 2>&1)

  # Should suggest refinements
  assert_contains "$output" "Refine your search"
  assert_contains "$output" "--category"
}
```

## Related

- [Search Ranking](../../technical/implementation/search-ranking.md)
- [Command Interface](../../design/user-experience/command-interface.md#later-search)
