# Standalone Implementation Guide for Claude Code Web

**Purpose:** This guide is designed to be pasted into Claude Code web interface to implement `/later` from scratch in a single session.

**Target:** Claude Code web (no access to local files or existing context)

**Estimated Time:** 6-8 hours for full MCP server implementation

---

## Quick Start Prompt (Copy-Paste This)

```
I need you to implement `/later` - a deferred decision management tool for Claude Code.

Repository: https://github.com/chudeemeke/later

CRITICAL REQUIREMENTS:
1. Use TDD (Test-Driven Development) - write tests BEFORE implementation
2. Follow hexagonal architecture principles
3. Implement as MCP server with 4 tools: later_capture, later_list, later_show, later_do
4. Use JSONL storage with migration path to SQLite
5. Include duplicate detection, secret sanitization, and context extraction

Full specification in this document. Start by reading the architecture docs, then implement following TDD red-green-refactor cycle.
```

---

## Project Context

### What is `/later`?

A tool that captures context-rich decisions during Claude Code sessions so you can defer non-urgent choices and revisit them later with zero context loss.

**Problem:** During complex work, you encounter decisions that aren't urgent but require significant context. Without `/later`, this context gets lost in conversation history and is expensive to reconstruct.

**Solution:** Capture decision + AI-extracted context in persistent storage, enable search/filter/convert-to-todos.

### End-to-End Example

```bash
# During refactoring
User: "Should we switch from Express to Fastify?"
Assistant: "Not urgent for MVP. Let me capture this..."
later_capture("API framework: Express vs Fastify")
# → ✅ Captured as item #7

# Two weeks later
User: "What were those optimization ideas?"
later_list(tags: ["optimization"])
# → Shows #7: API framework: Express vs Fastify

later_show(7)
# → Full context (why considered, trade-offs, benchmarks)

later_do(7)
# → Converts to TodoWrite items, marks in-progress
```

---

## Architecture Overview

### Implementation Options

**Option A: Bash + Slash Command (MVP)**
- Fast to implement (4-6 hours)
- User types `/later "decision"`
- Bash script + jq backend
- Good for validating concept

**Option B: MCP Server (Recommended)**
- First-class tool integration (like TodoWrite)
- Claude can invoke proactively
- Schema validation, better error handling
- 6-8 hours implementation

**This guide implements Option B** (MCP server) as it provides the best long-term value.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Claude Code Session                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Claude invokes: later_capture("decision text")      │ │
│ └──────────────────────┬──────────────────────────────┘ │
└────────────────────────┼────────────────────────────────┘
                         │ MCP Protocol (stdio)
                         ▼
┌─────────────────────────────────────────────────────────┐
│ MCP Server (Node.js/TypeScript)                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Tools Layer                                      │   │
│ │ • later_capture  • later_list                    │   │
│ │ • later_show     • later_do                      │   │
│ └────────────┬─────────────────────────────────────┘   │
│              │                                           │
│ ┌────────────▼─────────────────────────────────────┐   │
│ │ Business Logic                                   │   │
│ │ • Duplicate detection  • Secret sanitization     │   │
│ │ • Context extraction   • TodoWrite integration   │   │
│ └────────────┬─────────────────────────────────────┘   │
│              │                                           │
│ ┌────────────▼─────────────────────────────────────┐   │
│ │ Storage Layer (Hexagonal)                        │   │
│ │ • Interface: Storage (port)                      │   │
│ │ • Adapter: JSONLStorage (v1)                     │   │
│ │ • Adapter: SQLiteStorage (v2 - future)           │   │
│ └────────────┬─────────────────────────────────────┘   │
└──────────────┼──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ File System                                              │
│ ~/.later/                                                │
│ ├── config.json      # Version, backend, settings       │
│ ├── items.jsonl      # JSONL storage (one item per line)│
│ └── .lock            # Concurrency control               │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Capture Flow:**
```
1. Claude calls: later_capture("decision", context, tags, priority)
2. MCP server receives request
3. Sanitize secrets in context
4. Check for duplicates (fuzzy match)
5. Generate unique ID
6. Write to JSONL with file locking
7. Return success message with ID
```

**List/Search Flow:**
```
1. Claude calls: later_list(status, tags, priority)
2. Read all items from JSONL
3. Apply filters
4. Sort by created_at (newest first)
5. Format with status icons, age, tags
6. Return formatted list
```

