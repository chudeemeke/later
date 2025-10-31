# Edge Case: Circular Dependencies

**Scenario:** User creates dependency cycle (A → B → C → A)

## Problem

Circular dependencies are **logically impossible** to resolve:
- Can't do A (blocked by C)
- Can't do C (blocked by B)
- Can't do B (blocked by A)

**Example:**
```bash
/later "Refactor API" --depends-on 5
/later "Update docs" --depends-on 3  # Item 5
/later edit 3 --depends-on 7         # Item 7
/later edit 7 --depends-on 3         # Creates cycle: 3→7→5→3
```

## Solution

**Detect cycles BEFORE adding dependency** using Depth-First Search:

```bash
has_cycle() {
  local node="$1"
  local visited="$2"
  local rec_stack="$3"

  # Already in recursion stack = cycle
  if [[ " $rec_stack " =~ " $node " ]]; then
    return 0  # Cycle found
  fi

  # Already visited this path
  if [[ " $visited " =~ " $node " ]]; then
    return 1  # No cycle in this path
  fi

  visited="$visited $node"
  rec_stack="$rec_stack $node"

  # Check dependencies
  local deps=$(get_item_deps "$node")
  for dep in $deps; do
    if has_cycle "$dep" "$visited" "$rec_stack"; then
      return 0  # Cycle found in sub-graph
    fi
  done

  return 1  # No cycle
}
```

**User experience:**
```bash
/later edit 7 --depends-on 3

ERROR: Cannot add dependency #7 → #3

This creates a circular dependency:
  #3 depends on #7
  #7 depends on #5
  #5 depends on #3  ← Creates cycle

Dependency chains must be acyclic (no loops).

To fix:
  1. Remove existing dependency: /later edit 5 --remove-depends-on 3
  2. Or choose different dependency for #7

View dependency graph: /later show 7 --deps
```

## Visualization

**Show full dependency chain:**
```bash
/later show 3 --deps

#3: Refactor API [deferred]
  Depends on:
    #7: Update infrastructure [in_progress]
      Depends on:
        #5: Migrate database [deferred]
          Depends on:
            #3 ← CIRCULAR!
```

## Prevention

**Validate on every dependency operation:**
1. Add dependency → Validate DAG
2. Remove dependency → Always safe (reduces edges)
3. Bulk operations → Validate after each change

**Design principle:** Fail fast, explain clearly, offer fix.

## Recovery

**If cycle detected in existing data:**
```bash
validate_dag
ERROR: Circular dependency detected

Affected items:
  #3 → #7 → #5 → #3

Automatic fix:
  Remove newest dependency? (#5 → #3) [Y/n]
```

## Testing

```bash
test_cycle_prevention() {
  /later "Item A"  # ID 1
  /later "Item B" --depends-on 1  # 2→1
  /later "Item C" --depends-on 2  # 3→2→1

  # Attempt cycle
  result=$(/later edit 1 --depends-on 3 2>&1)

  assert_contains "$result" "circular dependency"
  assert_failure_exit_code
}

test_complex_cycle() {
  # A→B, B→C, C→D, D→E
  /later "A"; /later "B" --depends-on 1; /later "C" --depends-on 2
  /later "D" --depends-on 3; /later "E" --depends-on 4

  # E→A would create: A→B→C→D→E→A
  result=$(/later edit 5 --depends-on 1 2>&1)
  assert_contains "$result" "circular"
}
```

## Related

- [Dependency Tracking](../../technical/implementation/dependency-tracking.md)
- [DAG Validation](../../technical/implementation/dependency-tracking.md#dag-validation)
