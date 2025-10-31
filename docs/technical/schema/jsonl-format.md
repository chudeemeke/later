# JSONL Format Specification

**Last Updated:** 2025-10-31
**Format Version:** 1.0

## Overview

JSONL (JSON Lines) is the primary storage format for `/later`. Each line is a complete, valid JSON object representing one deferred item.

**Why JSONL:**
- ✅ Human-readable (cat, less, grep all work)
- ✅ Append-friendly (new items added instantly)
- ✅ Corruption-isolated (bad line doesn't corrupt file)
- ✅ Unix-tool compatible (jq, awk, sed work natively)
- ✅ Language-agnostic (works in any language)
- ✅ 10-year stable (plain text never becomes obsolete)

## File Location

```
~/.later/deferred.jsonl         # Active items
~/.later/deferred-archive.jsonl # Archived items
~/.later/backups/               # Timestamped backups
```

## Basic Structure

**Minimal valid item:**
```json
{"id":1,"title":"Optimize CLAUDE.md size","status":"deferred","captured_at":"2025-10-31T14:30:00Z"}
```

**Recommended structure:**
```json
{
  "id": 3,
  "title": "Optimize CLAUDE.md size",
  "status": "deferred",
  "categories": ["optimization", "decision"],
  "tags": ["claude-md", "documentation", "token-efficiency"],
  "priority": "medium",
  "captured_at": "2025-10-31T14:30:00Z",
  "updated_at": "2025-10-31T14:30:00Z",
  "context": {
    "summary": "User asked about CLAUDE.md token count...",
    "conversation_id": "abc123...",
    "last_messages": []
  }
}
```

## Field Specifications

### Required Fields

#### `id` (integer)
- **Type:** Positive integer
- **Uniqueness:** Must be unique within file
- **Generation:** Auto-incrementing, starts at 1
- **Immutable:** Never changes once assigned

**Example:**
```json
{"id": 1}
{"id": 2}
{"id": 3}
```

**ID Assignment:**
```bash
# Get next ID
next_id=$(tail -1 ~/.later/deferred.jsonl | jq -r '.id // 0')
next_id=$((next_id + 1))
```

#### `title` (string)
- **Type:** String
- **Max Length:** 200 characters
- **Constraints:** Plain text, no special formatting
- **Required:** Must be non-empty

**Valid examples:**
```json
{"title": "Optimize CLAUDE.md size"}
{"title": "Refactor auth system for better security"}
```

**Invalid examples:**
```json
{"title": ""}  // Empty not allowed
{"title": "This title is way too long and exceeds the maximum character limit of 200 characters which is enforced to ensure titles remain concise and scannable in list views without requiring truncation or wrapping which would make the interface cluttered and hard to use"}  // > 200 chars
```

#### `status` (string)
- **Type:** Enum
- **Valid Values:**
  - `"deferred"` - Captured, not started
  - `"in_progress"` - Work has begun (linked to todos)
  - `"done"` - Completed
  - `"archived"` - Hidden from active list

**Examples:**
```json
{"status": "deferred"}
{"status": "in_progress"}
{"status": "done"}
{"status": "archived"}
```

**Invalid:**
```json
{"status": "pending"}      // Use "deferred"
{"status": "completed"}    // Use "done"
{"status": "active"}       // Use "in_progress"
```

#### `captured_at` (ISO 8601 datetime)
- **Type:** String in ISO 8601 format
- **Timezone:** UTC (Z suffix)
- **Immutable:** Never changes after creation

**Example:**
```json
{"captured_at": "2025-10-31T14:30:00Z"}
```

**Generation:**
```bash
captured_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

### Optional Fields

#### `categories` (array of strings)
- **Type:** Array of strings
- **Hierarchical:** Use `:` for nesting (e.g., `"optimization:performance"`)
- **Flexible:** No validation, user-defined
- **Default:** Empty array `[]`

**Examples:**
```json
{"categories": ["optimization"]}
{"categories": ["optimization", "optimization:performance"]}
{"categories": ["optimization:performance:database"]}
{"categories": []}
```

#### `tags` (array of strings)
- **Type:** Array of strings
- **Flat:** No hierarchy (unlike categories)
- **Use Case:** Specific attributes, keywords
- **Default:** Empty array `[]`

**Examples:**
```json
{"tags": ["claude-md", "documentation", "token-efficiency"]}
{"tags": ["security", "authentication", "oauth"]}
{"tags": []}
```

#### `priority` (string)
- **Type:** Enum
- **Valid Values:** `"low"`, `"medium"`, `"high"`
- **Default:** `"medium"`

**Examples:**
```json
{"priority": "low"}
{"priority": "medium"}
{"priority": "high"}
```

#### `updated_at` (ISO 8601 datetime)
- **Type:** String in ISO 8601 format
- **Updated:** Every time item is modified
- **Default:** Same as `captured_at`

**Example:**
```json
{"captured_at": "2025-10-31T14:30:00Z", "updated_at": "2025-11-01T10:15:00Z"}
```

#### `context` (object)
- **Type:** Object with nested fields
- **Purpose:** Store decision context for later recall
- **Size Limit:** ~2KB (keep summaries concise)

**Structure:**
```json
{
  "context": {
    "summary": "AI-generated 200-500 word summary",
    "conversation_id": "Link to original conversation",
    "last_messages": ["Last 5-10 messages for reference"],
    "options": ["Option 1", "Option 2", "Option 3"],
    "recommendation": "Recommended approach",
    "key_considerations": ["Factor 1", "Factor 2"]
  }
}
```

**Minimal context:**
```json
{
  "context": {
    "summary": "Manual context entry"
  }
}
```

#### `metadata` (object)
- **Type:** Object with optional fields
- **Purpose:** Structured metadata for filtering/sorting

**Structure:**
```json
{
  "metadata": {
    "complexity": "simple|moderate|complex",
    "time_estimate": "15m|1h|2h|1d|1w|1m",
    "effort": "quick-win|significant-work",
    "impact": "high|medium|low",
    "certainty": "confident|uncertain|speculative"
  }
}
```

#### `depends_on` (array of integers)
- **Type:** Array of item IDs
- **Purpose:** Track dependencies (blockers)
- **Validation:** Must form DAG (no cycles)

**Example:**
```json
{"id": 5, "depends_on": [3, 4]}  // Item 5 blocked by items 3 and 4
```

#### `linked_todos` (array of objects)
- **Type:** Array of todo objects
- **Purpose:** Track TodoWrite items created from this deferred item
- **Bidirectional:** Todos link back to deferred item

**Structure:**
```json
{
  "linked_todos": [
    {"todo_id": 1, "status": "completed"},
    {"todo_id": 2, "status": "in_progress"},
    {"todo_id": 3, "status": "pending"}
  ]
}
```

#### `resolved_by` (string)
- **Type:** Git commit SHA
- **Purpose:** Link to commit that resolved this decision
- **Set When:** Item marked as done

**Example:**
```json
{"status": "done", "resolved_by": "abc123ef456789"}
```

## Complete Example

```json
{
  "id": 3,
  "title": "Optimize CLAUDE.md size",
  "status": "in_progress",
  "categories": ["optimization", "optimization:performance", "decision"],
  "tags": ["claude-md", "documentation", "token-efficiency"],
  "priority": "medium",
  "captured_at": "2025-10-31T14:30:00Z",
  "updated_at": "2025-11-15T09:20:00Z",
  "context": {
    "summary": "User asked about CLAUDE.md token count. Currently 3,343 words (~4,500 tokens). Anthropic guidelines suggest 1,000-5,000 tokens ideal. Options considered: 1) Hybrid (move examples to skills), 2) Minimal (rules only), 3) Keep as-is. Recommendation: Hybrid approach balances clarity with token efficiency. User decided to defer for later review.",
    "conversation_id": "https://claude.ai/chat/abc123...",
    "last_messages": [
      "User: How many tokens is CLAUDE.md now?",
      "Assistant: Current size is 3,343 words (~4,500 tokens)",
      "User: What's Anthropic's recommendation?",
      "Assistant: 1,000-5,000 tokens is ideal...",
      "User: I'll defer this for later"
    ],
    "options": [
      "Hybrid: Move examples to separate skill files",
      "Minimal: Keep only core rules, remove examples",
      "Keep as-is: Accept current size"
    ],
    "recommendation": "Hybrid approach",
    "key_considerations": [
      "Current size: 3,343 words (~4,500 tokens)",
      "Trade-off: Simplicity vs completeness",
      "Examples still accessible via skills"
    ]
  },
  "metadata": {
    "complexity": "moderate",
    "time_estimate": "2h",
    "effort": "significant-work",
    "impact": "medium",
    "certainty": "confident"
  },
  "depends_on": [],
  "linked_todos": [
    {"todo_id": 1, "status": "completed"},
    {"todo_id": 2, "status": "in_progress"},
    {"todo_id": 3, "status": "pending"}
  ],
  "resolved_by": null
}
```

## File Format Rules

### Line Delimiter

**Each item is ONE line:**
```json
{"id":1,"title":"Item 1"}
{"id":2,"title":"Item 2"}
{"id":3,"title":"Item 3"}
```

**NOT multiple lines:**
```json
{
  "id": 1,
  "title": "Item 1"
}
```

**Why:** Append operations, grep, and line-based tools rely on one item = one line.

### Compact JSON

**No pretty-printing:**
```json
{"id":1,"title":"Item 1","status":"deferred"}
```

**Not this:**
```json
{
  "id": 1,
  "title": "Item 1",
  "status": "deferred"
}
```

**Generation:**
```bash
jq -c . <<< '{"id":1,"title":"Item 1"}'  # -c = compact
```

### UTF-8 Encoding

**All files must be UTF-8:**
- No BOM (Byte Order Mark)
- Unix line endings (\n, not \r\n)
- Valid UTF-8 sequences only

### Ordering

**Append-only by default:**
- New items added at end
- ID order may not match line order (after edits)
- Use `jq` to sort by ID if needed:

```bash
jq -s 'sort_by(.id)' deferred.jsonl > sorted.jsonl
```

## Validation

### Schema Validation

**Using jq:**
```bash
validate_item() {
  local line="$1"

  # Check valid JSON
  if ! echo "$line" | jq empty 2>/dev/null; then
    echo "Invalid JSON" >&2
    return 1
  fi

  # Check required fields
  local missing=$(echo "$line" | jq -r '
    [
      (if .id == null then "id" else empty end),
      (if .title == null then "title" else empty end),
      (if .status == null then "status" else empty end),
      (if .captured_at == null then "captured_at" else empty end)
    ] | join(", ")
  ')

  if [[ -n "$missing" ]]; then
    echo "Missing required fields: $missing" >&2
    return 1
  fi

  # Check status enum
  local status=$(echo "$line" | jq -r '.status')
  if [[ ! "$status" =~ ^(deferred|in_progress|done|archived)$ ]]; then
    echo "Invalid status: $status" >&2
    return 1
  fi

  return 0
}
```

### File Validation

**Validate entire file:**
```bash
validate_file() {
  local file="$1"
  local line_num=0
  local errors=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    if ! validate_item "$line"; then
      echo "Error at line $line_num" >&2
      errors=$((errors + 1))
    fi
  done < "$file"

  if [[ $errors -gt 0 ]]; then
    echo "Found $errors invalid items" >&2
    return 1
  fi

  return 0
}
```

## Operations

### Append (Create)

```bash
new_item='{"id":4,"title":"New item","status":"deferred","captured_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'

# Atomic append with lock
flock ~/.later/deferred.jsonl.lock -c \
  "echo '$new_item' >> ~/.later/deferred.jsonl"
```

### Read (by ID)

```bash
item=$(jq -r --arg id "$ID" 'select(.id == ($id | tonumber))' \
  ~/.later/deferred.jsonl)
```

### Update (modify existing)

```bash
# Read all except target
jq -c --arg id "$ID" 'select(.id != ($id | tonumber))' \
  ~/.later/deferred.jsonl > temp.jsonl

# Append updated item
echo "$updated_item" >> temp.jsonl

# Atomic replace
mv temp.jsonl ~/.later/deferred.jsonl
```

### Delete (mark archived)

```bash
# Update status instead of deleting
jq -c --arg id "$ID" '
  if .id == ($id | tonumber)
  then .status = "archived" | .updated_at = now | todate
  else .
  end
' ~/.later/deferred.jsonl > temp.jsonl

mv temp.jsonl ~/.later/deferred.jsonl
```

### Search

```bash
# Search in title, context, tags
jq -r --arg query "$QUERY" '
  select(
    (.title | ascii_downcase | contains($query | ascii_downcase)) or
    (.context.summary | ascii_downcase | contains($query | ascii_downcase)) or
    (.tags[] | ascii_downcase | contains($query | ascii_downcase))
  )
' ~/.later/deferred.jsonl
```

## Migration to SQLite

When migrating from JSONL to SQLite, each line is parsed and inserted:

```bash
while IFS= read -r line; do
  id=$(echo "$line" | jq -r '.id')
  title=$(echo "$line" | jq -r '.title')
  status=$(echo "$line" | jq -r '.status')
  # ... extract all fields

  sqlite3 ~/.later/deferred.db "
    INSERT INTO deferred_items (id, title, status, ...)
    VALUES ($id, '$title', '$status', ...);
  "
done < ~/.later/deferred.jsonl
```

See [migration-guide.md](migration-guide.md) for complete process.

## Related Documents

- **[SQLite Schema](sqlite-schema.md)** - Database structure for scaling
- **[Migration Guide](migration-guide.md)** - JSONL → SQLite process
- **[Storage Mechanism](../../architecture/decisions/storage-mechanism.md)** - Why JSONL

---

**Format Version:** 1.0 (stable)
**Compatibility:** Backward-compatible additions only
