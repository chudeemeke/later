# Dependency Tracking Implementation

**Last Updated:** 2025-10-31
**Purpose:** Track item dependencies (DAG structure)

## Overview

Dependencies allow marking items that block others. Must form a Directed Acyclic Graph (DAG) - no circular dependencies.

**Key principle:** Optional feature (most items are independent), but powerful when needed.

## Data Structure

```json
{
  "id": 5,
  "title": "Migrate to plugin architecture",
  "depends_on": [3, 4]  // Blocked by items 3 and 4
}
```

**Reverse query:**
```sql
-- SQLite: What depends on item 3?
SELECT item_id FROM dependencies WHERE depends_on_id = 3;

-- JSONL:
jq -r 'select(.depends_on[]? == 3) | .id' deferred.jsonl
```

## DAG Validation (Cycle Detection)

**Algorithm:** Depth-First Search with recursion stack.

```bash
# Build adjacency list
declare -A graph
declare -A visited
declare -A rec_stack

build_graph() {
  # JSONL backend
  while read -r line; do
    id=$(echo "$line" | jq -r '.id')
    deps=$(echo "$line" | jq -r '.depends_on[]? // empty')

    graph[$id]="$deps"
  done < ~/.later/deferred.jsonl
}

# DFS cycle detection
has_cycle() {
  local node="$1"

  visited[$node]=1
  rec_stack[$node]=1

  # Visit dependencies
  for dep in ${graph[$node]}; do
    if [[ -z "${visited[$dep]}" ]]; then
      if has_cycle "$dep"; then
        return 0  # Cycle found
      fi
    elif [[ -n "${rec_stack[$dep]}" ]]; then
      return 0  # Back edge = cycle
    fi
  done

  unset rec_stack[$node]
  return 1  # No cycle
}

# Validate entire graph
validate_dag() {
  build_graph

  for node in "${!graph[@]}"; do
    unset visited
    unset rec_stack

    if has_cycle "$node"; then
      echo "ERROR: Circular dependency detected involving item #$node" >&2
      return 1
    fi
  done

  return 0  # Valid DAG
}
```

## Adding Dependency

```bash
add_dependency() {
  local item_id="$1"
  local depends_on_id="$2"

  # Validate IDs exist
  if ! item_exists "$item_id"; then
    echo "ERROR: Item #$item_id does not exist" >&2
    return 1
  fi

  if ! item_exists "$depends_on_id"; then
    echo "ERROR: Item #$depends_on_id does not exist" >&2
    return 1
  fi

  # Can't depend on self
  if [[ $item_id -eq $depends_on_id ]]; then
    echo "ERROR: Item cannot depend on itself" >&2
    return 1
  fi

  # Test for cycles (before adding)
  temp_graph=$(cat ~/.later/deferred.jsonl)
  temp_graph=$(echo "$temp_graph" | jq --arg id "$item_id" --arg dep "$depends_on_id" \
    'if .id == ($id | tonumber)
     then .depends_on += [($dep | tonumber)]
     else .
     end')

  # Validate with temporary addition
  if ! validate_dag_json "$temp_graph"; then
    echo "ERROR: Adding this dependency would create a cycle" >&2
    echo >&2
    echo "Dependency chain:" >&2
    show_cycle "$item_id" "$depends_on_id"
    return 1
  fi

  # Safe to add
  update_item "$item_id" ".depends_on += [$depends_on_id]"
  echo "✅ Dependency added: #$item_id depends on #$depends_on_id"
}
```

## Cycle Detection Example

```
User attempts: /later edit 5 --depends-on 12

Current dependencies:
  3 → 5 → 12 → 3  (would create cycle)

Error message:
  ERROR: Cannot add dependency #5 → #12

  This creates a circular dependency:
    #3 depends on #5
    #5 depends on #12
    #12 depends on #3  ← Creates cycle

  Dependency chains must be acyclic (no loops).

  To fix:
    1. Remove existing dependency: /later edit 12 --remove-depends-on 3
    2. Or choose different dependency for #5
```

## Dependency Chain Visualization

