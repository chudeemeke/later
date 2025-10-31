# Duplicate Detection Implementation

**Last Updated:** 2025-10-31
**Purpose:** Prevent cluttered list by detecting similar captures

## Overview

Fuzzy duplicate detection uses multiple algorithms to identify similar items:
1. **Levenshtein distance** (title similarity)
2. **Keyword overlap** (content similarity)
3. **Temporal proximity** (recent captures prioritized)

**Key principle:** Offer update instead of creating duplicates, but let user override.

## Detection Flow

```
User captures: "Optimize CLAUDE.md"
     │
     ▼
┌────────────────────────────────────────────┐
│ 1. Get recent items (last 50, deferred)   │
└────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│ 2. Fuzzy match title                       │
│    - Levenshtein distance < 20%            │
└────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│ 3. Keyword overlap                         │
│    - Extract keywords, compare             │
│    - Overlap > 80% = similar               │
└────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│ 4. Score similarity (0-100)                │
│    - Weight: title 60%, keywords 40%       │
└────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│ 5. Offer options if similar                │
│    - Update existing                       │
│    - Create new anyway                     │
│    - View existing first                   │
└────────────────────────────────────────────┘
```

## Levenshtein Distance

**Algorithm:** Minimum edits to transform string A → B.

```bash
levenshtein() {
  local s1="$1"
  local s2="$2"
  local len1=${#s1}
  local len2=${#s2}

  # Initialize matrix
  declare -A matrix

  for ((i=0; i<=len1; i++)); do
    matrix[$i,0]=$i
  done

  for ((j=0; j<=len2; j++)); do
    matrix[0,$j]=$j
  done

  # Fill matrix
  for ((i=1; i<=len1; i++)); do
    for ((j=1; j<=len2; j++)); do
      local cost=1
      [[ "${s1:i-1:1}" == "${s2:j-1:1}" ]] && cost=0

      local deletion=$((matrix[$((i-1)),$j] + 1))
      local insertion=$((matrix[$i,$((j-1))] + 1))
      local substitution=$((matrix[$((i-1)),$((j-1))] + cost))

      matrix[$i,$j]=$(min $deletion $insertion $substitution)
    done
  done

  echo "${matrix[$len1,$len2]}"
}

# Calculate percentage
levenshtein_percent() {
  local s1="$1"
  local s2="$2"
  local distance=$(levenshtein "$s1" "$s2")
  local max_len=$(max ${#s1} ${#s2})

  echo $((distance * 100 / max_len))
}
```

**Example:**
```bash
levenshtein_percent "Optimize CLAUDE.md" "Optimize CLAUDE.md size"
# Output: 15 (15% different, 85% similar)
```

## Keyword Overlap

**Extract keywords (stop words removed):**
```bash
extract_keywords() {
  local text="$1"

  # Lowercase, remove punctuation
  text=$(echo "$text" | tr '[:upper:]' '[:lower:]' | tr -d '[:punct:]')

  # Split into words
  local words=($text)

  # Remove stop words
  local stop_words=("the" "a" "an" "and" "or" "but" "is" "are" "of" "to" "in" "for")
  local keywords=()

  for word in "${words[@]}"; do
    if [[ ! " ${stop_words[@]} " =~ " ${word} " ]]; then
      keywords+=("$word")
    fi
  done

  echo "${keywords[@]}"
}

# Calculate overlap percentage
keyword_overlap() {
  local text1="$1"
  local text2="$2"

  local keywords1=($(extract_keywords "$text1"))
  local keywords2=($(extract_keywords "$text2"))

  # Count common keywords
  local common=0
  for kw1 in "${keywords1[@]}"; do
    for kw2 in "${keywords2[@]}"; do
      [[ "$kw1" == "$kw2" ]] && common=$((common + 1))
    done
  done

  # Calculate percentage
  local total=$((${#keywords1[@]} + ${#keywords2[@]} - common))
  echo $((common * 100 / total))
}
```

**Example:**
```bash
keyword_overlap "Optimize CLAUDE.md" "Optimize CLAUDE.md size"
# Common: optimize, claude, md (3)
# Total: optimize, claude, md, size (4)
# Output: 75 (75% overlap)
```

## Similarity Scoring