---

## Directory Structure

```
~/Projects/later/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .gitignore
├── CLAUDE.md                 # Project instructions (already exists)
├── src/
│   ├── index.ts             # MCP server entry point
│   ├── types.ts             # TypeScript type definitions
│   ├── tools/               # Tool implementations
│   │   ├── capture.ts       # later_capture handler
│   │   ├── list.ts          # later_list handler
│   │   ├── show.ts          # later_show handler
│   │   └── do.ts            # later_do handler
│   ├── storage/             # Storage layer (hexagonal)
│   │   ├── interface.ts     # Storage port (abstraction)
│   │   └── jsonl.ts         # JSONL adapter
│   └── utils/               # Shared utilities
│       ├── context.ts       # Context extraction
│       ├── duplicate.ts     # Duplicate detection
│       ├── security.ts      # Secret sanitization
│       └── config.ts        # Config management
├── tests/
│   ├── setup.ts             # Test setup and helpers
│   ├── tools/               # Tool-specific tests
│   │   ├── capture.test.ts
│   │   ├── list.test.ts
│   │   ├── show.test.ts
│   │   └── do.test.ts
│   ├── storage/
│   │   └── jsonl.test.ts
│   └── integration/
│       └── full-workflow.test.ts
└── dist/                    # Compiled JavaScript (generated)
    └── index.js
```

---

## Implementation Phases (TDD)

### Phase 1: Project Setup (30 minutes)

**Test:** N/A (infrastructure)

**Implementation:**
1. Create project structure
2. Initialize npm project
3. Install dependencies
4. Configure TypeScript
5. Configure Jest for testing
6. Create .gitignore

### Phase 2: Type Definitions (15 minutes)

