# Future-Proofing Strategy

**Last Updated:** 2025-10-31
**10-Year Test:** Will this work in 2035?

## Overview

**Core principle:** Design for longevity, not trends.

Technology changes rapidly. In 10 years:
- Programming languages evolve
- Platforms come and go
- Tools get deprecated
- But plain text endures

## Storage Format Longevity

### JSONL: 10-Year Stable ✅

**Why JSONL will work in 2035:**
- Plain text (readable forever)
- Line-delimited (simple parsing)
- JSON (universal format since 2001)
- No proprietary format
- No vendor lock-in

**Worst case scenario:**
```bash
# In 2035, /later tool doesn't exist
# Can still read data:
cat ~/.later/deferred.jsonl | less
grep "optimization" ~/.later/deferred.jsonl
jq . ~/.later/deferred.jsonl

# Import to new tool:
import-to-new-tool ~/.later/deferred.jsonl
```

### SQLite: 10-Year Stable ✅

**Why SQLite will work in 2035:**
- Format stable since 2004 (21 years proven)
- Backward compatible guarantee
- Self-contained (no server)
- Cross-platform
- Widely supported

**Worst case scenario:**
```bash
# In 2035, /later tool doesn't exist
# Export from SQLite:
sqlite3 deferred.db ".mode json" ".output export.json" "SELECT * FROM deferred_items;"

# Import to new tool
import-to-new-tool export.json
```

### Cloud Services: 10-Year Risk ❌

**Why NOT cloud-dependent:**
- APIs change (breaking changes)
- Services sunset (e.g., Parse, Firebase)
- Pricing changes
- Vendor lock-in
- Requires internet

**Example:** If /later stored data in "CloudService.io":
- 2025: Service popular, free tier
- 2028: Acquired by BigCorp, pricing changes
- 2030: API v1 deprecated, forced migration
- 2032: Service discontinued
- 2033: Your data gone (if not exported)

## API Dependencies

### Anthropic Claude API

**Current:** Used for context extraction

**Future-proofing:**
1. **Graceful degradation** - Works without AI
2. **API abstraction** - Switchable backends
3. **Local fallback** - Simple extraction (last N messages)
4. **Export independence** - Data readable without API

**Implementation:**
```bash
extract_context() {
  local title="$1"

  # Try Claude API
  if context=$(claude_api_extract "$title" 2>/dev/null); then
    echo "$context"
    return 0
  fi

  # Fallback: Simple extraction
  context=$(simple_extract "$title")
  echo "$context"
  return 0
}
```

**Worst case:** Claude API discontinued in 2030
- ✅ Data still accessible (stored locally)
- ✅ Tool still works (fallback extraction)
- ⚠️  New captures less intelligent (no AI summary)
- ✅ Can migrate to new AI provider

## Tool Evolution

### Version Compatibility

**Schema version tracking:**
```json
{
  "schema_version": "1.0",
  "tool_version": "0.5.0",
  "id": 1,
  "title": "..."
}
```

**Forward compatibility:**
```bash
# v2.0 reads v1.0 files
if [[ $(jq -r '.schema_version // "1.0"' item) == "1.0" ]]; then
  # Migrate on read
  item=$(migrate_v1_to_v2 "$item")
fi
```

**Backward compatibility:**
```bash
# v1.0 ignores unknown fields from v2.0
jq 'del(.new_v2_field)' item  # Still valid v1.0
```

### Migration Path

**Documented export format:**
```markdown
## Data Export Format

All data can be exported to JSONL:

    /later export --output backup.jsonl

Format specification:
- One JSON object per line
- UTF-8 encoding
- Fields: id, title, status, ...

Import to other tools:
- Read line by line
- Parse JSON
- Map fields as needed
```

**This document survives tool obsolescence.**

## Dependency Management

### Minimal Dependencies

**Core dependencies:**
- `bash` (4.0+) - Universal Unix shell
- `jq` - JSON processor (stable since 2012)
- `sqlite3` - Database (optional, for scaling)

**Why these are safe:**
- Pre-installed on most systems
- Stable, mature projects
- Not trendy (won't be abandoned)
- Simple to replace if needed

**Avoid:**
- Framework-specific tools (e.g., Rails, Django)
- Language version-specific features (e.g., Python 3.12+)
- Trendy libraries (may be abandoned)

### Vendoring Critical Code

**For small utilities:**
```bash
# Vendor levenshtein function (don't depend on external tool)
levenshtein() {
  # Self-contained implementation
  # Works even if external tool unavailable
}
```

## Data Portability

### Export as First-Class Feature

**Not an afterthought:**
```bash
# Export is always available
/later export

# Multiple formats
/later export --format jsonl  # Default
/later export --format json   # Single file
/later export --format csv    # Spreadsheet

# Selective export
/later export --category optimization
/later export --after 2025-01-01
```

**Documentation includes:**
- Export format specification
- Example parsers in multiple languages
- Migration scripts to other tools

### No Proprietary Format

**Design decision:**
- ❌ Custom binary format (fast but proprietary)
- ❌ Encrypted by default (locks user in)
- ✅ **Plain text JSONL** (readable, portable)

## Testing Longevity

### 10-Year Scenarios

**Test 1: Tool unavailable**
```bash
# Simulate: /later command doesn't exist
# Can I still access my data?

cat ~/.later/deferred.jsonl
# ✅ Readable

jq . ~/.later/deferred.jsonl
# ✅ Parseable

grep "optimization" ~/.later/deferred.jsonl
# ✅ Searchable
```

**Test 2: Technology shift**
```bash
# Simulate: Bash becomes obsolete, everyone uses Rust
# Can I migrate data?

# Export
/later export --output backup.jsonl

# Import to hypothetical rust-later tool
rust-later import backup.jsonl
# ✅ Format documented, migration possible
```

**Test 3: Platform migration**
```bash
# Simulate: Move from macOS to Linux to Windows to FreeBSD
# Does tool work?

# Copy data
scp ~/.later/deferred.jsonl new-machine:

# Run on new platform
bash later-capture.sh "New item"
# ✅ Pure bash, works everywhere
```

## Version Control Friendly

**Enable git tracking:**
```bash
cd ~/.later
git init
git add deferred.jsonl
git commit -m "Backup"

# Diff is human-readable
git diff
```

**Line-based format:**
- Adding item = adding line (clean diff)
- Editing item = changing line (clear change)
- Not binary blob (reviewable)

## Documentation Preservation

**Store docs with data:**
```
~/.later/
├── deferred.jsonl
├── README.md          # Usage instructions
├── SCHEMA.md          # Format specification
└── MIGRATION.md       # How to migrate away
```

**README includes:**
- How to read data without tool
- How to export data
- How to migrate to new tool
- Format specification

**If tool disappears, documentation survives.**

## Conclusion

**Will /later work in 2035?**
- ✅ Data readable (plain text JSONL)
- ✅ Tool reproducible (bash scripts)
- ✅ Dependencies stable (bash, jq, sqlite)
- ✅ Export documented (migration possible)
- ✅ Platform independent (Unix standard)

**Worst case in 2035:**
- Tool no longer maintained
- But data fully accessible
- And documented for migration
- User not locked in

**This is future-proofing done right.**

## Related

- [Storage Mechanism](../architecture/decisions/storage-mechanism.md) - JSONL choice rationale
- [Export/Backup](edge-cases/09-export-backup.md) - Export strategies

---

**Last Review:** 2025-10-31
**Next Review:** 2030-01-01 (5-year checkpoint)
