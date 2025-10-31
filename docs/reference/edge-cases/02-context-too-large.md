# Edge Case: Context Too Large

**Scenario:** Conversation history exceeds practical storage limits

## Problem

Without size limits:
- Multi-hour conversations = 50KB+ context
- File bloat (1000 items × 50KB = 50MB)
- Slow parsing/search
- API costs (large context extraction)

**Example:**
```bash
# After 3-hour debugging session (200+ messages)
/later "Investigate memory leak in worker process"
# Context would be massive, mostly irrelevant
```

## Solution

**Smart context extraction with size limits:**

1. **Target size:** 200-500 words (summary)
2. **Method:** AI summarization (not full transcript)
3. **Fallback:** Last 10 messages if AI unavailable
4. **Max stored:** 2KB per item

**Implementation:**
```bash
extract_context() {
  local title="$1"
  local messages=$(get_last_n_messages 20)  # Not all messages

  # AI summarizes to 200-500 words
  local summary=$(claude_api_summarize "$title" "$messages")

  # Validate size
  local size=${#summary}
  if [[ $size -gt 2048 ]]; then
    # Truncate to 2KB
    summary="${summary:0:2048}..."
  fi

  echo "$summary"
}
```

## User Control

**Skip context entirely:**
```bash
/later "Title" --no-context
# Stores title only, no context extraction
```

**Manual context entry:**
```bash
/later "Title"
# AI extraction fails
> Provide context manually (or press Enter to skip): _
```

## Storage Impact

**With limits:**
- 1000 items × 2KB = 2MB (manageable)
- Fast parsing, fast search
- Reasonable costs

**Without limits:**
- 1000 items × 50KB = 50MB (bloated)
- Slow operations
- High costs

## Testing

```bash
test_context_size_limit() {
  # Generate huge context
  local huge_context=$(head -c 100000 /dev/urandom | base64)

  # Capture with context
  item=$(capture_item "Test" "$huge_context")

  # Verify size
  local stored_size=$(echo "$item" | jq -r '.context.summary' | wc -c)
  assert_less_than "$stored_size" 2048
}
```

## Related

- [Context Extraction](../../technical/implementation/context-extraction.md)
- [Storage Format](../../technical/schema/jsonl-format.md)
