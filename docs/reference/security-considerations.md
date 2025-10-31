# Security Considerations

**Last Updated:** 2025-10-31
**Security Model:** Defense in depth

## Overview

Deferred items may contain sensitive information:
- Decision context with proprietary details
- API keys/tokens in conversation history
- Personal information
- Security-related decisions

**Key principle:** Protect by default, user-controllable.

## Threat Model

**In scope:**
- Accidental secret exposure (capture API keys)
- Unauthorized file access (file permissions)
- Data exfiltration (export to insecure location)
- Context injection attacks (malicious input)

**Out of scope:**
- Physical device theft (use full-disk encryption)
- Remote system compromise (use OS security)
- Side-channel attacks (not our threat model)

## Secret Detection and Sanitization

### Auto-Detect Secrets

```bash
detect_secrets() {
  local text="$1"

  # Common secret patterns
  local patterns=(
    "sk-[a-zA-Z0-9]{32,}"           # API keys (Anthropic, OpenAI)
    "ghp_[a-zA-Z0-9]{36}"            # GitHub tokens
    "xox[baprs]-[a-zA-Z0-9-]+"      # Slack tokens
    "[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}" # Credit cards
    "-----BEGIN [A-Z ]+ KEY-----"    # PEM keys
    "AIza[0-9A-Za-z\\-_]{35}"       # Google API keys
  )

  for pattern in "${patterns[@]}"; do
    if echo "$text" | grep -qE "$pattern"; then
      return 0  # Secret detected
    fi
  done

  return 1  # No secrets
}
```

### Warn User

```bash
/later "Investigate API authentication issue"

⚠️  Warning: Potential secrets detected in conversation

The following patterns were found:
  - API key (sk-...)
  - GitHub token (ghp_...)

Options:
  [S]anitize automatically (replace with [REDACTED])
  [K]eep as-is (I'll be careful)
  [N]o context (skip context extraction)

Choice [S]: _
```

### Automatic Sanitization

```bash
sanitize_secrets() {
  local text="$1"

  # Replace patterns with placeholders
  text=$(echo "$text" | sed -E '
    s/sk-[a-zA-Z0-9]{32,}/[REDACTED-API-KEY]/g
    s/ghp_[a-zA-Z0-9]{36}/[REDACTED-GITHUB-TOKEN]/g
    s/xox[baprs]-[a-zA-Z0-9-]+/[REDACTED-SLACK-TOKEN]/g
    s/[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}/[REDACTED-CC]/g
    s/-----BEGIN [A-Z ]+ KEY-----.*-----END [A-Z ]+ KEY-----/[REDACTED-PEM-KEY]/gs
  ')

  echo "$text"
}
```

## File Permissions

**Restrictive by default:**
```bash
# Data files: user-only read/write
chmod 600 ~/.later/deferred.jsonl
chmod 600 ~/.later/deferred.db

# Directory: user-only access
chmod 700 ~/.later/

# Backups: same permissions
chmod 600 ~/.later/backups/*.jsonl
```

**Verify on startup:**
```bash
check_permissions() {
  local file="$HOME/.later/deferred.jsonl"

  # Check if world-readable
  if [[ $(stat -f %A "$file") -gt 600 ]]; then
    echo "⚠️  Warning: ~/.later/deferred.jsonl is world-readable" >&2
    echo "   Fix: chmod 600 ~/.later/deferred.jsonl" >&2
  fi
}
```

## Encryption at Rest (Optional)

**GPG encryption for sensitive data:**
```bash
# Enable encryption
/later config --encrypt-at-rest

Encryption requires GPG key.
Select key:
  1. chude@emeke.org (4096R/ABC123)
  2. Generate new key

Choice: 1

✅ Encryption enabled
   Data will be encrypted with GPG

# All writes encrypted
echo "$item" | gpg --encrypt -r chude@emeke.org >> deferred.jsonl.gpg

# Reads decrypted transparently
gpg --decrypt deferred.jsonl.gpg | jq .
```

## Export Security

**Warn before insecure export:**
```bash
/later export --output /tmp/backup.jsonl

⚠️  Warning: Exporting to /tmp (temporary, insecure)

/tmp files may be:
  - Deleted on reboot
  - Accessible by other users
  - Excluded from backups

Recommend: Export to ~/Documents or ~/iCloud instead

Continue? [y/N] _
```

**Audit log for exports:**
```bash
# Log all exports
echo "$(date +%s)|export|$output_path|$(whoami)" >> ~/.later/audit.log

# Review exports
/later audit-log --last 10
```

## Input Validation

**Prevent injection:**
```bash
validate_input() {
  local input="$1"

  # Check for shell metacharacters
  if echo "$input" | grep -qE '[$`!;|&<>]'; then
    echo "ERROR: Input contains shell metacharacters" >&2
    return 1
  fi

  # Check max length
  if [[ ${#input} -gt 1000 ]]; then
    echo "ERROR: Input too long (max 1000 chars)" >&2
    return 1
  fi

  return 0
}
```

**Escape dangerous characters:**
```bash
escape_shell() {
  local input="$1"

  # Escape: $ ` \ " '
  input="${input//\\/\\\\}"  # \ → \\
  input="${input//\$/\\\$}"  # $ → \$
  input="${input//\`/\\\`}"  # ` → \`
  input="${input//\"/\\\"}"  # " → \"

  echo "$input"
}
```

## API Key Management

**Never store in code:**
```bash
# ❌ WRONG
ANTHROPIC_API_KEY="sk-1234567890"

# ✅ CORRECT
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  echo "ERROR: ANTHROPIC_API_KEY not set" >&2
  echo "   export ANTHROPIC_API_KEY=sk-..." >&2
  exit 1
fi
```

**Load from secure location:**
```bash
# From environment
export ANTHROPIC_API_KEY="sk-..."

# From keychain (macOS)
ANTHROPIC_API_KEY=$(security find-generic-password -s "later-api-key" -w)

# From 1Password CLI
ANTHROPIC_API_KEY=$(op read "op://Personal/Anthropic/api-key")
```

## Security Checklist

**Before first release:**
- [ ] File permissions enforced (600/700)
- [ ] Secret detection implemented
- [ ] Input validation on all user input
- [ ] Shell metacharacters escaped
- [ ] Export warnings for insecure paths
- [ ] No secrets in code/config
- [ ] GPG encryption option available
- [ ] Audit log for sensitive operations

**Before each export:**
- [ ] Review for secrets
- [ ] Verify export destination is secure
- [ ] Check file permissions on export

**Regular maintenance:**
- [ ] Review audit log monthly
- [ ] Rotate API keys periodically
- [ ] Update secret detection patterns
- [ ] Test security controls

## Testing

```bash
test_secret_detection() {
  text="My API key is sk-1234567890abcdef"

  assert_true detect_secrets "$text"
}

test_sanitization() {
  text="Key: sk-1234567890abcdef"
  sanitized=$(sanitize_secrets "$text")

  assert_contains "$sanitized" "[REDACTED-API-KEY]"
  assert_not_contains "$sanitized" "sk-1234567890"
}

test_file_permissions() {
  touch test.jsonl
  chmod 644 test.jsonl  # World-readable

  output=$(check_permissions test.jsonl 2>&1)
  assert_contains "$output" "world-readable"
}
```

## Related

- [Context Extraction](../technical/implementation/context-extraction.md) - Secret sanitization
- [Export](edge-cases/09-export-backup.md) - Secure export practices

---

**Security Contact:** For security issues, email: security@example.com
**Last Review:** 2025-10-31
