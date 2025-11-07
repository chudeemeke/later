# /later CLI Implementation Plan

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Ready for Implementation

## Executive Summary

This plan details the implementation of a CLI for the `/later` project as a **thin client** over the existing production MCP server. The CLI follows git-style command patterns, provides excellent UX with progressive disclosure, and maintains zero business logic duplication.

**Key Design Decisions:**
- **Language:** Node.js/TypeScript (matches MCP server, access to MCP SDK)
- **Architecture:** Thin adapter pattern - CLI delegates 100% to MCP server
- **Interface:** Git-style subcommands with hierarchical help
- **Distribution:** npm package with global install + symlink to ~/.local/bin/

---

## 1. File Structure

### Complete Directory Layout

```
/later/
├── src/
│   ├── index.ts                      # MCP server entry point (existing)
│   ├── tools/                        # MCP tool implementations (existing)
│   │   ├── capture.ts
│   │   ├── list.ts
│   │   ├── show.ts
│   │   ├── do.ts
│   │   ├── update.ts
│   │   ├── delete.ts
│   │   ├── bulk-update.ts
│   │   ├── bulk-delete.ts
│   │   └── search.ts
│   ├── storage/                      # Storage layer (existing)
│   │   ├── jsonl.ts
│   │   └── locking.ts
│   ├── validation/                   # Zod schemas (existing)
│   │   └── schemas.ts
│   └── cli/                          # NEW: CLI implementation
│       ├── cli.ts                    # Main CLI entry point
│       ├── commands/                 # Command handlers (one per subcommand)
│       │   ├── capture.ts
│       │   ├── list.ts
│       │   ├── show.ts
│       │   ├── do.ts
│       │   ├── update.ts
│       │   ├── delete.ts
│       │   ├── bulk-update.ts
│       │   ├── bulk-delete.ts
│       │   └── search.ts
│       ├── mcp-client.ts             # MCP server communication layer
│       ├── output/                   # Output formatting
│       │   ├── formatter.ts          # Abstract formatter interface
│       │   ├── table-formatter.ts    # Human-readable tables
│       │   ├── json-formatter.ts     # JSON output
│       │   └── colors.ts             # ANSI color utilities
│       ├── parser.ts                 # Argument parsing
│       ├── help.ts                   # Help text generator
│       ├── errors.ts                 # Error handling utilities
│       └── config.ts                 # Configuration management
├── tests/
│   ├── mcp/                          # MCP server tests (existing)
│   │   ├── unit/
│   │   └── integration/
│   └── cli/                          # NEW: CLI tests
│       ├── unit/                     # Parser, formatter, etc.
│       │   ├── parser.test.ts
│       │   ├── formatter.test.ts
│       │   └── errors.test.ts
│       ├── integration/              # CLI → MCP roundtrip
│       │   ├── capture.test.ts
│       │   ├── list.test.ts
│       │   └── search.test.ts
│       ├── e2e/                      # Full workflow tests
│       │   └── workflows.test.ts
│       └── fixtures/                 # Mock MCP server responses
│           └── mock-server.ts
├── docs/
│   ├── cli/                          # NEW: CLI documentation
│   │   ├── README.md                 # CLI user guide
│   │   ├── commands.md               # Command reference
│   │   ├── installation.md           # Install instructions
│   │   └── examples.md               # Usage examples
│   └── architecture/
│       └── decisions/
│           └── cli-design.md         # NEW: CLI architecture decisions
├── bin/
│   └── later                         # NEW: Executable entry point (symlinks to dist/cli/cli.js)
├── package.json                      # Updated with CLI bin entry
├── tsconfig.json                     # TypeScript config
└── README.md                         # Updated with CLI usage

Installation locations:
~/.local/bin/later                    # Symlink to /later/bin/later
/later/dist/cli/cli.js                # Compiled CLI entry point
/later/dist/index.js                  # Compiled MCP server entry point
```

