# Edge Case: Context Insufficient

**Scenario:** Captured context doesn't provide enough information to revisit decision

## Problem

**Context extracted but inadequate:**
```json
{
  "id": 42,
  "title": "Optimize database queries",
  "context": {
    "summary": "User mentioned slow queries."
  }
}
```

**Missing critical info:**
- Which queries are slow?
- What performance target?
- What approaches were considered?

**Result:** Can't make informed decision later.

## Solution

### 1. AI-Powered Context Extraction (Best Case)

**Comprehensive summary:**
```json
{
  "context": {
    "summary": "User reported slow queries on user_events table...",
    "options": [
      "Add composite index on (user_id, timestamp)",
      "Partition table by month",
      "Implement query result caching"
    ],
    "recommendation": "Start with composite index (quick win)",
    "key_considerations": [
      "Query: SELECT * FROM user_events WHERE user_id = ? ORDER BY timestamp",
      "Current time: 2.5s avg",
      "Target: < 100ms",
      "Table size: 50M rows"
    ],
    "deferral_reason": "Need to test index impact on write performance first"
  }
}
```

### 2. Manual Context Enhancement

**If AI extraction insufficient:**
```bash
/later edit 42 --add-context

Current context:
  User mentioned slow queries.

Add details:
  [Paste additional context or press Enter to skip]
> Query: SELECT * FROM user_events WHERE user_id = ? ORDER BY timestamp
> Current: 2.5s, Target: < 100ms
> Options: index, partitioning, caching
> Decision: Test composite index first
>
✅ Context updated
```

### 3. Link to Original Conversation

```bash
/later show 42

Context:
  [Summary]

Full conversation:
  https://claude.ai/chat/abc123...
  (Click to review full discussion)
```

### 4. Conversation Snapshot

**Store key messages verbatim:**
```json
{
  "context": {
    "summary": "...",
    "last_messages": [
      "User: Database queries are taking 2.5 seconds",
      "Assistant: Which query specifically?",
      "User: user_events filtered by user_id, ordered by timestamp",
      "Assistant: Composite index would help. Want me to draft the SQL?",
      "User: Let me test the impact first, defer for now"
    ]
  }
}
```

## Detection

**Identify insufficient context:**
```bash
check_context_quality() {
  local item="$1"
  local context=$(echo "$item" | jq -r '.context.summary')

  # Heuristics for insufficient context
  local word_count=$(echo "$context" | wc -w)
  local has_options=$(echo "$item" | jq '.context.options | length')

  if [[ $word_count -lt 50 ]]; then
    echo "WARNING: Context seems brief" >&2
    return 1
  fi

  if [[ $has_options -eq 0 ]]; then
    echo "TIP: Add options considered for better context" >&2
    return 1
  fi

  return 0
}
```

**Prompt for enhancement:**
```bash
/later "Optimize database queries"

⚠️  Context extraction provided minimal information.
   Add more context manually? [Y/n] _
```

## User Education

**After first capture:**
```
✅ Captured as item #1

💡 Tip: Good context includes:
   - What decision you're making
   - Options you considered
   - Why you're deferring it

   Review: /later show 1
   Edit: /later edit 1 --add-context
```

## Fallback Strategies

**1. Store more messages:**
```bash
# Increase from 10 to 20 messages
get_last_n_messages 20
```

**2. User-provided context:**
```bash
/later "Title" --context "Detailed context here..."
```

**3. No-context mode:**
```bash
/later "Title" --no-context
# Just stores title as reminder
# User provides context when ready to act
```

## Testing

```bash
test_context_quality_check() {
  # Minimal context
  item='{"context":{"summary":"Brief"}}'

  output=$(check_context_quality "$item" 2>&1)
  assert_contains "$output" "Context seems brief"
}

test_manual_context_addition() {
  later "Test item"

  later edit 1 --add-context <<< "Detailed context here"

  context=$(later show 1 --format json | jq -r '.context.summary')
  assert_contains "$context" "Detailed context"
}
```

## Related

- [Context Extraction](../../technical/implementation/context-extraction.md)
- [Command Interface](../../design/user-experience/command-interface.md)
