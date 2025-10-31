# Search Ranking Implementation

**Last Updated:** 2025-10-31
**Purpose:** Rank search results by relevance, not chronology

## Overview

Search ranking uses weighted scoring across multiple fields:
- **Title** (60% weight) - Most important
- **Context** (30% weight) - Secondary
- **Tags/Categories** (10% weight) - Tertiary

**Key principle:** Most relevant results first, not newest first.

## Scoring Algorithm

```
score = (title_match * 0.6) + (context_match * 0.3) + (tags_match * 0.1) + recency_boost
```

### Field Matching

```bash
# Match score (0-100)
match_score() {
  local field="$1"
  local query="$2"

  # Exact match = 100
  if [[ "$field" == "$query" ]]; then
    echo "100"
    return
  fi

  # Contains (case-insensitive) = 75
  if echo "$field" | grep -qi "$query"; then
    echo "75"
    return
  fi

  # Keyword overlap = weighted by overlap %
  local overlap=$(keyword_overlap "$field" "$query")
  echo "$overlap"
}
```

### Title Score (60% weight)

```bash
title_score() {
  local title="$1"
  local query="$2"

  local match=$(match_score "$title" "$query")
  echo $((match * 60 / 100))
}
```

### Context Score (30% weight)

```bash
context_score() {
  local context="$1"
  local query="$2"

  local match=$(match_score "$context" "$query")
  echo $((match * 30 / 100))
}
```

### Tags Score (10% weight)

```bash
tags_score() {
  local tags="$1"  # Space-separated
  local query="$2"

  local best_match=0

  for tag in $tags; do
    local match=$(match_score "$tag" "$query")
    [[ $match -gt $best_match ]] && best_match=$match
  done

  echo $((best_match * 10 / 100))
}
```

### Recency Boost

```bash
recency_boost() {
  local captured_at="$1"  # ISO 8601
  local now=$(date +%s)
  local captured=$(date -d "$captured_at" +%s)
  local age_days=$(( (now - captured) / 86400 ))

  # Boost recent items (< 30 days)
  if [[ $age_days -lt 30 ]]; then
    echo $((30 - age_days))  # 0-30 points
  else
    echo "0"
  fi
}
```

## Complete Ranking

```bash
rank_item() {
  local item="$1"
  local query="$2"

  # Extract fields
  local title=$(echo "$item" | jq -r '.title')
  local context=$(echo "$item" | jq -r '.context.summary // ""')
  local tags=$(echo "$item" | jq -r '.tags[]? // empty' | tr '\n' ' ')
  local categories=$(echo "$item" | jq -r '.categories[]? // empty' | tr '\n' ' ')
  local captured_at=$(echo "$item" | jq -r '.captured_at')

  # Calculate scores
  local t_score=$(title_score "$title" "$query")
  local c_score=$(context_score "$context" "$query")
  local tag_score=$(tags_score "$tags $categories" "$query")
  local recency=$(recency_boost "$captured_at")

  # Total score
  local total=$((t_score + c_score + tag_score + recency))

  echo "$total"
}
```

## Search Implementation

### JSONL Backend

```bash
search_jsonl() {
  local query="$1"
  local results=()

  # Get all items matching query (any field)
  while IFS= read -r item; do
    # Check if item matches
    if echo "$item" | jq -e \
      --arg q "$query" \
      '(.title | ascii_downcase | contains($q | ascii_downcase)) or
       (.context.summary | ascii_downcase | contains($q | ascii_downcase)) or
       (.tags[]? | ascii_downcase | contains($q | ascii_downcase)) or
       (.categories[]? | ascii_downcase | contains($q | ascii_downcase))' \
      > /dev/null; then

      # Rank item
      local score=$(rank_item "$item" "$query")
      local id=$(echo "$item" | jq -r '.id')

      results+=("$score|$id|$item")
    fi
  done < ~/.later/deferred.jsonl

  # Sort by score DESC
  printf '%s\n' "${results[@]}" | sort -t'|' -k1 -rn | cut -d'|' -f3-
}
```

### SQLite Backend (FTS5)

```sql
-- FTS5 provides built-in ranking
SELECT
  d.*,
  f.rank
FROM deferred_fts f
JOIN deferred_items d ON f.id = d.id
WHERE f MATCH 'optimization'
ORDER BY f.rank  -- FTS5 rank (negative = better)
LIMIT 20;
```

**Custom ranking (override FTS5):**
```sql
SELECT
  d.*,
  (
    CASE WHEN d.title LIKE '%optimization%' THEN 60 ELSE 0 END +
    CASE WHEN d.context_summary LIKE '%optimization%' THEN 30 ELSE 0 END +
    (julianday('now') - julianday(d.captured_at)) / 365.0 * 10  -- Recency
  ) AS custom_rank
FROM deferred_items d
WHERE
  d.title LIKE '%optimization%' OR
  d.context_summary LIKE '%optimization%' OR
  d.id IN (SELECT item_id FROM tags WHERE tag LIKE '%optimization%')
ORDER BY custom_rank DESC
LIMIT 20;
```

## Highlighting Matches

```bash
highlight() {
  local text="$1"
  local query="$2"

  # ANSI codes for highlighting
  local BOLD='\033[1m'
  local RESET='\033[0m'

  # Highlight query in text (case-insensitive)
  echo "$text" | sed -E "s/($query)/${BOLD}\1${RESET}/gi"
}
```

**Example output:**
```
Search: "optimization" (3 results)

[1] **Optimize** CLAUDE.md size
    Context: ...User asked about CLAUDE.md token count...
    Match: title, context

[3] Database query **optimization**
    Context: ...Slow queries on large datasets...
    Match: title
```

## Performance Optimization

**Limit candidates:**
```bash
# Only rank items that match query (pre-filter)
# Don't rank all items (expensive)

# Good: O(matches)
grep -i "$query" deferred.jsonl | while read item; do
  rank_item "$item" "$query"
done

# Bad: O(n)
cat deferred.jsonl | while read item; do
  rank_item "$item" "$query"  # Ranks even non-matches
done
```

**Cache keyword extraction:**
```json
{
  "metadata": {
    "keywords": ["optimize", "claude", "md"]
  }
}
```

## Testing

```bash
test_ranking() {
  # Create items
  /later "Optimize database queries"  # Should rank #1
  /later "Database maintenance"       # Should rank #2
  /later "Unrelated item"             # Should rank #3

  # Search
  results=$(search "database")

  # Verify order
  first=$(echo "$results" | head -1 | jq -r '.title')
  assert_equals "$first" "Optimize database queries"
}

test_title_weight() {
  # Title match should beat context match
  /later "Database query optimization"  # Title match
  /later "Refactor auth" --context "Uses database queries internally"  # Context match

  results=$(search "database")
  first=$(echo "$results" | head -1 | jq -r '.title')
  assert_equals "$first" "Database query optimization"
}
```

## Related Documents

- **[Duplicate Detection](duplicate-detection.md)** - Uses similar algorithms
- **[SQLite Schema](../schema/sqlite-schema.md)** - FTS5 index
- **[Search Interface](../../design/user-experience/command-interface.md)** - User-facing search

---

**Status:** Designed, core feature for V1
**Dependencies:** jq (JSONL) or SQLite FTS5
