# MCP Server Implementation

**Version:** 1.0.0-mcp
**Language:** TypeScript (Node.js)
**Protocol:** Model Context Protocol (MCP)
**Transport:** stdio (standard input/output)

---

## Overview

The MCP server provides first-class tool integration for `/later` in Claude Code, exposing four primary tools that Claude can invoke automatically:

1. **later_capture** - Capture a deferred decision with context
2. **later_list** - List all or filtered deferred items
3. **later_show** - Show detailed information about a specific item
4. **later_do** - Convert a deferred item to TodoWrite tasks

---

## Project Structure

```
~/Projects/later/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── index.ts             # MCP server entry point
│   ├── tools/               # Tool implementations
│   │   ├── capture.ts       # later_capture handler
│   │   ├── list.ts          # later_list handler
│   │   ├── show.ts          # later_show handler
│   │   └── do.ts            # later_do handler
│   ├── storage/             # Data access layer
│   │   ├── jsonl.ts         # JSONL storage backend
│   │   ├── sqlite.ts        # SQLite storage backend (V2)
│   │   └── interface.ts     # Storage abstraction
│   ├── utils/               # Shared utilities
│   │   ├── context.ts       # Context extraction logic
│   │   ├── duplicate.ts     # Duplicate detection
│   │   ├── security.ts      # Secret sanitization
│   │   └── config.ts        # Config management
│   └── types.ts             # TypeScript type definitions
├── tests/
│   ├── tools/               # Tool-specific tests
│   ├── storage/             # Storage tests
│   └── integration/         # End-to-end tests
└── dist/                    # Compiled JavaScript (generated)
    └── index.js             # Entry point for MCP
```

---

## Dependencies

**package.json:**
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
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "dev": "npm run build && node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
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

**tsconfig.json:**
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

---

## Core Implementation

### 1. Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { initializeServer, getConfig } from "./utils/config.js";
import { handleCapture } from "./tools/capture.js";
import { handleList } from "./tools/list.js";
import { handleShow } from "./tools/show.js";
import { handleDo } from "./tools/do.js";

// Server metadata
const SERVER_NAME = "later";
const SERVER_VERSION = "1.0.0-mcp";

