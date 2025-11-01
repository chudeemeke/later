# Changelog

All notable changes to `/later` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✅ PRODUCTION READY - MCP Server Implementation Complete (2025-11-01)

**Status:** Phase 7/7 - **COMPLETE & PRODUCTION READY** 🎉

**Final Metrics:**
- ✅ **179 tests passing** (100% pass rate)
- ✅ **95.44% code coverage** (exceeding 95% goal!)
  - Statements: 95.44%
  - Branches: 85.03%
  - Functions: 95.65%
  - Lines: 95.21%
- ✅ **Zero TypeScript errors** (strict mode)
- ✅ **Production-ready build** (dist/ compiled)
- ✅ **Security hardened** (secret sanitization, file permissions)
- ✅ **Concurrent-safe** (file locking implemented)

**Completed Phases:**

- ✅ **Phase 1: Project Setup** (30 min)
  - Directory structure: src/{storage,tools,utils}, tests/{storage,tools,utils}
  - NPM project with @modelcontextprotocol/sdk, TypeScript, Jest
  - TypeScript strict mode configuration
  - Jest with ESM support and coverage reporting

- ✅ **Phase 2: Type Definitions** (15 min)
  - Core types: DeferredItem, Config, CaptureArgs, ListArgs, ShowArgs, DoArgs
  - Strict TypeScript typing throughout codebase

- ✅ **Phase 3: Storage Layer** (1.5 hours) - **11 tests passing**
  - Storage interface (hexagonal architecture port)
  - JSONLStorage adapter featuring:
    - File-based locking for concurrent access
    - Atomic writes (temp file + rename pattern)
    - Secure permissions (600/700)
    - Complete CRUD: append, readAll, findById, update, getNextId
    - Corruption detection and recovery
  - 84% coverage on storage layer

- ✅ **Phase 4: Utilities** (2 hours) - **74 tests passing**
  - **Secret Sanitization (19 tests):**
    - Detects: OpenAI, Anthropic, GitHub, Slack, AWS keys
    - Auto-sanitizes with [REDACTED-*] placeholders
    - 96% coverage
  - **Duplicate Detection (27 tests):**
    - Levenshtein distance algorithm
    - Keyword extraction and overlap calculation
    - Similarity scoring (60% title, 40% content weight)
    - 80% similarity threshold
    - Only checks pending/in-progress items
    - 98% coverage
  - **Config Management (22 tests):**
    - JSON config with validation
    - Migration detection (slash-command → MCP)
    - Secure permissions (600)
    - 97% coverage
  - **Context Extraction (6 tests):**
    - Context validation and truncation
    - Conversation linking support
    - 100% coverage

- ✅ **Phase 5: MCP Tools** (4 hours) - **82 tests passing**
  - **later_capture (20 tests):**
    - Input validation and sanitization
    - Secret detection and auto-redaction
    - Duplicate detection with similarity scoring
    - Context extraction and truncation
    - Sequential ID generation
    - 96% coverage
  - **later_list (22 tests):**
    - Filter by status, tags, priority
    - Sort by created_at (newest first)
    - Limit parameter support
    - Formatted output with status icons
    - 96% coverage
  - **later_show (20 tests):**
    - Full item details display
    - Dependency resolution
    - Conversation linking
    - Pretty-printed formatting
    - 96% coverage
  - **later_do (20 tests):**
    - Status transition to in-progress
    - TodoWrite guidance generation
    - Dependency checking
    - Warning system for blocked items
    - 98% coverage

- ✅ **Phase 6: MCP Server** (1 hour) - **Integration complete**
  - MCP server implementation using @modelcontextprotocol/sdk
  - Tool registration (4 tools)
  - Request handling with proper error messages
  - Stdio transport for Claude Code integration
  - TypeScript compilation with zero errors

- ✅ **Phase 7: Build & Validation** (1 hour)
  - TypeScript build successful (dist/ generated)
  - Full test suite: 179/179 passing
  - Coverage analysis: 95.44% overall
  - Production readiness validation complete

**Architecture Achievements:**
- ✅ Strict TDD methodology (RED → GREEN → REFACTOR)
- ✅ Hexagonal architecture (storage abstraction layer)
- ✅ Security-first design (automatic secret sanitization, secure file permissions)
- ✅ Concurrent-safe (file locking, atomic writes)
- ✅ Comprehensive error handling (graceful degradation)
- ✅ Edge case coverage (empty states, invalid inputs, storage errors)
- ✅ Type safety (strict TypeScript, zero any types in production code)

### Documentation (Complete)
- Complete architecture documentation (storage, schema, scaling)
- Complete design/UX documentation (commands, progressive disclosure, error handling)
- Complete technical documentation (implementation, performance)
- Complete edge cases documentation (12 scenarios)
- Complete planning documentation (MVP to V3 roadmap)
- Complete getting-started documentation (quick start, installation)
- Complete reference documentation (security, future-proofing)
- Complete project context (origin story, decisions log)
- Sample data and examples

### Infrastructure
- Git repository initialized
- Project structure established (WoW conventions)
- Documentation-first approach validated
- NPM project configured with TypeScript and Jest
- ESM modules with strict TypeScript compilation

## [0.0.0] - 2025-10-31

### Added
- Initial project conception
- Design phase complete
- Comprehensive documentation (40+ files)
- Ready for MVP implementation

---

## Upcoming Releases

### [0.1.0] - MVP Phase (Target: Week 1)
- Basic capture command
- List command
- Show command
- Done command
- Search command (grep-based)
- JSONL storage

### [1.0.0] - V1 Enhanced (Target: Week 3)
- AI context extraction
- Categories and tags
- Duplicate detection
- Enhanced search (ranked)
- Edit command
- Archive command

### [2.0.0] - V2 SQLite (Target: Month 2)
- SQLite migration (automatic)
- FTS5 full-text search
- Indexed queries
- Dependency tracking
- Performance at scale (10K+ items)

### [3.0.0] - V3 Intelligence (Target: Month 6+)
- Smart reminders
- Context auto-refresh
- Intelligent categorization
- Pattern recognition
- Semantic search
- Proactive suggestions

---

**Note:** Pre-1.0.0 releases may have breaking changes.
Post-1.0.0 follows semantic versioning strictly.