**Combine metrics:**
```bash
similarity_score() {
  local title1="$1"
  local title2="$2"
  local context1="$3"
  local context2="$4"

  # Title similarity (60% weight)
  local title_lev=$(levenshtein_percent "$title1" "$title2")
  local title_score=$((100 - title_lev))  # Invert (higher = more similar)

  # Keyword overlap (40% weight)
  local text1="$title1 $context1"
  local text2="$title2 $context2"
  local keyword_score=$(keyword_overlap "$text1" "$text2")

  # Weighted average
  local total_score=$(( (title_score * 60 + keyword_score * 40) / 100 ))

  echo "$total_score"
}
```

**Thresholds:**
- **> 80:** Very similar (strong duplicate candidate)
- **60-80:** Similar (warn user)
- **< 60:** Different (no warning)

## Implementation

```bash
check_duplicates() {
  local title="$1"
  local context="$2"

  # Get recent deferred items (last 50)
  local candidates=$(jq -r 'select(.status == "deferred") |
    [.id, .title, .context.summary // ""] | @tsv' \
    ~/.later/deferred.jsonl | tail -50)

  local best_match_id=""
  local best_match_score=0
  local best_match_title=""

  # Check each candidate
  while IFS=$'\t' read -r id candidate_title candidate_context; do
    local score=$(similarity_score "$title" "$candidate_title" \
      "$context" "$candidate_context")

    if [[ $score -gt $best_match_score ]]; then
      best_match_score=$score
      best_match_id=$id
      best_match_title=$candidate_title
    fi
  done <<< "$candidates"

  # If similarity > 80%, offer options
  if [[ $best_match_score -gt 80 ]]; then
    echo "⚠️  Similar item exists:" >&2
    echo "  [$best_match_id] $best_match_title (${best_match_score}% similar)" >&2
    echo >&2
    echo "Options:" >&2
    echo "  [U]pdate existing with new context" >&2
    echo "  [C]reate new item anyway" >&2
    echo "  [V]iew existing first" >&2
    echo "  [A]bort" >&2
    echo >&2

    read -p "Choice [U/c/v/a]: " -n 1 -r
    echo

    case $REPLY in
      U|u|"")
        return $best_match_id  # Return ID to update
        ;;
      C|c)
        return 0  # Proceed with create
        ;;
      V|v)
        /later show "$best_match_id"
        check_duplicates "$title" "$context"  # Ask again
        ;;
      A|a)
        return 255  # Abort
        ;;
    esac
  fi

  return 0  # No duplicates, proceed
}
```

## Performance Optimization

**Only check recent items:**
```bash
# Check last 50 deferred items (not all 1000+)
candidates=$(... | tail -50)
```

**Why 50:**
- Duplicates most likely in recent captures
- Avoids O(n²) comparison on large datasets
- Fast enough (< 50ms for 50 items)

**Cache keyword extraction:**
```bash
# Store keywords in item metadata
"metadata": {
  "keywords": ["optimize", "claude", "md"]
}

# Reuse for duplicate detection
```

## Skip Detection (Power User)

```bash
/later "Title" --force
# Skips duplicate detection
```

**Use case:**
- User knows it's not a duplicate
- Batch captures (scripts)
- Performance-critical operations

## Testing

```bash
test_levenshtein() {
  local dist=$(levenshtein "kitten" "sitting")
  assert_equals "$dist" "3"  # k→s, e→i, insert g
}

test_duplicate_detection() {
  # Create item
  /later "Optimize CLAUDE.md"

  # Attempt duplicate
  output=$(/later "Optimize CLAUDE.md size" 2>&1)

  # Should warn
  assert_contains "$output" "Similar item exists"
}

test_force_flag() {
  /later "Item 1"
  /later "Item 1" --force  # Should not warn

  count=$(wc -l < ~/.later/deferred.jsonl)
  assert_equals "$count" "2"
}
```

## Related Documents

- **[Context Extraction](context-extraction.md)** - Provides context for comparison
- **[Search Ranking](search-ranking.md)** - Uses similar algorithms
- **[Command Interface](../../design/user-experience/command-interface.md)** - --force flag

---

**Status:** Designed, pending implementation
**Dependencies:** jq, bash 4.0+