// Initialize MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "later_capture",
        description: "Capture a deferred decision with context for later review",
        inputSchema: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              description: "The decision or question to defer (required)",
            },
            context: {
              type: "string",
              description: "Additional context (optional, auto-extracted if omitted)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for categorization (e.g., ['optimization', 'architecture'])",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Priority level (default: medium)",
            },
          },
          required: ["decision"],
        },
      },
      {
        name: "later_list",
        description: "List all deferred items with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "in-progress", "done", "archived"],
              description: "Filter by status",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags (e.g., ['optimization'])",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Filter by priority",
            },
            limit: {
              type: "number",
              description: "Maximum number of items to return (default: 20)",
            },
          },
        },
      },
      {
        name: "later_show",
        description: "Show detailed information about a specific deferred item",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "The item ID to show",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "later_do",
        description: "Convert a deferred item to TodoWrite tasks and mark as in-progress",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "The item ID to convert to todos",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Handle tool invocations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "later_capture":
        return await handleCapture(args);

      case "later_list":
        return await handleList(args);

      case "later_show":
        return await handleShow(args);

      case "later_do":
        return await handleDo(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Server lifecycle
async function main() {
  console.error("🚀 Starting /later MCP server...");

  // Initialize (check for migrations, etc.)
  await initializeServer();

  console.error("✅ /later MCP server ready");

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("🔌 Connected to Claude Code");
}

// Start server
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
```

---

### 2. Tool Handlers

#### src/tools/capture.ts

```typescript
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getStorage } from "../storage/jsonl.js";
import { extractContext } from "../utils/context.js";
import { detectDuplicate } from "../utils/duplicate.js";
import { sanitizeSecrets } from "../utils/security.js";
import type { DeferredItem } from "../types.js";

interface CaptureArgs {
  decision: string;
  context?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high";
}

export async function handleCapture(args: CaptureArgs): Promise<CallToolResult> {
  const { decision, context, tags = [], priority = "medium" } = args;

  // 1. Extract or use provided context
  const fullContext = context || await extractContext();

  // 2. Sanitize secrets
  const sanitizedContext = sanitizeSecrets(fullContext);

  // 3. Check for duplicates
  const storage = getStorage();
  const duplicate = await detectDuplicate(decision, storage);

  if (duplicate) {
    return {
      content: [
        {
          type: "text",
          text: `⚠️  Similar item found: #${duplicate.id} - "${duplicate.decision}"\n\n` +
                `Would you like to:\n` +
                `1. Update existing item #${duplicate.id}\n` +
                `2. Create new item anyway\n\n` +
                `Use later_update(${duplicate.id}) to update, or call later_capture with --force flag.`,
        },
      ],
    };
  }

  // 4. Create item
  const item: DeferredItem = {
    id: await storage.getNextId(),
    decision,
    context: sanitizedContext,
    status: "pending",
    tags,
    priority,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await storage.append(item);

  // 5. Return success
  return {
    content: [
      {
        type: "text",
        text: `✅ Captured as item #${item.id}\n\n` +
              `Decision: ${decision}\n` +
              `Priority: ${priority}\n` +
              `Tags: ${tags.length > 0 ? tags.join(", ") : "none"}\n\n` +
              `Use later_show(${item.id}) to review full details.`,
      },
    ],
  };
}
```

#### src/tools/list.ts

```typescript
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getStorage } from "../storage/jsonl.js";
import type { DeferredItem } from "../types.js";

interface ListArgs {
  status?: string;
  tags?: string[];
  priority?: string;
  limit?: number;
}

export async function handleList(args: ListArgs): Promise<CallToolResult> {
  const { status, tags, priority, limit = 20 } = args;

  const storage = getStorage();
  let items = await storage.readAll();

  // Apply filters
  if (status) {
    items = items.filter((item) => item.status === status);
  }

  if (tags && tags.length > 0) {
    items = items.filter((item) =>
      tags.some((tag) => item.tags.includes(tag))
    );
  }

  if (priority) {
    items = items.filter((item) => item.priority === priority);
  }

  // Sort by created_at (newest first)
  items.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Limit results
  items = items.slice(0, limit);

  if (items.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No deferred items found matching your filters.",
        },
      ],
    };
  }

  // Format output
  const lines = items.map((item) => {
    const age = formatAge(item.created_at);
    const statusIcon = getStatusIcon(item.status);
    const priorityFlag = item.priority === "high" ? "🔴" : item.priority === "low" ? "🟢" : "🟡";

    return `${statusIcon} #${item.id}: ${item.decision}\n` +
           `   ${priorityFlag} ${item.priority} • ${age} • ${item.tags.join(", ") || "no tags"}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `Found ${items.length} item(s):\n\n${lines.join("\n\n")}`,
      },
    ],
  };
}

function formatAge(isoDate: string): string {
  const now = new Date();
  const created = new Date(isoDate);
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "pending": return "⏳";
    case "in-progress": return "🔄";
    case "done": return "✅";
    case "archived": return "📦";
    default: return "❓";
  }
}
```

#### src/tools/show.ts

```typescript
import { type CallToolResult, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getStorage } from "../storage/jsonl.js";

interface ShowArgs {
  id: number;
}

export async function handleShow(args: ShowArgs): Promise<CallToolResult> {
  const { id } = args;

  const storage = getStorage();
  const item = await storage.findById(id);

  if (!item) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Item #${id} not found`
    );
  }

  // Format full details
  const output = [
    `📋 Item #${item.id}`,
    ``,
    `Decision: ${item.decision}`,
    `Status: ${item.status}`,
    `Priority: ${item.priority}`,
    `Tags: ${item.tags.join(", ") || "none"}`,
    `Created: ${new Date(item.created_at).toLocaleString()}`,
    `Updated: ${new Date(item.updated_at).toLocaleString()}`,
    ``,
    `Context:`,
    `${item.context}`,
  ];

  if (item.conversation_id) {
    output.push(``, `Conversation ID: ${item.conversation_id}`);
  }

  return {
    content: [
      {
        type: "text",
        text: output.join("\n"),
      },
    ],
  };
}
```

#### src/tools/do.ts

```typescript
import { type CallToolResult, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getStorage } from "../storage/jsonl.js";

interface DoArgs {
  id: number;
}