### File Responsibilities

**One file = one responsibility:**

- `cli/cli.ts` - Main entry point, subcommand routing only
- `cli/commands/*.ts` - One file per subcommand, maps args → MCP request
- `cli/mcp-client.ts` - MCP server communication (spawn, JSON-RPC, error handling)
- `cli/parser.ts` - Argument parsing (flags, subcommands, validation)
- `cli/output/formatter.ts` - Abstract formatter interface
- `cli/output/table-formatter.ts` - Human-readable output (tables, lists)
- `cli/output/json-formatter.ts` - JSON output (--json flag)
- `cli/output/colors.ts` - ANSI color codes, terminal detection
- `cli/help.ts` - Help text generation (multi-level hierarchy)
- `cli/errors.ts` - Error formatting, exit codes, user-friendly messages
- `cli/config.ts` - Configuration loading (~/.later/cli-config.json)

---

## 2. Command Interface Design

### Git-Style Command Structure

```bash
later <subcommand> [options] [arguments]
```

### Subcommands (1:1 mapping to MCP tools)

| Subcommand | MCP Tool | Description |
|------------|----------|-------------|
| `capture` | `later_capture` | Capture new deferred decision |
| `list` | `later_list` | List deferred items with filters |
| `show` | `later_show` | Show full details of an item |
| `do` | `later_do` | Start working on an item (convert to todos) |
| `update` | `later_update` | Update an existing item |
| `delete` | `later_delete` | Delete an item (soft or hard) |
| `bulk-update` | `later_bulk_update` | Update multiple items at once |
| `bulk-delete` | `later_bulk_delete` | Delete multiple items at once |
| `search` | `later_search` | Full-text search across items |

### Global Flags

```bash
--help, -h          # Show help (context-aware: main or subcommand)
--version, -v       # Show version (CLI + MCP server versions)
--json              # Output in JSON format (machine-readable)
--debug             # Enable debug logging (shows MCP requests/responses)
--no-color          # Disable color output
```

### Subcommand-Specific Flags & Arguments

#### `later capture`

```bash
later capture <decision> [options]

Arguments:
  <decision>          Decision text (required, max 500 chars)

Options:
  --context <text>    Additional context or reasoning
  --priority <level>  Priority: low, medium, high (default: medium)
  --tags <tags>       Comma-separated tags (e.g., "api,performance")
  -p, --high          Shorthand for --priority high
  -c <text>           Shorthand for --context

Examples:
  later capture "Should we use PostgreSQL or MongoDB?"
  later capture "Optimize CLAUDE.md size" --context "Currently 3343 words" --priority high
  later capture "API design decision" --tags "api,architecture" -c "REST vs GraphQL trade-offs"
```

#### `later list`

```bash
later list [options]

Options:
  --status <status>   Filter by status: pending, in-progress, done, archived
  --priority <level>  Filter by priority: low, medium, high
  --tags <tags>       Filter by tags (OR logic, comma-separated)
  --limit <n>         Max items to return (default: 50)
  -s <status>         Shorthand for --status
  -p <level>          Shorthand for --priority
  -t <tags>           Shorthand for --tags

Examples:
  later list
  later list --status pending --priority high
  later list --tags "api,optimization" --limit 10
  later list -s in-progress -p high
```

#### `later show`

```bash
later show <id>

Arguments:
  <id>                Item ID to show (required)

Examples:
  later show 5
  later show 5 --json
```

#### `later do`

```bash
later do <id>

Arguments:
  <id>                Item ID to start working on (required)

Examples:
  later do 3
  later do 7 --debug
```

#### `later update`

