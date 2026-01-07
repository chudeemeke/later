# Plan: Fix Windows-Specific Test Failures

## Overview

Fix 59 test failures on Windows/Git-Bash caused by:

1. **CLI E2E Tests** - Unix shell syntax and hardcoded `/tmp` paths
2. **Concurrency Tests** - Already skipped on Windows (file locking differences)
3. **Timeout/Performance Tests** - I/O contention and stale temp files

## Root Cause Analysis

### Issue 1: CLI E2E Tests (PRIMARY - 20+ failures)

**File:** `tests/cli/integration/cli.test.ts`

**Problems:**

1. **Line 11:** Hardcoded `/tmp` path doesn't exist on Windows

   ```typescript
   const TEST_BASE_DIR = path.join("/tmp", `later-cli-test-${Date.now()}`);
   ```

2. **Lines 31-219 (20 occurrences):** Unix shell syntax for env vars
   ```typescript
   `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "..."`;
   ```

   - This syntax only works on Unix shells (bash/sh)
   - Windows shells (PowerShell/cmd.exe) don't recognize `VAR=value command`
   - Even Git-Bash fails when executed through Node's `exec()`

**Key Insight:** The source code uses `os.homedir()` NOT `process.env.HOME`, so the env var injection is unnecessary AND broken on Windows.

### Issue 2: Concurrency Tests (ALREADY HANDLED)

**File:** `tests/integration/concurrency.test.ts`

**Status:** Already skipped on Windows via:

```typescript
const isWindows = process.platform === "win32";
const describeUnixOnly = isWindows ? describe.skip : describe;
```

**Root Cause:** Windows mandatory file locks vs Unix advisory locks cause race conditions that can't be reliably fixed without architectural changes (SQLite migration).

**No action needed** - tests appropriately skipped.

### Issue 3: Performance Tests (SECONDARY)

**File:** `tests/integration/performance.test.ts`

**Problems:**

1. ENOTEMPTY errors from stale `.tmp.*` files left by failed operations
2. Aggressive timing assertions (50ms, 100ms targets) fail on slower I/O
3. Already excluded from CI via `jest.config.ci.js`

---

## Implementation Plan

### Phase 1: Fix CLI E2E Tests (Primary Fix)

#### Step 1.1: Create cross-platform exec helper

**File:** `tests/cli/integration/cli.test.ts`

Add utility function that passes env vars via `exec()` options instead of shell syntax:

```typescript
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

// Cross-platform exec with environment variables
function execWithEnv(
  command: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        // Attach stdout/stderr to error for debugging
        const enhancedError = error as Error & {
          stdout: string;
          stderr: string;
        };
        enhancedError.stdout = stdout;
        enhancedError.stderr = stderr;
        reject(enhancedError);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
```

#### Step 1.2: Fix hardcoded `/tmp` path

**Change:**

```typescript
// BEFORE (Line 11)
const TEST_BASE_DIR = path.join("/tmp", `later-cli-test-${Date.now()}`);

// AFTER
const TEST_BASE_DIR = path.join(os.tmpdir(), `later-cli-test-${Date.now()}`);
```

#### Step 1.3: Replace all Unix env var syntax (20 occurrences)

**Pattern to find:** `HOME=${TEST_BASE_DIR}`

**Change each occurrence from:**

```typescript
const { stdout } = await execAsync(
  `HOME=${TEST_BASE_DIR} ${CLI_PATH} capture "Integration test decision"`,
);
```

**To:**

```typescript
const { stdout } = await execWithEnv(
  `${CLI_PATH} capture "Integration test decision"`,
  { ...process.env, HOME: TEST_BASE_DIR },
);
```

#### Step 1.4: Handle Windows path in CLI_PATH

The CLI path may need adjustment for Windows:

```typescript
// Ensure CLI path works on Windows
const CLI_PATH = path.resolve(process.cwd(), "bin", "later");
```

### Phase 2: Fix Performance Test Cleanup (Secondary)

#### Step 2.1: Improve temp file cleanup in afterEach

**File:** `tests/integration/performance.test.ts`

Add retry logic for directory cleanup on Windows:

```typescript
afterEach(async () => {
  // Retry cleanup with delay for Windows file handle release
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
      break;
    } catch (error: any) {
      if (error.code === "ENOTEMPTY" && i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      // Ignore cleanup errors on final attempt
    }
  }
});
```

#### Step 2.2: Skip performance tests on Windows (optional)

If cleanup issues persist, add platform skip:

```typescript
const isWindows = process.platform === 'win32';
const describePerf = isWindows ? describe.skip : describe;

describePerf('Performance Benchmarks', () => { ... });
```

### Phase 3: Verify and Test

#### Step 3.1: Run tests on Windows

```bash
bun test tests/cli/integration/cli.test.ts
```

#### Step 3.2: Run full test suite

```bash
bun test
```

#### Step 3.3: Verify CI passes on both platforms

- Push changes
- Monitor GitHub Actions for ubuntu-latest and windows-latest

---

## Files to Modify

| File                                    | Changes                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `tests/cli/integration/cli.test.ts`     | Replace `/tmp` with `os.tmpdir()`, add `execWithEnv()` helper, update 20 exec calls |
| `tests/integration/performance.test.ts` | Add cleanup retry logic OR skip on Windows                                          |

## Files NOT to Modify

| File                                    | Reason                                                            |
| --------------------------------------- | ----------------------------------------------------------------- |
| `tests/integration/concurrency.test.ts` | Already properly skipped on Windows                               |
| `src/storage/jsonl.ts`                  | Locking implementation is correct; Windows issues are fundamental |
| `jest.config.ci.js`                     | Already excludes problematic tests                                |

---

## Expected Outcomes

### Before

```
Passed:    1126
Skipped:   12
Failed:    59
```

### After

```
Passed:    ~1180 (CLI E2E tests now pass)
Skipped:   12-15 (concurrency + possibly perf on Windows)
Failed:    0
```

---

## Risk Assessment

| Risk                            | Likelihood | Mitigation                             |
| ------------------------------- | ---------- | -------------------------------------- |
| execWithEnv behaves differently | Low        | Test on Windows before commit          |
| os.tmpdir() permissions issue   | Low        | Same pattern used elsewhere in project |
| Performance tests still flaky   | Medium     | Skip on Windows if needed              |
| Breaking existing Unix tests    | Low        | Unix passes env vars same way          |

---

## Alternatives Considered

### Alternative A: Skip CLI E2E on Windows entirely

```typescript
const describeCliOnly = isWindows ? describe.skip : describe;
```

- **Pros:** Quick fix (5 minutes)
- **Cons:** No CLI testing on Windows
- **Verdict:** REJECTED - proper fix is better

### Alternative B: Use cross-env package

- **Pros:** Well-tested cross-platform env var handling
- **Cons:** Adds dependency, shell-based approach
- **Verdict:** REJECTED - Node.js exec options are cleaner

### Alternative C: Mock os.homedir() in tests

- **Pros:** Avoids shell entirely
- **Cons:** Tests wouldn't exercise real CLI invocation
- **Verdict:** REJECTED - loses integration test value

---

## Approval Request

This plan fixes the Windows test failures by:

1. Using `os.tmpdir()` instead of hardcoded `/tmp`
2. Passing environment variables via Node.js `exec()` options instead of Unix shell syntax
3. Adding cleanup retry logic for Windows file handle release

Ready to proceed with implementation?