export async function handleDo(args: DoArgs): Promise<CallToolResult> {
  const { id } = args;

  const storage = getStorage();
  const item = await storage.findById(id);

  if (!item) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Item #${id} not found`
    );
  }

  // Mark as in-progress
  item.status = "in-progress";
  item.updated_at = new Date().toISOString();
  await storage.update(item);

  // Generate TodoWrite guidance
  const todoSuggestions = [
    `Review context for item #${id}: ${item.decision}`,
    `Implement solution for: ${item.decision}`,
    `Test and validate changes`,
  ];

  return {
    content: [
      {
        type: "text",
        text: `✅ Item #${id} marked as in-progress\n\n` +
              `Decision: ${item.decision}\n\n` +
              `Suggested todos:\n` +
              todoSuggestions.map((todo, i) => `${i + 1}. ${todo}`).join("\n") + `\n\n` +
              `Context:\n${item.context}\n\n` +
              `💡 Use TodoWrite tool to create these todos in your session.`,
      },
    ],
  };
}
```

---

### 3. Storage Layer

#### src/storage/interface.ts

```typescript
import type { DeferredItem } from "../types.js";

export interface Storage {
  append(item: DeferredItem): Promise<void>;
  readAll(): Promise<DeferredItem[]>;
  findById(id: number): Promise<DeferredItem | null>;
  update(item: DeferredItem): Promise<void>;
  getNextId(): Promise<number>;
}
```

#### src/storage/jsonl.ts

```typescript
import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";
import type { DeferredItem } from "../types.js";
import type { Storage } from "./interface.js";

const LATER_DIR = path.join(homedir(), ".later");
const ITEMS_FILE = path.join(LATER_DIR, "items.jsonl");
const LOCK_FILE = path.join(LATER_DIR, ".lock");

class JSONLStorage implements Storage {
  async append(item: DeferredItem): Promise<void> {
    await this.ensureDir();
    await this.withLock(async () => {
      await fs.appendFile(ITEMS_FILE, JSON.stringify(item) + "\n");
    });
  }

  async readAll(): Promise<DeferredItem[]> {
    await this.ensureDir();

    try {
      const content = await fs.readFile(ITEMS_FILE, "utf-8");
      return content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
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
        ITEMS_FILE,
        items.map((i) => JSON.stringify(i)).join("\n") + "\n"
      );
    });
  }

  async getNextId(): Promise<number> {
    const items = await this.readAll();
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.id)) + 1;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(LATER_DIR, { recursive: true });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Simple file-based locking
    let acquired = false;

    while (!acquired) {
      try {
        await fs.writeFile(LOCK_FILE, String(process.pid), { flag: "wx" });
        acquired = true;
      } catch {
        // Lock held by another process, wait
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    try {
      return await fn();
    } finally {
      await fs.unlink(LOCK_FILE).catch(() => {});
    }
  }
}

let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new JSONLStorage();
  }
  return storageInstance;
}
```

---

### 4. Utilities

#### src/utils/context.ts

```typescript
/**
 * Extract context from current Claude Code session
 *
 * In a real implementation, this would integrate with Claude Code's
 * conversation API to get recent messages. For MVP, we return a placeholder.
 */
export async function extractContext(): Promise<string> {
  // TODO: Integrate with Claude Code conversation API
  // For now, return placeholder
  return "Context auto-extraction not yet implemented. " +
         "Please provide context manually when capturing items.";
}
```

#### src/utils/duplicate.ts

```typescript
import type { DeferredItem } from "../types.js";
import type { Storage } from "../storage/interface.js";

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): Set<string> {
  // Simple keyword extraction (remove common words)
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
    "in", "with", "to", "for", "of", "from", "by", "as", "be", "this",
  ]);

  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
  );
}

/**
 * Calculate keyword overlap percentage
 */
function keywordOverlap(a: string, b: string): number {
  const keywordsA = extractKeywords(a);
  const keywordsB = extractKeywords(b);

  const intersection = new Set(
    [...keywordsA].filter((word) => keywordsB.has(word))
  );

  const union = new Set([...keywordsA, ...keywordsB]);

  return intersection.size / union.size;
}