```bash
later update <id> [options]

Arguments:
  <id>                Item ID to update (required)

Options:
  --decision <text>   Updated decision text (max 500 chars)
  --context <text>    Updated context
  --status <status>   Updated status: pending, in-progress, done, archived
  --priority <level>  Updated priority: low, medium, high
  --tags <tags>       Updated tags (comma-separated, replaces existing)
  --add-tags <tags>   Add tags (comma-separated, keeps existing)
  --remove-tags <tags> Remove tags (comma-separated)
  --deps <ids>        Updated dependencies (comma-separated IDs)

Examples:
  later update 5 --status in-progress
  later update 3 --priority high --add-tags "urgent"
  later update 7 --context "New information after research" --status done
  later update 2 --deps "5,7"
```

#### `later delete`

```bash
later delete <id> [options]

Arguments:
  <id>                Item ID to delete (required)

Options:
  --hard              Permanently delete (default: soft delete/archive)

Examples:
  later delete 5               # Soft delete (archive)
  later delete 3 --hard        # Permanent deletion
```

#### `later bulk-update`

```bash
later bulk-update <ids> [options]

Arguments:
  <ids>               Comma-separated item IDs (required)

Options:
  --status <status>   Set status for all items
  --priority <level>  Set priority for all items
  --add-tags <tags>   Add tags to all items
  --remove-tags <tags> Remove tags from all items

Examples:
  later bulk-update 1,2,3 --status done
  later bulk-update 5,7,9 --priority high --add-tags "urgent"
```

#### `later bulk-delete`

```bash
later bulk-delete <ids> [options]

Arguments:
  <ids>               Comma-separated item IDs (required)

Options:
  --hard              Permanently delete (default: soft delete)

Examples:
  later bulk-delete 1,2,3
  later bulk-delete 5,7,9 --hard
```

#### `later search`

```bash
later search <query> [options]

Arguments:
  <query>             Search query (required)

Options:
  --fields <fields>   Fields to search: decision, context, tags (comma-separated)
  --limit <n>         Max results to return (default: 10)
  --min-score <n>     Minimum relevance score (default: 0.01)

Examples:
  later search "optimization"
  later search "database" --fields "decision,context" --limit 5
  later search "API design" --min-score 0.1
```

### Full Command Examples (User Experience)

```bash
# Quick capture
$ later capture "Should we refactor auth module?"
✅ Captured as item #8 (medium priority, pending)

# Capture with context
$ later capture "Migrate to TypeScript" \
  --context "Current codebase is 80% JS, 20% TS" \
  --priority high \
  --tags "refactoring,typescript"
✅ Captured as item #9 (high priority, pending)
Tags: refactoring, typescript

# List all pending high-priority items
$ later list --status pending --priority high
┌────┬─────────────────────────────────┬──────────┬────────────────────┬────────────┐
│ ID │ Decision                        │ Priority │ Tags               │ Created    │
├────┼─────────────────────────────────┼──────────┼────────────────────┼────────────┤
│ 9  │ Migrate to TypeScript           │ high     │ refactoring, ts    │ 2025-11-07 │
│ 6  │ Optimize CLAUDE.md size         │ high     │ docs, optimization │ 2025-11-06 │
└────┴─────────────────────────────────┴──────────┴────────────────────┴────────────┘

# Show full details
$ later show 9
╔══════════════════════════════════════════════════════════════════╗
║ Item #9: Migrate to TypeScript                                  ║
╚══════════════════════════════════════════════════════════════════╝

Decision:     Migrate to TypeScript
Status:       pending
Priority:     high
Tags:         refactoring, typescript
Created:      2025-11-07 10:23:15
Updated:      2025-11-07 10:23:15

Context:
Current codebase is 80% JS, 20% TS. Need to decide migration strategy.

# Start working on item
$ later do 9
✅ Item #9 marked as in-progress
✅ Created 3 todos in TodoWrite:
   - [ ] Audit current JS files
   - [ ] Create TypeScript migration plan
   - [ ] Set up stricter tsconfig.json

# Search
$ later search "typescript" --limit 3
┌────┬─────────────────────────────────┬───────┬────────────────────┬─────────────┐
│ ID │ Decision                        │ Score │ Tags               │ Matches     │
├────┼─────────────────────────────────┼───────┼────────────────────┼─────────────┤
│ 9  │ Migrate to TypeScript           │ 0.95  │ refactoring, ts    │ decision    │
│ 4  │ Add TypeScript to build process │ 0.72  │ build, tooling     │ context     │
└────┴─────────────────────────────────┴───────┴────────────────────┴─────────────┘

# JSON output (for scripting)
$ later list --status pending --json
[
  {
    "id": 9,
    "decision": "Migrate to TypeScript",
    "status": "pending",
    "priority": "high",
    "tags": ["refactoring", "typescript"],
    "created_at": "2025-11-07T10:23:15Z",
    "updated_at": "2025-11-07T10:23:15Z"
  }
]

# Error handling
$ later capture
❌ Error: Missing required argument: <decision>

Usage: later capture <decision> [options]

Run 'later capture --help' for more information.

$ later show 999
❌ Error: Item #999 not found

Tip: Run 'later list' to see all items.
```

