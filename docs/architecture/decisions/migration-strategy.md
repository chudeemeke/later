# Migration Strategy: Slash Command → MCP Server

**Decision Date:** 2025-01-31
**Status:** Approved
**Context:** Need clean upgrade path from MVP (bash/slash command) to V1 (MCP server) without data loss or conflicts

---

## Problem

When upgrading from slash command implementation to MCP server:
- How to prevent duplicate systems running simultaneously?
- How to preserve existing data (JSONL items)?
- How to deprecate old system without breaking user workflows?
- How to enable rollback if migration fails?

## Solution: Automated Zero-Downtime Migration

### Architecture

```
Phase 1: Slash Command (MVP)
~/.claude/commands/later.md          # User types /later
~/.local/bin/later                   # Bash script backend
~/.later/items.jsonl                 # Data store
~/.later/config.json                 # version: "0.1.0-slash"

Phase 2: MCP Server (V1)
~/Projects/later/dist/index.js       # MCP server backend
~/.claude/commands/later.md.deprecated  # Auto-moved (30-day grace)
~/.local/bin/later                   # Kept as CLI fallback
~/.later/items.jsonl                 # SAME data (unchanged)
~/.later/config.json                 # version: "1.0.0-mcp"
```

### Key Principles

1. **Single Source of Truth:** `~/.later/config.json` tracks active backend
2. **Automatic Detection:** MCP server checks config on startup
3. **Data Preservation:** JSONL stays intact, only backend changes
4. **Graceful Deprecation:** 30-day grace period before cleanup
5. **Rollback Support:** Always backup before migration

---

## Implementation Details

### 1. Version Detection via config.json

**MVP creates this on first run:**
```json
{
  "version": "0.1.0-slash",
  "backend": "slash-command",
  "storage": "jsonl",
  "data_dir": "~/.later",
  "installed_at": "2025-01-15T10:30:00Z"
}
```

**After MCP migration:**
```json
{
  "version": "1.0.0-mcp",
  "backend": "mcp-server",
  "storage": "jsonl",
  "data_dir": "~/.later",
  "installed_at": "2025-01-15T10:30:00Z",
  "upgraded_at": "2025-02-01T14:20:00Z",
  "previous_version": "0.1.0-slash"
}
```

### 2. Migration Script

**Location:** `~/.local/bin/later-upgrade`

```bash
#!/bin/bash
# Auto-invoked by MCP server on first startup

set -euo pipefail

LATER_DIR="$HOME/.later"
CONFIG_FILE="$LATER_DIR/config.json"
TIMESTAMP=$(date +%s)

echo "🔄 Migrating /later to MCP server..."

# 1. Validate prerequisites
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ No config.json found. Nothing to migrate."
  exit 1
fi

CURRENT_BACKEND=$(jq -r '.backend' "$CONFIG_FILE")

if [ "$CURRENT_BACKEND" = "mcp-server" ]; then
  echo "✅ Already using MCP server. No migration needed."
  exit 0
fi

# 2. Backup existing data
echo "📦 Backing up data..."
cp "$LATER_DIR/items.jsonl" "$LATER_DIR/items.jsonl.backup-$TIMESTAMP"
cp "$CONFIG_FILE" "$CONFIG_FILE.backup-$TIMESTAMP"

# 3. Update config to mark MCP active
echo "⚙️  Updating config..."
jq --arg ts "$(date -Iseconds)" \
   '.version = "1.0.0-mcp" |
    .backend = "mcp-server" |
    .upgraded_at = $ts |
    .previous_version = .version' \
   "$CONFIG_FILE" > "$CONFIG_FILE.tmp"

mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

# 4. Deprecate old slash command (30-day grace period)
SLASH_CMD="$HOME/.claude/commands/later.md"
if [ -f "$SLASH_CMD" ]; then
  echo "🗂️  Deprecating old slash command..."
  mv "$SLASH_CMD" "$SLASH_CMD.deprecated-$TIMESTAMP"
  echo "  → Moved to: $SLASH_CMD.deprecated-$TIMESTAMP"
fi

# 5. Schedule cleanup (30 days from now)
CLEANUP_DATE=$(date -d "+30 days" +%Y-%m-%d 2>/dev/null || date -v+30d +%Y-%m-%d)
echo "$CLEANUP_DATE: Delete $SLASH_CMD.deprecated-$TIMESTAMP" >> "$LATER_DIR/.scheduled-cleanups"

# 6. Keep bash script as CLI fallback (no action needed)

echo "✅ Migration complete!"
echo ""
echo "Summary:"
echo "  • MCP server now active"
echo "  • Data preserved: $LATER_DIR/items.jsonl"
echo "  • Backup created: items.jsonl.backup-$TIMESTAMP"
echo "  • Old slash command deprecated (cleanup in 30 days)"
echo ""
echo "Register MCP server with:"
echo "  claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js"
```