```bash
show_deps() {
  local item_id="$1"
  local depth="${2:-0}"
  local visited="${3:-}"

  # Prevent infinite loop
  if [[ " $visited " =~ " $item_id " ]]; then
    echo "${indent}#$item_id (circular reference detected)"
    return 1
  fi

  visited="$visited $item_id"
  local indent=$(printf "%*s" $((depth * 2)) "")

  # Get item details
  local title=$(get_item_title "$item_id")
  local status=$(get_item_status "$item_id")

  echo "${indent}#$item_id: $title [$status]"

  # Get dependencies
  local deps=$(get_item_deps "$item_id")

  if [[ -n "$deps" ]]; then
    echo "${indent}  Depends on:"
    for dep in $deps; do
      show_deps "$dep" $((depth + 1)) "$visited"
    done
  fi
}
```

**Example output:**
```
$ /later show 5 --deps

#5: Migrate to plugin architecture [deferred]
  Depends on:
    #3: Refactor config system [in_progress]
      Depends on:
        #1: Update dependencies [done]
    #4: Create plugin interface [deferred]
```

## Topological Sort (Execution Order)

```bash
topo_sort() {
  local -A in_degree
  local queue=()
  local result=()

  build_graph

  # Calculate in-degrees
  for node in "${!graph[@]}"; do
    in_degree[$node]=0
  done

  for node in "${!graph[@]}"; do
    for dep in ${graph[$node]}; do
      in_degree[$dep]=$((in_degree[$dep] + 1))
    done
  done

  # Queue nodes with in-degree 0
  for node in "${!in_degree[@]}"; do
    if [[ ${in_degree[$node]} -eq 0 ]]; then
      queue+=("$node")
    fi
  done

  # Process queue
  while [[ ${#queue[@]} -gt 0 ]]; do
    local node="${queue[0]}"
    queue=("${queue[@]:1}")
    result+=("$node")

    for dep in ${graph[$node]}; do
      in_degree[$dep]=$((in_degree[$dep] - 1))
      if [[ ${in_degree[$dep]} -eq 0 ]]; then
        queue+=("$dep")
      fi
    done
  done

  # Check if all nodes processed
  if [[ ${#result[@]} -ne ${#graph[@]} ]]; then
    echo "ERROR: Cycle detected (topological sort failed)" >&2
    return 1
  fi

  echo "${result[@]}"
}
```

**Use case:** Show optimal execution order.

```bash
$ /later list --topo-sort

Recommended execution order:
  1. #1: Update dependencies [done]
  2. #3: Refactor config system [in_progress]
  3. #4: Create plugin interface [deferred]
  4. #5: Migrate to plugin architecture [deferred]
```

## Auto-Complete on Done

```bash
# When item marked done, check if any blocked items can proceed
on_item_done() {
  local item_id="$1"

  # Find items depending on this one
  local blocked_items=$(jq -r --arg id "$item_id" \
    'select(.depends_on[]? == ($id | tonumber)) | .id' \
    ~/.later/deferred.jsonl)

  for blocked_id in $blocked_items; do
    # Check if all dependencies are done
    local all_done=true
    local deps=$(get_item_deps "$blocked_id")

    for dep in $deps; do
      local dep_status=$(get_item_status "$dep")
      if [[ "$dep_status" != "done" ]]; then
        all_done=false
        break
      fi
    done

    if $all_done; then
      echo "✅ Item #$blocked_id is now unblocked (all dependencies done)" >&2
    fi
  done
}
```

## Testing

```bash
test_cycle_detection() {
  # Create cycle: 1 → 2 → 3 → 1
  /later "Item 1"
  /later "Item 2" --depends-on 1
  /later "Item 3" --depends-on 2

  # Attempt to close cycle
  output=$(/later edit 1 --depends-on 3 2>&1)

  assert_contains "$output" "circular dependency"
}

test_topo_sort() {
  # Create chain: 1 → 2 → 3
  /later "Item 1"
  /later "Item 2" --depends-on 1
  /later "Item 3" --depends-on 2

  order=$(topo_sort)
  assert_equals "$order" "1 2 3"
}
```

## Related Documents

- **[Schema Evolution](../../architecture/decisions/schema-evolution.md)** - Optional feature design
- **[SQLite Schema](../schema/sqlite-schema.md)** - Dependencies table

---

**Status:** Designed, optional feature (MVP can skip)
**Complexity:** Moderate (graph algorithms required)