---

## 3. MCP Communication Layer

### Architecture

The CLI acts as an **MCP client** that communicates with the MCP server via:
- **Protocol:** JSON-RPC 2.0
- **Transport:** stdio (spawn MCP server as subprocess)
- **Format:** Structured requests/responses

### MCP Client Implementation

See `src/cli/mcp-client.ts` for full implementation with:
- Connection management (spawn subprocess, stdio transport)
- Request/response handling (JSON-RPC)
- Timeout handling (configurable, default 5s)
- Error parsing (validation errors, tool not found, etc.)
- Debug logging (--debug flag shows requests/responses)

### Session Management

**Lifecycle:**

1. **CLI starts** → Spawn MCP server subprocess
2. **Execute command** → Send single JSON-RPC request
3. **Get response** → Parse and format output
4. **CLI exits** → Kill MCP server subprocess

**Why short-lived?**
- Simpler error handling (no state persistence)
- No need for server management (systemd, etc.)
- Fast enough for JSONL storage (~50-100ms overhead)
- Matches git model (each command is isolated)

---

## 4. Argument Parsing Strategy

### Library Choice: **Custom Parser (No Dependencies)**

**Rationale:**
- ✅ Zero dependencies (faster install, smaller bundle)
- ✅ Full control over error messages
- ✅ Tailored to git-style interface
- ✅ TypeScript-native (type-safe)

**Alternatives rejected:**
- `yargs` - Too heavy (20+ dependencies), opinionated output
- `commander.js` - Good, but adds dependency
- `minimist` - Too minimal (no validation, help generation)

### Parser Features

- Subcommand extraction (first non-flag argument)
- Global flags (--help, --version, --json, --debug, --no-color)
- Long flags with values (--priority high)
- Short flags with values (-p high)
- Boolean flags (--hard)
- Array flags (--tags "api,perf")
- Type coercion (strings → numbers, CSV → arrays)
- Validation against schema

See `src/cli/parser.ts` for full implementation.

### Type Coercion Strategy

**Principle:** Coerce at CLI layer, validate at MCP layer

- CLI validates: Required arguments, flag types, enum values
- MCP validates: Business rules, data integrity, security

---

## 5. Output Formatting

### Formatter Architecture

**Abstract Interface:**
- `formatCaptureResult()` - Success message for capture
- `formatListResult()` - Table/JSON for list
- `formatShowResult()` - Full item details
- `formatDoResult()` - Success with todos created
- `formatSearchResult()` - Search results with scores
- `formatUpdateResult()` - Success message for update
- `formatDeleteResult()` - Success message for delete
- `formatBulkResult()` - Summary of bulk operations

### Human-Readable Formatter

**Features:**
- ASCII tables (cli-table3)
- Color support (chalk, auto-detection)
- Status/priority color coding
- Text truncation for long content
- Date formatting (ISO → human-readable)

### JSON Formatter