### 3. MCP Server Startup Check

**In `dist/index.ts`:**

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LATER_DIR = path.join(process.env.HOME!, '.later');
const CONFIG_FILE = path.join(LATER_DIR, 'config.json');
const CURRENT_VERSION = '1.0.0-mcp';

async function initializeServer(): Promise<void> {
  console.log('🚀 Starting /later MCP server...');

  // Check if config exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log('📝 Creating initial config...');
    createInitialConfig();
    return;
  }

  // Read current config
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

  // Check if migration needed
  if (config.backend === 'slash-command') {
    console.log('🔄 Detecting old slash command installation...');
    try {
      execSync(`${process.env.HOME}/.local/bin/later-upgrade`, {
        stdio: 'inherit'
      });
      console.log('✅ Migration complete. MCP server ready.');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    return;
  }

  // Check if version upgrade needed (data schema migrations)
  if (config.version !== CURRENT_VERSION) {
    console.log(`🔄 Upgrading from ${config.version} to ${CURRENT_VERSION}...`);
    await migrateDataSchema(config.version, CURRENT_VERSION);
  }

  console.log('✅ /later MCP server ready.');
}

function createInitialConfig(): void {
  const config = {
    version: CURRENT_VERSION,
    backend: 'mcp-server',
    storage: 'jsonl',
    data_dir: LATER_DIR,
    installed_at: new Date().toISOString()
  };

  fs.mkdirSync(LATER_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function migrateDataSchema(from: string, to: string): Promise<void> {
  // Future: Handle schema changes between versions
  console.log(`Schema migration ${from} → ${to} (no changes needed)`);
}

// Call during server startup
await initializeServer();
```

### 4. Conflict Prevention During Grace Period

**Bash script checks before executing:**

```bash
#!/bin/bash
# ~/.local/bin/later (bash CLI)

CONFIG_FILE="$HOME/.later/config.json"

# Check if MCP server is active
if [ -f "$CONFIG_FILE" ]; then
  BACKEND=$(jq -r '.backend' "$CONFIG_FILE" 2>/dev/null || echo "unknown")

  if [ "$BACKEND" = "mcp-server" ]; then
    echo "⚠️  You're using the old CLI. The MCP server is now active."
    echo ""
    echo "Recommended actions:"
    echo "  • Use /later commands in Claude Code"
    echo "  • Check MCP status: claude mcp list"
    echo "  • Remove old CLI: rm ~/.local/bin/later"
    echo ""
    echo "To proceed anyway, use: later --force [command]"

    if [[ "$1" != "--force" ]]; then
      exit 1
    fi

    # Shift --force flag and continue
    shift
  fi
fi

# Continue with bash implementation...
```

### 5. Automatic Cleanup After Grace Period

**Cron job or MCP server periodic check:**

```typescript
// In MCP server background task (runs daily)
async function checkScheduledCleanups(): Promise<void> {
  const cleanupFile = path.join(LATER_DIR, '.scheduled-cleanups');

  if (!fs.existsSync(cleanupFile)) return;

  const lines = fs.readFileSync(cleanupFile, 'utf-8').split('\n');
  const today = new Date().toISOString().split('T')[0];
  const remaining: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const [date, ...actionParts] = line.split(': ');
    const action = actionParts.join(': ');

    if (date <= today) {
      // Execute cleanup
      console.log(`🗑️  Cleanup: ${action}`);

      if (action.startsWith('Delete ')) {
        const filePath = action.replace('Delete ', '').trim();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`   ✅ Deleted: ${filePath}`);
        }
      }
    } else {
      // Keep for future
      remaining.push(line);
    }
  }

  // Update cleanup schedule
  fs.writeFileSync(cleanupFile, remaining.join('\n'));
}
```

---

## Rollback Support

**If migration fails or user wants to revert:**

```bash
# ~/.local/bin/later rollback --to-slash

