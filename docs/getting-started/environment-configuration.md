# Environment Configuration & Secret Management

**Last Updated:** 2025-11-04
**Status:** Production Pattern
**Applies To:** All MCP servers requiring credentials

## Overview

This project uses a **system-wide environment variable** approach for managing secrets (API keys, tokens, credentials) required by MCP servers.

## Architecture Decision

### Why `/etc/environment`?

After thorough research and testing, we chose `/etc/environment` over alternatives because:

✅ **System-wide availability** - Works for all users (root, destiny, etc.)
✅ **Survives sudo** - Environment variables persist through `sudo` commands
✅ **Boot-time loading** - Variables available from system start
✅ **Shell-agnostic** - Works regardless of shell (bash, zsh, sh, etc.)
✅ **Non-interactive process support** - MCP servers spawn as non-interactive processes
✅ **Standard Linux practice** - Documented pattern for system services

### Alternatives Considered & Rejected

| Approach | Why Rejected |
|----------|--------------|
| `.bashrc` | Only loaded in interactive bash shells; MCP servers don't source it |
| Hardcoded in `.mcp.json` | **Security risk** - secrets in version control, plain text exposure |
| `.env` file + wrapper | Over-engineering for single-machine personal use |
| `~/.credentials.json` | Claude Code uses this for OAuth tokens, not custom MCP secrets |

## Current Configuration

### Storage Location

**File:** `/etc/environment`

```bash
SUPABASE_URL="https://gpfuubmxhrcgfefvbvyh.supabase.co"
SUPABASE_ACCESS_TOKEN="sbp_5943020f491eab14a5b9c5a1c427cda0381bc9cc"
```

### MCP Configuration

**File:** `/root/.claude/.mcp.json` (symlinked to `/mnt/c/Users/Destiny/.claude/.mcp.json`)

```json
{
  "mcpServers": {
    "later": {
      "command": "node",
      "args": ["/root/Projects/later/dist/index.js"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "${SUPABASE_ACCESS_TOKEN}"
      ]
    }
  }
}
```

**Key Points:**
- Uses `${VAR}` syntax (Claude Code's expansion format)
- Claude Code expands variables at MCP server spawn time
- No hardcoded secrets in configuration files
- Safe to commit `.mcp.json` to version control (contains only references)

## How Variable Expansion Works

Claude Code supports environment variable expansion in MCP configurations:

- `${VAR}` - Expands to environment variable value
- `${VAR:-default}` - Uses default if variable is unset
- Expansion happens in: `command`, `args`, `env`, `url`, `headers`

**Source:** [Claude Code MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)

## Setup Instructions

### Adding New Secrets

1. **Edit `/etc/environment`** (requires sudo):
   ```bash
   sudo nano /etc/environment
   ```

2. **Add your secret** (one per line, no `export` keyword):
   ```
   MY_API_KEY="your-secret-key-here"
   ```

3. **Reload environment** (choose one):
   ```bash
   # Option A: Source into current session
   set -a && source /etc/environment && set +a

   # Option B: Full restart (recommended for Claude Code)
   exit  # Exit current session
   sudo claude -c  # Start new session
   ```

### Updating MCP Configuration

1. **Edit `~/.claude/.mcp.json`**:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "node",
         "args": ["/path/to/server.js"],
         "env": {
           "MY_API_KEY": "${MY_API_KEY}"
         }
       }
     }
   }
   ```

2. **Restart Claude Code** to apply changes

## Verification

### Check Environment Variables

```bash
# Verify variable is set in current session
echo "Token: ${SUPABASE_ACCESS_TOKEN:0:10}..."

# Verify in sudo context (how Claude Code runs)
sudo bash -c 'echo "Token: ${SUPABASE_ACCESS_TOKEN:0:10}..."'

# Check /etc/environment contents
cat /etc/environment
```

### Test MCP Server

```bash
# Manual test with explicit environment
cd ~/Projects/later
SUPABASE_URL="$SUPABASE_URL" SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" \
  node dist/index.js