/**
 * Detect if a similar item already exists
 *
 * Returns the most similar pending item if:
 * - Levenshtein similarity > 80% OR
 * - Keyword overlap > 80%
 */
export async function detectDuplicate(
  decision: string,
  storage: Storage
): Promise<DeferredItem | null> {
  const items = await storage.readAll();

  // Only check pending items (not done/archived)
  const pendingItems = items.filter(
    (item) => item.status === "pending" || item.status === "in-progress"
  );

  // Check last 50 items for performance
  const recentItems = pendingItems.slice(-50);

  for (const item of recentItems) {
    const sim = similarity(decision, item.decision);
    const overlap = keywordOverlap(decision, item.decision);

    if (sim > 0.8 || overlap > 0.8) {
      return item;
    }
  }

  return null;
}
```

#### src/utils/security.ts

```typescript
/**
 * Patterns that look like secrets
 */
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/g,           // OpenAI API keys
  /ghp_[a-zA-Z0-9]{36}/g,           // GitHub personal access tokens
  /gho_[a-zA-Z0-9]{36}/g,           // GitHub OAuth tokens
  /\b[A-Za-z0-9]{40}\b/g,           // Generic 40-char tokens (e.g., GitHub)
  /xox[baprs]-[a-zA-Z0-9-]{10,}/g,  // Slack tokens
  /AIza[0-9A-Za-z\\-_]{35}/g,       // Google API keys
];

/**
 * Sanitize secrets from context text
 */
export function sanitizeSecrets(text: string): string {
  let sanitized = text;

  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized;
}

/**
 * Detect if text potentially contains secrets
 */