#!/bin/bash

set -euo pipefail

LATER_DIR="$HOME/.later"
CONFIG_FILE="$LATER_DIR/config.json"

echo "🔙 Rolling back to slash command..."

# 1. Find most recent backup
LATEST_BACKUP=$(ls -t "$LATER_DIR"/config.json.backup-* 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ No backup found. Cannot rollback."
  exit 1
fi

BACKUP_TIMESTAMP=$(echo "$LATEST_BACKUP" | grep -oE '[0-9]+$')

# 2. Restore config
cp "$LATEST_BACKUP" "$CONFIG_FILE"
echo "✅ Config restored from backup"

# 3. Restore data if needed
if [ -f "$LATER_DIR/items.jsonl.backup-$BACKUP_TIMESTAMP" ]; then
  cp "$LATER_DIR/items.jsonl.backup-$BACKUP_TIMESTAMP" "$LATER_DIR/items.jsonl"
  echo "✅ Data restored from backup"
fi

# 4. Restore slash command
SLASH_CMD="$HOME/.claude/commands/later.md"
DEPRECATED_CMD=$(ls -t "$SLASH_CMD.deprecated-"* 2>/dev/null | head -1)

if [ -n "$DEPRECATED_CMD" ]; then
  cp "$DEPRECATED_CMD" "$SLASH_CMD"
  echo "✅ Slash command restored"
fi

# 5. Remove MCP server registration
echo "⚠️  Manually remove MCP server with:"
echo "  claude mcp remove later"

echo ""
echo "✅ Rollback complete. Slash command active again."
```

---

## Future: JSONL → SQLite Migration (V2)

**Similar pattern for V2 storage upgrade:**

```typescript
async function migrateToSQLite(): Promise<void> {
  console.log('🔄 Migrating JSONL → SQLite...');

  const jsonlPath = path.join(LATER_DIR, 'items.jsonl');
  const dbPath = path.join(LATER_DIR, 'items.db');

  // 1. Backup JSONL
  const timestamp = Date.now();
  fs.copyFileSync(jsonlPath, `${jsonlPath}.pre-sqlite-${timestamp}`);

  // 2. Read all items
  const items = readJSONL(jsonlPath);
  console.log(`📚 Found ${items.length} items to migrate`);

  // 3. Create SQLite DB with schema
  const db = new Database(dbPath);
  db.exec(CREATE_TABLES_SQL);

  // 4. Insert all items with transaction
  const insert = db.prepare(`
    INSERT INTO items (id, decision, context, status, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      insert.run(
        item.id,
        item.decision,
        JSON.stringify(item.context),
        item.status,
        JSON.stringify(item.tags),
        item.created_at
      );
    }
  });

  transaction(items);

  // 5. Update config
  updateConfig({
    version: '2.0.0-sqlite',
    storage: 'sqlite',
    migrated_from_jsonl: true,
    jsonl_backup: `items.jsonl.pre-sqlite-${timestamp}`
  });

  // 6. Keep JSONL as backup for 90 days
  const cleanupDate = new Date();
  cleanupDate.setDate(cleanupDate.getDate() + 90);

  scheduleCleanup(
    cleanupDate.toISOString().split('T')[0],
    `Delete ${jsonlPath}.pre-sqlite-${timestamp}`
  );

  console.log('✅ Migration complete. JSONL backed up for 90 days.');
  console.log(`   Backup: ${jsonlPath}.pre-sqlite-${timestamp}`);
}
```

---

## Testing Strategy

### Manual Testing Scenarios

**Test 1: Clean MVP → MCP Migration**
```bash
# 1. Install MVP
/later "test decision"
ls ~/.claude/commands/later.md  # Should exist
jq .backend ~/.later/config.json  # Should be "slash-command"

# 2. Install MCP server
claude mcp add --transport stdio later -- node ~/Projects/later/dist/index.js

# 3. Trigger migration (first MCP call)
# Should auto-run later-upgrade

# 4. Verify
jq .backend ~/.later/config.json  # Should be "mcp-server"
ls ~/.claude/commands/later.md.deprecated-*  # Should exist
ls ~/.later/items.jsonl.backup-*  # Should exist
```

**Test 2: Rollback**
```bash
# After migration
later rollback --to-slash

# Verify
jq .backend ~/.later/config.json  # Should be "slash-command"
ls ~/.claude/commands/later.md  # Should exist (restored)
```

**Test 3: Data Preservation**
```bash
# Before migration
/later "important decision"
jq '.decision' ~/.later/items.jsonl | tail -1

# After migration
# Same item should exist with same ID

# Via MCP server
later list  # Should show "important decision"
```

**Test 4: Conflict Prevention**
```bash
# After MCP active
~/.local/bin/later list
# Should warn: "MCP server is now active"

# Force old CLI
~/.local/bin/later --force list
# Should execute despite warning
```

### Automated Tests

**File:** `tests/test_migration.sh`

```bash
#!/bin/bash

source tests/test_helpers.sh

test_clean_migration() {
  # Setup MVP
  setup_slash_command_install

  # Add test data
  /later "test item 1"
  /later "test item 2"

  ITEM_COUNT_BEFORE=$(wc -l < ~/.later/items.jsonl)

  # Run migration
  ~/.local/bin/later-upgrade

  # Verify
  assert_equals "mcp-server" "$(jq -r .backend ~/.later/config.json)"
  assert_file_exists ~/.later/items.jsonl.backup-*
  assert_file_exists ~/.claude/commands/later.md.deprecated-*

  ITEM_COUNT_AFTER=$(wc -l < ~/.later/items.jsonl)
  assert_equals "$ITEM_COUNT_BEFORE" "$ITEM_COUNT_AFTER" "Data count preserved"
}

test_idempotent_migration() {
  # Run migration twice
  ~/.local/bin/later-upgrade
  ~/.local/bin/later-upgrade

  # Should not create duplicate backups or fail
  assert_equals "mcp-server" "$(jq -r .backend ~/.later/config.json)"
}

test_rollback() {
  # Migrate
  ~/.local/bin/later-upgrade

  # Rollback
  ~/.local/bin/later rollback --to-slash

  # Verify
  assert_equals "slash-command" "$(jq -r .backend ~/.later/config.json)"
  assert_file_exists ~/.claude/commands/later.md
}

run_tests
```

---

## Decision Rationale

### Why Automatic Detection?
**Alternative:** Manual "uninstall old, install new" process

**Rejected because:**
- ❌ Error-prone (users forget steps)
- ❌ Risk of data loss
- ❌ Poor UX (requires reading migration guide)

**Chosen approach:**
- ✅ Zero manual steps
- ✅ Automatic data preservation
- ✅ "Just works" experience

### Why 30-Day Grace Period?
**Alternative:** Immediate deletion of old system

**Rejected because:**
- ❌ No time to verify migration succeeded
- ❌ Can't rollback if issues discovered later

**Chosen approach:**
- ✅ User can verify new system works
- ✅ Old system available as fallback
- ✅ Auto-cleanup prevents cruft accumulation

### Why Keep Bash Script?
**Alternative:** Remove bash CLI entirely

**Rejected because:**
- ❌ Removes terminal usage (not everyone uses Claude Code)
- ❌ MCP server might not be running

**Chosen approach:**
- ✅ Bash CLI stays as fallback
- ✅ Warns if MCP active (prevents confusion)
- ✅ User can force old behavior with `--force`

---

## Related Documents

- [MCP Server Implementation](../../technical/implementation/mcp-server-implementation.md) - Technical details of MCP server
- [Storage Mechanism](./storage-mechanism.md) - Original JSONL → SQLite decision
- [Schema Evolution](./schema-evolution.md) - How schema changes are handled

---

## Changelog

- **2025-01-31:** Initial migration strategy defined
- **Future:** V2 SQLite migration (when item count > 500)