**Features:**
- Machine-readable output
- Scripting-friendly
- No colors, no formatting

### Color Strategy

**Auto-detection:**
- Check `NO_COLOR` env var (disable if set)
- Check `FORCE_COLOR` env var (enable if set)
- Check if stdout is TTY (disable if pipe/redirect)
- Check `TERM` env var (disable if "dumb")

---

## 6. Help System Hierarchy

### Three Levels of Help

1. **Main help** (`later --help`)
   - List all subcommands
   - Show global flags
   - Basic usage examples

2. **Subcommand help** (`later capture --help`)
   - Command-specific usage
   - Required/optional arguments
   - Available flags
   - Examples

3. **Error context help** (shown on errors)
   - Suggestion to run `--help`
   - Relevant subcommand

### Help Generator

See `src/cli/help.ts` for:
- Main help text generation
- Subcommand help text generation
- Schema-driven help (automatically includes all flags)
- Examples embedded in help text

---

## 7. Error Handling Patterns

### Error Types & Exit Codes

```typescript
export enum ExitCode {
  SUCCESS = 0,
  USER_ERROR = 1,      // Invalid arguments, missing flags, etc.
  SYSTEM_ERROR = 2     // MCP server unavailable, timeout, etc.
}
```

### Error Classes

- `UserError` - User mistakes (missing args, invalid flags)
- `SystemError` - System issues (MCP unavailable, timeout)
- `CliError` - Base class with exit code and tip

### Error Formatting

**Structure:**
1. Error icon + message
2. Tip (actionable suggestion)
3. Context help (run --help for more info)

**Examples:**

```bash
❌ Error: Missing required argument: <decision>

Tip: Provide the decision text as the first argument

Run 'later capture --help' for usage information.
```

```bash
❌ Error: MCP server not available

Tip: Ensure /later is installed and built:
  cd ~/Projects/later
  npm install
  npm run build

For more help, see: ~/Projects/later/docs/cli/installation.md
```

---

## 8. Configuration Management

### Configuration File

**Location:** `~/.later/cli-config.json`

**Schema:**
```json
{
  "version": "1.0.0",
  "mcpServerPath": null,
  "defaultOutputFormat": "table",
  "colorEnabled": true,
  "timeout": 5000,
  "debug": false
}
```

### Configuration Precedence

**Highest to lowest:**
1. Command-line flags (`--json`, `--debug`, `--no-color`)
2. Environment variables (`LATER_OUTPUT_FORMAT`, `LATER_DEBUG`, `LATER_NO_COLOR`)
3. Config file (`~/.later/cli-config.json`)
4. Built-in defaults

### Environment Variables

- `LATER_OUTPUT_FORMAT` - Default output format (table/json)
- `LATER_TIMEOUT` - MCP request timeout (milliseconds)
- `LATER_DEBUG` - Enable debug mode (true/false)
- `LATER_NO_COLOR` - Disable colors (any value)

---

## 9. Testing Strategy

### Test Structure

```
tests/cli/
├── unit/                    # Pure logic (parser, formatter)
├── integration/             # CLI → MCP roundtrip
├── e2e/                     # Full user workflows
└── fixtures/                # Mock MCP server
```

### Test Coverage Targets

- **Unit tests:** 100% (parser, formatters, error handling)
- **Integration tests:** 95% (all 9 commands, error cases)
- **E2E tests:** 80% (critical workflows, edge cases)
- **Overall:** 90% code coverage

### Mock MCP Server

`tests/cli/fixtures/mock-server.ts` provides:
- In-memory storage
- All 9 tools implemented
- Controllable responses for testing
- Error injection for error case testing

---

## 10. Implementation Phases

### Phase 1: Minimal Viable CLI (MVP)

**Duration:** 1-2 days