```

### Check Claude Code Debug Logs

```bash
# View latest Claude Code session log
cat ~/.claude/debug/latest | grep -i "mcp\|supabase"
```

## Security Considerations

### Current Protection

✅ **Not in version control** - `/etc/environment` is system file, never committed
✅ **Proper permissions** - Root-owned, 644 permissions (read-only for non-root)
✅ **Centralized SSOT** - Single source of truth, no duplication
✅ **Audit trail** - Can track changes via system logs

### Known Limitations

⚠️ **System-wide visibility** - Any user can read `/etc/environment`
⚠️ **Plain text storage** - Not encrypted at rest
⚠️ **WSL2 Windows mount** - File is on Windows filesystem, inherits Windows security

### For Enhanced Security (Future)

If sharing machine or stricter security needed:

1. **User-level secrets:** Use `~/.pam_environment` (user-specific)
2. **Encryption:** Use GPG to encrypt secrets, decrypt at runtime
3. **Secret manager:** Integrate with HashiCorp Vault, AWS Secrets Manager, etc.
4. **Systemd credentials:** Use `systemd.exec` credentials (if running as systemd service)

## Troubleshooting

### MCP Server Can't Access Variables

**Symptom:** "Environment variable not set" errors

**Diagnosis:**
```bash
# Check if variable exists
grep MY_VAR /etc/environment

# Test in sudo context
sudo bash -c 'echo "MY_VAR=${MY_VAR:-NOT SET}"'
```

**Fix:**
- Ensure variable is in `/etc/environment` (not `.bashrc`)
- Use `${VAR}` syntax (not `$VAR`) in `.mcp.json`
- Restart Claude Code session (not just reload config)

### Variables Not Expanding

**Symptom:** MCP server receives literal `${VAR}` string

**Diagnosis:** Check `.mcp.json` syntax

**Fix:**
- Correct: `"env": { "KEY": "${MY_KEY}" }`
- Wrong: `"env": { "KEY": "$MY_KEY" }`
- Wrong: `"args": ["$MY_KEY"]` (no braces)

### Permission Denied

**Symptom:** Can't edit `/etc/environment`

**Fix:**
```bash
sudo nano /etc/environment
```

## Migration History

### 2025-11-04: Hardcoded → Environment Variables

**Before:**
```json
"env": {
  "SUPABASE_ACCESS_TOKEN": "sbp_5943020..." // ❌ Hardcoded
}
```

**After:**
```json
"env": {
  "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" // ✅ Variable reference
}
```

**Rationale:**
- Security: Secrets not in config files
- Maintainability: Single source of truth
- Portability: Same config works across environments (dev/prod)

### Cleanup Actions

1. ✅ Removed hardcoded token from `.mcp.json`
2. ✅ Added tokens to `/etc/environment`
3. ✅ Updated `.bashrc` comment (removed duplicate export)
4. ✅ Verified in both root and destiny user contexts

## Best Practices

### DO ✅

- Store secrets in `/etc/environment`
- Use `${VAR}` expansion syntax in MCP configs
- Verify variables are accessible in sudo context
- Document secret locations in project README
- Keep `.mcp.json` in version control (no hardcoded secrets)

### DON'T ❌

- Hardcode secrets in `.mcp.json`
- Use `.bashrc` for secrets needed by non-interactive processes
- Commit `/etc/environment` to version control
- Use `$VAR` syntax (wrong expansion format)
- Mix secret storage locations (causes drift)

## Related Documentation

- [MCP Server Implementation](../technical/implementation/mcp-server-implementation.md)
- [Installation Guide](installation.md)
- [Security Considerations](../reference/security-considerations.md)

---

**References:**
- Claude Code MCP Docs: https://docs.claude.com/en/docs/claude-code/mcp
- Linux Environment Variables: `/etc/environment` vs `.bashrc`
- 12-Factor App: Config in environment
