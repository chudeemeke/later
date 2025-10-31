# Context Extraction Implementation

**Last Updated:** 2025-10-31
**Purpose:** Capture decision context automatically using AI

## Overview

Context extraction uses Claude API to generate concise summaries (200-500 words) from conversation history. This provides future you with enough context to understand the deferred decision without reading the entire conversation.

**Key principle:** Practical storage size with sufficient detail.

## Extraction Flow

```
User captures decision
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 1. Gather conversation history                     │
│    - Last 20 messages                               │
│    - Or specific range if provided                  │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 2. Build extraction prompt                         │
│    - Include title for context                      │
│    - Request structured output                      │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 3. Call Claude API (Haiku 4.5)                     │
│    - Cost-effective model                           │
│    - Fast response (< 2s)                           │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 4. Parse and validate response                     │
│    - Check JSON structure                           │
│    - Validate required fields                       │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 5. Fallback on failure                             │
│    - Use simple extraction (last 10 messages)       │
│    - Or prompt user for manual context              │
└─────────────────────────────────────────────────────┘
```

## Prompt Template

```
You are summarizing a conversation to help the user revisit a deferred decision later.

Conversation History:
{last_20_messages}

Deferred Decision: "{title}"

Provide a structured summary (200-500 words):

1. **What decision is being deferred**
   - Clear statement of the decision or question

2. **Options considered** (if any)
   - List alternatives discussed
   - Key differences between options

3. **Pros and cons** (if discussed)
   - Trade-offs mentioned
   - Important factors

4. **Recommendation made** (if any)
   - What was suggested and why
   - Level of confidence

5. **Why deferred**
   - Timing, uncertainty, dependencies
   - What information is missing

Return JSON:
{
  "summary": "Full summary text",
  "options": ["Option 1", "Option 2"],
  "recommendation": "Recommendation with reasoning",
  "key_considerations": ["Factor 1", "Factor 2"],
  "deferral_reason": "Why this was deferred"
}

Keep it concise but comprehensive. Focus on decision-relevant information.
```

## Implementation

```bash
extract_context() {
  local title="$1"
  local conversation_id="${2:-}"

  # Gather last 20 messages
  local messages=$(get_conversation_history "$conversation_id" 20)

  # Build prompt
  local prompt=$(cat <<EOF
You are summarizing a conversation for later review.

Conversation History:
$messages

Deferred Decision: "$title"

[Full prompt template here...]
EOF
)

  # Call Claude API (Haiku 4.5)
  local response=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-haiku-4-5\",
      \"max_tokens\": 1000,
      \"messages\": [{
        \"role\": \"user\",
        \"content\": \"$prompt\"
      }]
    }")

  # Parse response
  local content=$(echo "$response" | jq -r '.content[0].text')

  # Validate JSON structure
  if echo "$content" | jq empty 2>/dev/null; then
    echo "$content"
    return 0
  else
    # Fallback to simple extraction
    simple_extract "$messages"
    return 1
  fi
}
```

## Fallback Strategies

### Strategy 1: Simple Extraction (Last 10 Messages)

```bash
simple_extract() {
  local messages="$1"

  # Take last 10 messages, format as plain text
  local context=$(echo "$messages" | tail -10 | \
    awk '{print "- " $0}')

  # Return structured format
  cat <<EOF
{
  "summary": "Conversation context (last 10 messages):\\n$context",
  "options": [],
  "recommendation": "",
  "key_considerations": [],
  "deferral_reason": ""
}
EOF
}
```

### Strategy 2: Manual Entry

```bash
manual_context() {
  local title="$1"

  echo "AI context extraction unavailable."
  echo "Please provide context manually (or skip with Enter):"
  echo
  read -p "Context: " manual_context

  if [[ -z "$manual_context" ]]; then
    manual_context="No context provided"
  fi

  cat <<EOF
{
  "summary": "$manual_context",
  "options": [],
  "recommendation": "",
  "key_considerations": [],
  "deferral_reason": ""
}
EOF
}
```