**Scope:**
- ✅ Capture (minimal: decision only)
- ✅ List (no filters, show all)
- ✅ Show (by ID)
- ✅ Basic MCP client (stdio communication)
- ✅ Basic parser (manual argv parsing)
- ✅ Basic formatter (plain text)
- ✅ Basic error handling

**Deliverables:**
- Working `later capture "text"`, `later list`, `later show 5`
- No help system yet
- No flags/options yet
- No pretty output yet

### Phase 2: Full Feature Parity

**Duration:** 2-3 days

**Scope:**
- ✅ All 9 subcommands
- ✅ Full argument parsing (flags, validation)
- ✅ Argument validation
- ✅ Basic help system (--help flag)
- ✅ JSON output mode (--json flag)
- ✅ Structured error handling (exit codes)

**Deliverables:**
- All commands work with flags
- `later capture "text" --priority high --tags "api,perf"`
- `later list --status pending --priority high`
- `later --help` shows usage
- Errors show clear messages

### Phase 3: Enhanced UX

**Duration:** 2-3 days

**Scope:**
- ✅ Hierarchical help system
- ✅ Table-based output (cli-table3)
- ✅ Color support (chalk, auto-detection)
- ✅ Progress indicators (ora spinner)
- ✅ User-friendly error messages
- ✅ Configuration management
- ✅ --debug flag

**Deliverables:**
- Beautiful table output
- Color-coded output
- Context-aware help
- Helpful error messages with tips
- Config file support

### Phase 4: Advanced Features (Optional)

**Duration:** 1-2 days

**Scope:**
- ✅ Shell completion (bash, zsh)
- ✅ Command aliases
- ✅ Output templates
- ✅ Interactive mode
- ✅ Batch operations from file

**Note:** Phase 4 can be deferred to V2 based on user feedback.

---

## 11. Critical Design Decisions

### Decision 1: Language Choice - Node.js/TypeScript

**Why chosen:**
- ✅ Matches MCP server (same language)
- ✅ Can use MCP SDK directly
- ✅ Shared types between CLI and server
- ✅ Type safety (compile-time validation)
- ✅ Excellent ecosystem (chalk, cli-table3, etc.)
- ✅ Easy npm distribution
- ✅ Cross-platform

**Alternatives rejected:**
- Bash - Hard to maintain, no type safety
- Python - Introduces new language, no MCP SDK
- Go - Requires compilation, no MCP SDK

### Decision 2: Zero Business Logic Duplication

**Enforcement:**
- ❌ CLI does NOT import `src/storage/*`
- ❌ CLI does NOT import `src/validation/*`
- ❌ CLI does NOT import `src/tools/*` (except types)
- ✅ All data operations go through McpClient
- ✅ No business logic in command handlers
- ✅ No duplicate validation schemas

**CLI validates:** Argument types, required arguments, flag format
**MCP validates:** Business rules, data integrity, security

### Decision 3: Synchronization Strategy - Manual Sync

**Approach:**
1. MCP server adds new tool → Manual update CLI command handler
2. MCP server changes tool schema → Manual update CLI argument schema
3. Integration tests catch missing CLI updates

**Why chosen:**
- ✅ Simple (no automation complexity)
- ✅ Explicit (intentional changes only)
- ✅ Allows CLI-specific UX decisions

**Mitigation:**
- Integration tests catch missing updates
- Documentation checklist

**Alternatives rejected:**
- Auto-generated CLI - No control over UX
- Shared schema - Tight coupling

---

## 12. Installation & Distribution

### Package Configuration

**Update `package.json`:**
```json
{
  "bin": {
    "later": "./bin/later"
  },
  "scripts": {
    "build:cli": "tsc --project tsconfig.cli.json",
    "install:cli": "npm run build:cli && npm link"
  }
}
```

### Installation Methods

#### Method 1: Global npm Install (Recommended)

```bash
cd ~/Projects/later
npm install -g .
```

#### Method 2: npm link (Development)

```bash
cd ~/Projects/later
npm link
```

#### Method 3: Manual Symlink