export function containsSecrets(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
```

#### src/utils/config.ts

```typescript
import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const LATER_DIR = path.join(homedir(), ".later");
const CONFIG_FILE = path.join(LATER_DIR, "config.json");
const CURRENT_VERSION = "1.0.0-mcp";

interface Config {
  version: string;
  backend: string;
  storage: string;
  data_dir: string;
  installed_at?: string;
  upgraded_at?: string;
  previous_version?: string;
}

/**
 * Initialize server on first startup
 */
export async function initializeServer(): Promise<void> {
  console.error("🚀 Starting /later MCP server...");

  // Ensure data directory exists
  await fs.mkdir(LATER_DIR, { recursive: true });

  // Check if config exists
  const configExists = await fs
    .access(CONFIG_FILE)
    .then(() => true)
    .catch(() => false);

  if (!configExists) {
    console.error("📝 Creating initial config...");
    await createInitialConfig();
    return;
  }

  // Read current config
  const config = await getConfig();

  // Check if migration needed
  if (config.backend === "slash-command") {
    console.error("🔄 Detecting old slash command installation...");
    try {
      execSync(`${homedir()}/.local/bin/later-upgrade`, {
        stdio: "inherit",
      });
      console.error("✅ Migration complete. MCP server ready.");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
    return;
  }

  // Check if version upgrade needed (data schema migrations)
  if (config.version !== CURRENT_VERSION) {
    console.error(`🔄 Upgrading from ${config.version} to ${CURRENT_VERSION}...`);
    await migrateDataSchema(config.version, CURRENT_VERSION);
  }

  console.error("✅ /later MCP server ready.");
}

async function createInitialConfig(): Promise<void> {
  const config: Config = {
    version: CURRENT_VERSION,
    backend: "mcp-server",
    storage: "jsonl",
    data_dir: LATER_DIR,
    installed_at: new Date().toISOString(),
  };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getConfig(): Promise<Config> {
  const content = await fs.readFile(CONFIG_FILE, "utf-8");
  return JSON.parse(content);
}

export async function updateConfig(updates: Partial<Config>): Promise<void> {
  const config = await getConfig();
  const newConfig = { ...config, ...updates };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
}

async function migrateDataSchema(from: string, to: string): Promise<void> {
  // Future: Handle schema changes between versions
  console.error(`Schema migration ${from} → ${to} (no changes needed)`);
  await updateConfig({ version: to });
}
```

---

### 5. Type Definitions

#### src/types.ts

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
```

---

## Building and Running

### Development Workflow

```bash
# 1. Install dependencies
cd ~/Projects/later
npm install

# 2. Build TypeScript
npm run build

# 3. Test locally (stdio mode)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# 4. Register with Claude Code
claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js

# 5. Verify registration
claude mcp list

# 6. Test in Claude Code
# Open Claude Code and the tools should be available
```

### Watch Mode (Development)

```bash
# Terminal 1: Watch TypeScript changes
npm run watch

# Terminal 2: Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Testing Strategy

### Unit Tests

**tests/tools/capture.test.ts:**
```typescript
import { handleCapture } from "../../src/tools/capture";
import { getStorage } from "../../src/storage/jsonl";

describe("later_capture", () => {
  beforeEach(async () => {
    // Clear test data
    await clearTestData();
  });

  test("creates item with minimal args", async () => {
    const result = await handleCapture({
      decision: "Test decision",
    });

    expect(result.content[0].text).toContain("Captured as item #1");

    const storage = getStorage();
    const item = await storage.findById(1);

    expect(item).toBeDefined();
    expect(item!.decision).toBe("Test decision");
    expect(item!.status).toBe("pending");
    expect(item!.priority).toBe("medium");
  });

  test("detects duplicates", async () => {
    // Create original
    await handleCapture({ decision: "Optimize performance" });

    // Try similar
    const result = await handleCapture({ decision: "Optimize performance issues" });

    expect(result.content[0].text).toContain("Similar item found");
  });

  test("sanitizes secrets", async () => {
    const result = await handleCapture({
      decision: "Test",
      context: "API key: sk-abc123xyz456",
    });

    const storage = getStorage();
    const item = await storage.findById(1);

    expect(item!.context).toContain("[REDACTED]");
    expect(item!.context).not.toContain("sk-abc123xyz456");
  });
});
```

### Integration Tests

**tests/integration/full-workflow.test.ts:**
```typescript
describe("Full /later workflow", () => {
  test("capture → list → show → do", async () => {
    // 1. Capture
    const captureResult = await handleCapture({
      decision: "Refactor auth module",
      tags: ["refactoring", "security"],
      priority: "high",
    });

    expect(captureResult.content[0].text).toContain("Captured as item #1");

    // 2. List
    const listResult = await handleList({ tags: ["refactoring"] });
    expect(listResult.content[0].text).toContain("Refactor auth module");

    // 3. Show
    const showResult = await handleShow({ id: 1 });
    expect(showResult.content[0].text).toContain("Refactor auth module");
    expect(showResult.content[0].text).toContain("Priority: high");

    // 4. Do
    const doResult = await handleDo({ id: 1 });
    expect(doResult.content[0].text).toContain("marked as in-progress");

    // Verify status changed
    const storage = getStorage();
    const item = await storage.findById(1);
    expect(item!.status).toBe("in-progress");
  });
});
```

---

## Deployment

### Registration with Claude Code

```bash
# Local stdio transport (recommended for personal use)
claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js

# With custom data directory
claude mcp add --transport stdio later \
  --env LATER_DIR=/custom/path \
  -- node ~/Projects/later/dist/index.js
```

### Scopes

```bash
# User scope (all projects)
claude mcp add --scope user --transport stdio later -- node ~/Projects/later/dist/index.js

# Project scope (shared via .mcp.json)
claude mcp add --scope project --transport stdio later -- node ~/Projects/later/dist/index.js
```

### Verification

```bash
# List registered servers
claude mcp list

# Test connection
claude mcp test later

# View logs
tail -f ~/.claude/logs/mcp-later.log
```

---

## Performance Optimization

### JSONL Performance (MVP → V1)

- **Read optimization:** Cache items in memory with 5-second TTL
- **Write optimization:** Batched writes with 100ms debounce
- **Search optimization:** Index last 100 items in memory

### Migration Trigger: JSONL → SQLite (V2)

When any of these conditions met:
- Item count > 500
- Search time > 500ms (3 consecutive measurements)
- User manually triggers migration

---

## Related Documents

- [Migration Strategy](../../architecture/decisions/migration-strategy.md) - Upgrade path from slash command
- [Storage Mechanism](../../architecture/decisions/storage-mechanism.md) - JSONL → SQLite decision
- [Schema Evolution](../../architecture/decisions/schema-evolution.md) - Handling schema changes

---

## Changelog

- **2025-01-31:** Initial MCP server implementation specification