### Strategy 3: Cached Context (Same Session)

```bash
# Cache conversation context for 5 minutes
CONTEXT_CACHE_FILE="/tmp/later-context-cache"
CONTEXT_CACHE_TTL=300  # 5 minutes

get_cached_context() {
  if [[ -f "$CONTEXT_CACHE_FILE" ]]; then
    local cache_age=$(($(date +%s) - $(stat -f %m "$CONTEXT_CACHE_FILE")))

    if [[ $cache_age -lt $CONTEXT_CACHE_TTL ]]; then
      cat "$CONTEXT_CACHE_FILE"
      return 0
    fi
  fi

  return 1
}

cache_context() {
  local context="$1"
  echo "$context" > "$CONTEXT_CACHE_FILE"
}
```

**Use case:** Multiple captures in same session reuse context.

## Cost Optimization

**Model selection:**
- **Haiku 4.5** - $1/$5 per million tokens (input/output)
- Per extraction: ~500 input + ~300 output tokens
- Cost per extraction: ~$0.0012

**Caching:**
- Prompt caching (90% savings on repeated context)
- First call: $0.0012
- Cached calls: $0.00012 (10x cheaper)

**Budget calculation:**
```
1000 captures/year * $0.0012 = $1.20/year
With caching (50% reuse): $0.60/year
```

**Conclusion:** Negligible cost for personal use.

## Security Considerations

### Secret Sanitization

```bash
sanitize_secrets() {
  local text="$1"

  # Patterns to detect
  local patterns=(
    "sk-[a-zA-Z0-9]{32,}"           # API keys (sk-...)
    "ghp_[a-zA-Z0-9]{36}"            # GitHub tokens
    "[a-zA-Z0-9]{40}"                # SHA tokens
    "-----BEGIN [A-Z ]+ KEY-----"   # PEM keys
  )

  # Replace with placeholders
  for pattern in "${patterns[@]}"; do
    text=$(echo "$text" | sed -E "s/$pattern/[REDACTED]/g")
  done

  echo "$text"
}
```

### User Warnings

```bash
detect_secrets() {
  local text="$1"

  if echo "$text" | grep -qE "sk-|ghp_|BEGIN.*KEY"; then
    echo "⚠️  Warning: Potential secrets detected in context" >&2
    echo "   Secrets will be sanitized before storage" >&2
    echo "   Use --no-context to skip context extraction" >&2
    return 1
  fi

  return 0
}
```

## Testing

### Unit Tests

```bash
test_extract_context() {
  local title="Test decision"
  local mock_response='{
    "summary": "Test summary",
    "options": ["A", "B"],
    "recommendation": "Choose A",
    "key_considerations": ["Cost", "Speed"],
    "deferral_reason": "Need more data"
  }'

  # Mock API call
  export MOCK_API_RESPONSE="$mock_response"

  # Extract
  local result=$(extract_context "$title")

  # Validate
  assert_equals "$(echo "$result" | jq -r '.summary')" "Test summary"
  assert_equals "$(echo "$result" | jq -r '.options[0]')" "A"
}
```

### Integration Tests

```bash
test_fallback_on_api_failure() {
  # Simulate API failure
  unset ANTHROPIC_API_KEY

  # Should fall back to simple extraction
  local result=$(extract_context "Test" <<< "Message 1\nMessage 2")

  # Validate fallback used
  assert_contains "$(echo "$result" | jq -r '.summary')" "Message 1"
}
```

## Related Documents

- **[Duplicate Detection](duplicate-detection.md)** - Uses extracted context
- **[Search Ranking](search-ranking.md)** - Searches context summary
- **[Security Considerations](../../reference/security-considerations.md)** - Secret handling

---

**Status:** Designed, pending implementation
**Dependencies:** Claude API access, jq