```bash
cd ~/Projects/later
npm run build:cli
ln -sf ~/Projects/later/bin/later ~/.local/bin/later
```

### Version Management

**CLI shows both versions:**
```bash
$ later --version
later 1.0.0 (MCP server: 1.0.0)
```

**Version compatibility check:**
- CLI checks MCP server version on connect
- Warns if major version mismatch
- Suggests update if needed

---

## 13. Migration Path

### Current State

Users already using `/later` as MCP server via Claude Code.

### Goal

Add CLI without breaking existing MCP usage - both work concurrently.

### Migration Steps

1. **Install CLI:** `npm install -g .`
2. **Verify MCP still works:** Test Claude Code integration
3. **Test CLI:** Run `later --version`, `later list`
4. **Verify both work together:** CLI and MCP share same storage

### No Breaking Changes

**Shared Storage:**
- Both use `~/.later/items.jsonl`
- File locking prevents corruption
- Concurrent access supported

**No Config Changes:**
- MCP server config unchanged
- CLI has separate config

**No Code Changes:**
- MCP tools unchanged
- CLI is additive

### Rollback Plan

```bash
# Uninstall CLI
npm uninstall -g later

# MCP server continues working
```

---

## 14. Implementation Checklist

### Phase 1: MVP (1-2 days)
- [ ] Setup project structure (`src/cli/`, `tests/cli/`)
- [ ] Implement McpClient (stdio, JSON-RPC)
- [ ] Implement basic parser (manual argv parsing)
- [ ] Implement capture command handler
- [ ] Implement list command handler
- [ ] Implement show command handler
- [ ] Create bin/later executable
- [ ] Test MVP (capture, list, show work)

### Phase 2: Full Feature Parity (2-3 days)
- [ ] Implement ArgumentParser (flags, validation)
- [ ] Implement all 9 command handlers
- [ ] Add basic help system
- [ ] Add JSON output mode
- [ ] Add error handling (exit codes)
- [ ] Write unit tests (parser, formatters)
- [ ] Write integration tests (all commands)

### Phase 3: Enhanced UX (2-3 days)
- [ ] Implement TableFormatter (cli-table3, chalk)
- [ ] Implement HelpGenerator (hierarchical help)
- [ ] Implement ErrorFormatter (tips, context)
- [ ] Add ConfigLoader (config file + env vars)
- [ ] Add color auto-detection
- [ ] Add --debug flag
- [ ] Write E2E tests (workflows)

### Phase 4: Distribution (1 day)
- [ ] Update package.json (bin, scripts)
- [ ] Create installation docs
- [ ] Test npm install -g
- [ ] Test npm link
- [ ] Document migration path
- [ ] Update README.md

---

## 15. Success Criteria

**CLI is ready when:**

1. ✅ All 9 subcommands work with full flags
2. ✅ Help system complete (main + subcommand)
3. ✅ Output beautiful (tables, colors)
4. ✅ Errors helpful (tips, exit codes)
5. ✅ Tests pass (90% coverage)
6. ✅ Installable via npm
7. ✅ MCP server unchanged (no breaking changes)
8. ✅ Documentation complete

---

## 16. Next Steps

**Start with Phase 1 MVP:**

```bash
cd ~/Projects/later
mkdir -p src/cli tests/cli bin

# Create basic structure
touch src/cli/cli.ts
touch src/cli/mcp-client.ts
touch bin/later

# Start implementation
npm run build:cli
chmod +x bin/later

# Test
./bin/later capture "MVP test"
```

**Estimated Total Time:** 6-9 days (phases 1-3 complete, phase 4 polish)

---

## References

- ai-dev-environment patterns: Git-style CLI, JSON SSOT, platform abstraction
- Apple-style philosophy: Simple interface, complex orchestration hidden
- MCP SDK documentation: @modelcontextprotocol/sdk
- WoW principles: Proper file structure, one file = one responsibility