**Test:** N/A (types don't require runtime tests)

**Implementation:** Define core types in `src/types.ts`

### Phase 3: Storage Layer (1.5 hours, TDD)

**Test First (RED):**
- `tests/storage/jsonl.test.ts` - Write tests for:
  - `append()` - Appending new item
  - `readAll()` - Reading all items
  - `findById()` - Finding by ID
  - `update()` - Updating existing item
  - `getNextId()` - Auto-incrementing IDs
  - File locking (concurrent writes)

**Implementation (GREEN):**
- `src/storage/interface.ts` - Storage port
- `src/storage/jsonl.ts` - JSONL adapter

**Refactor:** Improve error handling, optimize locking

### Phase 4: Utilities (2 hours, TDD)

**Test First (RED):**
- `tests/utils/duplicate.test.ts` - Duplicate detection
- `tests/utils/security.test.ts` - Secret sanitization
- `tests/utils/config.test.ts` - Config management

**Implementation (GREEN):**
- `src/utils/duplicate.ts` - Levenshtein distance, keyword overlap
- `src/utils/security.ts` - Pattern matching for secrets
- `src/utils/config.ts` - Config CRUD, migration detection
- `src/utils/context.ts` - Context extraction (placeholder for MVP)

**Refactor:** Optimize algorithms, improve regex patterns

### Phase 5: Tool Handlers (2.5 hours, TDD)

**Test First (RED):**
- `tests/tools/capture.test.ts` - Test later_capture
- `tests/tools/list.test.ts` - Test later_list
- `tests/tools/show.test.ts` - Test later_show
- `tests/tools/do.test.ts` - Test later_do

**Implementation (GREEN):**
- `src/tools/capture.ts` - Capture with duplicate detection
- `src/tools/list.ts` - List with filtering and formatting
- `src/tools/show.ts` - Show full details
- `src/tools/do.ts` - Convert to TodoWrite

**Refactor:** Extract common formatting logic, improve error messages

### Phase 6: MCP Server (1 hour, Integration Tests)

**Test First (RED):**
- `tests/integration/full-workflow.test.ts` - End-to-end test

**Implementation (GREEN):**
- `src/index.ts` - MCP server setup, tool registration

**Refactor:** Improve error handling, logging

### Phase 7: Manual Testing & Registration (1 hour)

1. Build project: `npm run build`
2. Test with MCP Inspector
3. Register with Claude Code
4. Manual integration testing

---

## Detailed Implementation Instructions

### Phase 1: Project Setup

**Step 1.1: Create Directory Structure**

```bash
mkdir -p ~/Projects/later/{src/{tools,storage,utils},tests/{tools,storage,integration}}
cd ~/Projects/later
```

**Step 1.2: Initialize package.json**

```json
{
  "name": "later-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for /later - deferred decision management",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 1.3: Configure TypeScript (tsconfig.json)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 1.4: Configure Jest (jest.config.js)**

```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
```

**Step 1.5: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
coverage/
.later/
```

**Step 1.6: Install Dependencies**

```bash
npm install
```

---

### Phase 2: Type Definitions

**File: src/types.ts**

```typescript
export interface DeferredItem {
  id: number;
  decision: string;
  context: string;
  status: "pending" | "in-progress" | "done" | "archived";
  tags: string[];
  priority: "low" | "medium" | "high";
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  conversation_id?: string;
  dependencies?: number[];  // IDs of items this depends on
}

export interface Config {
  version: string;
  backend: "slash-command" | "mcp-server";
  storage: "jsonl" | "sqlite";
  data_dir: string;
  installed_at?: string;
  upgraded_at?: string;
  previous_version?: string;
}

export interface CaptureArgs {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

export interface ListArgs {
  status?: string;
  tags?: string[];
  priority?: string;
  limit?: number;
}

export interface ShowArgs {
  id: number;
}

export interface DoArgs {
  id: number;
}
```

---

### Phase 3: Storage Layer (TDD)

**Step 3.1: Write Tests First (RED)**

**File: tests/storage/jsonl.test.ts**

```typescript
import { JSONLStorage } from '../../src/storage/jsonl.js';
import type { DeferredItem } from '../../src/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const TEST_DIR = path.join(homedir(), '.later-test');
const TEST_FILE = path.join(TEST_DIR, 'items.jsonl');

describe('JSONLStorage', () => {
  let storage: JSONLStorage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('append', () => {
    test('creates new item in JSONL file', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Test decision',
        context: 'Test context',
        status: 'pending',
        tags: ['test'],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      const content = await fs.readFile(TEST_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0])).toEqual(item);
    });

    test('appends multiple items', async () => {
      const item1: DeferredItem = {
        id: 1,
        decision: 'First',
        context: 'Context 1',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const item2: DeferredItem = {
        id: 2,
        decision: 'Second',
        context: 'Context 2',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item1);
      await storage.append(item2);

      const items = await storage.readAll();
      expect(items.length).toBe(2);
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
    });
  });

  describe('readAll', () => {
    test('returns empty array when file does not exist', async () => {
      const items = await storage.readAll();
      expect(items).toEqual([]);
    });

    test('returns all items from JSONL', async () => {
      // Write test data directly
      const item1 = { id: 1, decision: 'First', status: 'pending' };
      const item2 = { id: 2, decision: 'Second', status: 'done' };

      await fs.writeFile(
        TEST_FILE,
        JSON.stringify(item1) + '\n' + JSON.stringify(item2) + '\n'
      );

      const items = await storage.readAll();
      expect(items.length).toBe(2);
      expect(items[0].decision).toBe('First');
      expect(items[1].decision).toBe('Second');
    });
  });

  describe('findById', () => {
    test('returns item with matching ID', async () => {
      const item: DeferredItem = {
        id: 5,
        decision: 'Find me',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      const found = await storage.findById(5);
      expect(found).not.toBeNull();
      expect(found!.decision).toBe('Find me');
    });

    test('returns null for non-existent ID', async () => {
      const found = await storage.findById(999);
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    test('updates existing item', async () => {
      const item: DeferredItem = {
        id: 1,
        decision: 'Original',
        context: 'Test',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await storage.append(item);

      item.decision = 'Updated';
      item.status = 'done';
      await storage.update(item);

      const found = await storage.findById(1);
      expect(found!.decision).toBe('Updated');
      expect(found!.status).toBe('done');
    });

    test('throws error for non-existent item', async () => {
      const item: DeferredItem = {
        id: 999,
        decision: 'Does not exist',
        context: '',
        status: 'pending',
        tags: [],
        priority: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(storage.update(item)).rejects.toThrow('Item #999 not found');
    });
  });

  describe('getNextId', () => {
    test('returns 1 for empty storage', async () => {
      const nextId = await storage.getNextId();
      expect(nextId).toBe(1);
    });

    test('returns max ID + 1', async () => {
      await storage.append({ id: 1 } as DeferredItem);
      await storage.append({ id: 5 } as DeferredItem);
      await storage.append({ id: 3 } as DeferredItem);

      const nextId = await storage.getNextId();
      expect(nextId).toBe(6);
    });
  });

  describe('concurrent writes', () => {
    test('handles concurrent appends with locking', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.append({
          id: i + 1,
          decision: `Item ${i + 1}`,
          context: '',
          status: 'pending',
          tags: [],
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );

      await Promise.all(promises);

      const items = await storage.readAll();
      expect(items.length).toBe(10);
    });
  });
});
```

**Run test (should FAIL):**
```bash
npm test
```

**Step 3.2: Implement Storage Interface (GREEN)**

**File: src/storage/interface.ts**

```typescript
import type { DeferredItem } from '../types.js';

export interface Storage {
  append(item: DeferredItem): Promise<void>;
  readAll(): Promise<DeferredItem[]>;
  findById(id: number): Promise<DeferredItem | null>;
  update(item: DeferredItem): Promise<void>;
  getNextId(): Promise<number>;
}
```

**File: src/storage/jsonl.ts**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { DeferredItem } from '../types.js';
import type { Storage } from './interface.js';

export class JSONLStorage implements Storage {
  private laterDir: string;
  private itemsFile: string;
  private lockFile: string;

  constructor(dataDir?: string) {
    this.laterDir = dataDir || path.join(homedir(), '.later');
    this.itemsFile = path.join(this.laterDir, 'items.jsonl');
    this.lockFile = path.join(this.laterDir, '.lock');
  }

  async append(item: DeferredItem): Promise<void> {
    await this.ensureDir();
    await this.withLock(async () => {
      await fs.appendFile(this.itemsFile, JSON.stringify(item) + '\n');
    });
  }

  async readAll(): Promise<DeferredItem[]> {
    await this.ensureDir();

    try {
      const content = await fs.readFile(this.itemsFile, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async findById(id: number): Promise<DeferredItem | null> {
    const items = await this.readAll();
    return items.find((item) => item.id === id) || null;
  }

  async update(item: DeferredItem): Promise<void> {
    await this.withLock(async () => {
      const items = await this.readAll();
      const index = items.findIndex((i) => i.id === item.id);

      if (index === -1) {
        throw new Error(`Item #${item.id} not found`);
      }

      items[index] = item;

      // Write all items back
      await fs.writeFile(
        this.itemsFile,
        items.map((i) => JSON.stringify(i)).join('\n') + '\n'
      );
    });
  }

  async getNextId(): Promise<number> {
    const items = await this.readAll();
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.id)) + 1;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.laterDir, { recursive: true });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Simple file-based locking
    let acquired = false;

    while (!acquired) {
      try {
        await fs.writeFile(this.lockFile, String(process.pid), { flag: 'wx' });
        acquired = true;
      } catch {
        // Lock held by another process, wait
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    try {
      return await fn();
    } finally {
      await fs.unlink(this.lockFile).catch(() => {});
    }
  }
}

// Singleton for easy access
let storageInstance: Storage | null = null;

export function getStorage(dataDir?: string): Storage {
  if (!storageInstance) {
    storageInstance = new JSONLStorage(dataDir);
  }
  return storageInstance;
}
```

**Run tests (should PASS):**
```bash
npm test
```

**Step 3.3: Refactor (if needed)**

Review code for:
- Error handling improvements
- Lock timeout mechanisms
- Performance optimizations

---

### Phase 4: Utilities (TDD)

**I'll continue with the remaining phases in a follow-up to keep this manageable. The pattern is:**

1. Write tests first (RED)
2. Run tests (should FAIL)
3. Implement minimum code to pass (GREEN)
4. Run tests (should PASS)
5. Refactor

---

## Key Implementation Details

### Duplicate Detection Algorithm

**Levenshtein Distance:**
- Measures edit distance between two strings
- Threshold: 80% similarity = potential duplicate

**Keyword Overlap:**
- Extract keywords (remove stop words)
- Calculate Jaccard similarity
- Threshold: 80% overlap = potential duplicate

**Performance:**
- Only check last 50 pending items
- Skip done/archived items

### Secret Sanitization

**Patterns Detected:**
- OpenAI API keys: `sk-[a-zA-Z0-9]{32,}`
- GitHub tokens: `ghp_[a-zA-Z0-9]{36}`
- Slack tokens: `xox[baprs]-[a-zA-Z0-9-]{10,}`
- Generic 40-char tokens

**Replacement:** `[REDACTED]`

### File Locking

**Simple file-based locking:**
1. Try to create `.lock` file with exclusive flag (`wx`)
2. If fails, another process holds lock - wait 100ms and retry
3. Once acquired, execute operation
4. Always release lock in `finally` block

**Race condition handling:**
- Lock file contains PID for debugging
- Stale locks auto-removed after 30 seconds (future enhancement)

---

## Testing Strategy

### Test Coverage Requirements

- **Unit tests:** 80%+ coverage
- **Integration tests:** All critical workflows
- **Manual testing:** Full end-to-end validation

### Test Structure

```
tests/
├── setup.ts              # Test helpers, fixtures
├── storage/
│   └── jsonl.test.ts    # Storage layer tests
├── utils/
│   ├── duplicate.test.ts
│   ├── security.test.ts
│   └── config.test.ts
├── tools/
│   ├── capture.test.ts
│   ├── list.test.ts
│   ├── show.test.ts
│   └── do.test.ts
└── integration/
    └── full-workflow.test.ts
```

---

## Registration with Claude Code

### After Building

```bash
# Build project
npm run build

# Register with Claude Code (stdio transport)
claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js

# Verify
claude mcp list

# Test
# Open Claude Code and try:
# "Can you capture this decision for later: Should we migrate to TypeScript?"
```

### Troubleshooting

**Server doesn't appear:**
```bash
# Check logs
tail -f ~/.claude/logs/mcp-later.log

# Test server manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

**Tools not working:**
```bash
# Remove and re-add
claude mcp remove later
claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js
```

---

## Performance Targets

- **Capture:** < 100ms
- **List (100 items):** < 50ms
- **Search/filter:** < 200ms
- **Update:** < 100ms

**When to migrate to SQLite (V2):**
- Item count > 500 OR
- Search time > 500ms (3 consecutive measurements)

---

## Documentation References

All documentation is in the GitHub repository:

- **Architecture:** `docs/architecture/`
- **Technical Specs:** `docs/technical/`
- **Edge Cases:** `docs/reference/edge-cases/`
- **Roadmap:** `docs/planning/roadmap/`

Read these before starting implementation for full context.

---

## Success Criteria

### MVP Complete When:

1. ✅ All unit tests passing (80%+ coverage)
2. ✅ Integration tests passing
3. ✅ MCP server builds without errors
4. ✅ Registered successfully with Claude Code
5. ✅ Manual testing demonstrates all 4 tools working:
   - `later_capture` - Captures item, detects duplicates
   - `later_list` - Lists with filters
   - `later_show` - Shows full details
   - `later_do` - Converts to TodoWrite guidance
6. ✅ Secret sanitization working
7. ✅ Concurrent writes handled correctly
8. ✅ Performance targets met

---

## Next Steps After MVP

1. **Validate concept:** Use `/later` for real decisions in sessions
2. **Gather feedback:** What works? What's missing?
3. **V1 Enhanced:** Add AI-powered categorization, smart search ranking
4. **V2 SQLite:** Migrate when scale requires (>500 items)

---

## Common Pitfalls to Avoid

1. **Don't skip TDD:** Tempting to code first, but tests define the contract
2. **Don't over-engineer:** MVP should be simple, add complexity later
3. **Don't ignore error handling:** File operations can fail in many ways
4. **Don't forget file locking:** Concurrent writes WILL cause corruption
5. **Don't leak secrets:** Always sanitize context before storing
6. **Don't assume IDs are sequential:** Support gaps in ID sequence

---

## Estimated Timeline

- **Phase 1 (Setup):** 30 minutes
- **Phase 2 (Types):** 15 minutes
- **Phase 3 (Storage):** 1.5 hours
- **Phase 4 (Utilities):** 2 hours
- **Phase 5 (Tools):** 2.5 hours
- **Phase 6 (MCP Server):** 1 hour
- **Phase 7 (Testing):** 1 hour

**Total:** 6-8 hours for complete MCP server implementation

---

## Contact & Support

- **Repository:** https://github.com/chudeemeke/later
- **Issues:** Report bugs or request features via GitHub Issues
- **Docs:** Full documentation in `docs/` directory

---

**Ready to implement? Start with Phase 1 and follow TDD cycle religiously!**
