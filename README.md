# @chude/later

**MCP Server for Deferred Decision Management**

Capture decisions with full context, revisit later without memory overhead. A production-ready Model Context Protocol (MCP) server following the MCP 2025-06 specification.

[![npm version](https://badge.fury.io/js/@chude%2Flater.svg)](https://www.npmjs.com/package/@chude/later)
[![CI](https://github.com/chudeemeke/later/actions/workflows/ci.yml/badge.svg)](https://github.com/chudeemeke/later/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

During complex work, you encounter decisions that:

- Aren't urgent enough to do now
- Require significant context to understand later
- Get lost in conversation history
- Are expensive to reconstruct from memory

**Example:** "Should I optimize CLAUDE.md (3,343 words) now or later? What were the options? What was recommended?"

## The Solution

```bash
# Capture decision with context
later_capture: "Optimize CLAUDE.md size"

# Later... review deferred items
later_list

# Get full context
later_show 1

# Start working on it
later_do 1
```

## Installation

### npm (Global)

```bash
npm install -g @chude/later
```

### Claude Code Integration

Add to your Claude Code MCP configuration (`~/.claude/.mcp.json`):

```json
{
  "mcpServers": {
    "later": {
      "command": "npx",
      "args": ["@chude/later"],
      "env": {}
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "later": {
      "command": "later-mcp",
      "env": {}
    }
  }
}
```

### From Source

```bash
git clone https://github.com/chudeemeke/later.git
cd later
npm install
npm run build
```

## Features

### Progressive Tool Disclosure

Only the `search_tools` meta-tool is exposed initially, reducing token overhead by ~90%. Other tools are discovered on-demand:

```
search_tools: "create a decision"
# Returns: later_capture tool with schema
```

### Automatic PII Protection

Sensitive data in context is automatically detected and tokenized:

- API keys (OpenAI, Anthropic, GitHub, etc.)
- Passwords and secrets
- Social Security Numbers
- Credit card numbers
- Email addresses
- IP addresses
- Phone numbers

Detection rate: 95%+ accuracy with zero false negatives on tested patterns.

### Available Tools

| Tool                | Description                                 |
| ------------------- | ------------------------------------------- |
| `search_tools`      | Discover tools based on what you want to do |
| `later_capture`     | Capture a decision with context             |
| `later_list`        | List and filter deferred items              |
| `later_show`        | Show full item details                      |
| `later_do`          | Mark item as in-progress, get todo guidance |
| `later_update`      | Update any item field                       |
| `later_delete`      | Soft or hard delete items                   |
| `later_bulk_update` | Update multiple items at once               |
| `later_bulk_delete` | Delete multiple items at once               |
| `later_search`      | Full-text search with relevance ranking     |

### MCP 2025-06 Compliance

- outputSchema for all tools (typed responses)
- Structured error handling with isError pattern
- All logging to stderr (stdout reserved for protocol)
- Graceful shutdown handling
- Progressive tool disclosure

## CLI Usage

```bash
# Capture a decision
later capture "Refactor authentication module"

# Capture with context and priority
later capture "Migrate to PostgreSQL" --context "Current MySQL has scaling issues" --priority high --tags "database,migration"

# List all items
later list

# Filter items
later list --status pending --priority high
later list --tags "refactor"

# Show item details
later show 1

# Start working on an item
later do 1

# Update item
later update 1 --status done
later update 1 --priority medium --tags "completed,v2"

# Delete (soft - archives)
later delete 1

# Delete (hard - permanent)
later delete 1 --hard

# Search
later search "authentication"
```

## Data Storage

Items are stored in `~/.later/items.jsonl`:

- JSONL format (one JSON object per line)
- Atomic writes with file locking
- Automatic corruption recovery
- Secure file permissions (600)

## API Reference

### later_capture

```typescript
{
  decision: string;      // Required: Decision text (1-500 chars)
  context?: string;      // Optional: Additional context
  tags?: string[];       // Optional: Categorization tags
  priority?: 'low' | 'medium' | 'high';  // Default: medium
}
```

### later_list

```typescript
{
  status?: 'pending' | 'in-progress' | 'done' | 'archived';
  tags?: string[];       // Filter by tags (OR logic)
  priority?: 'low' | 'medium' | 'high';
  limit?: number;        // Default: 50
}
```

### later_search

```typescript
{
  query: string;         // Required: Search query
  status?: string;       // Filter by status
  tags?: string[];       // Filter by tags
  priority?: string;     // Filter by priority
  limit?: number;        // Default: 10
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Watch mode
npm run watch
```

## Test Coverage

- Statements: 98.31%
- Branches: 95.06%
- Functions: 98.88%
- Lines: 98.46%

All coverage metrics exceed the 95% quality gate threshold.

## Architecture

```
src/
  index.ts              # MCP server entry point
  registry.ts           # Tool registry for progressive disclosure
  types.ts              # TypeScript type definitions
  schemas/              # Output schemas (MCP 2025-06)
  storage/              # JSONL storage with file locking
  tools/
    core/               # capture, list, show
    workflow/           # do, update, delete
    batch/              # bulk operations
    search/             # full-text search
    meta/               # search_tools
  utils/                # Utilities (logger, validation, etc.)
  cli/                  # CLI client
```

## Security

- Automatic PII detection and tokenization
- Secret sanitization (API keys, passwords)
- Secure file permissions (600/700)
- Input validation with Zod schemas
- No SQL injection risk (JSONL storage)

## Requirements

- Node.js >= 18.0.0
- Compatible with Claude Code, Claude Desktop, or any MCP client

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs to the main branch.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Support

- Issues: https://github.com/chudeemeke/later/issues
- Documentation: https://github.com/chudeemeke/later#readme

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) SDK.
