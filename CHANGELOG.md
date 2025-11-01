# Changelog

All notable changes to `/later` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Progress - MCP Server Implementation (2025-11-01)

**Status:** Phase 5/7 - Tool Implementation (Partial)

**Completed:**
- ✅ Phase 1: Project Setup (30 min)
  - Created directory structure (src/, tests/, with subdirectories)
  - Initialized npm project with package.json
  - Configured TypeScript with strict mode
  - Configured Jest for ESM and TypeScript
  - Installed dependencies (@modelcontextprotocol/sdk, TypeScript, Jest, etc.)

- ✅ Phase 2: Type Definitions (15 min)
  - Defined core types: DeferredItem, Config, CaptureArgs, ListArgs, ShowArgs, DoArgs
  - All types with proper TypeScript strict typing

- ✅ Phase 3: Storage Layer (1.5 hours) - **11 tests passing**
  - Implemented Storage interface (hexagonal architecture port)
  - Implemented JSONLStorage adapter with:
    - File locking for concurrent access (flock-style)
    - Atomic writes (temp file + rename)
    - Secure file permissions (600/700)
    - CRUD operations: append, readAll, findById, update, getNextId
    - Corruption handling and recovery
  - All 11 storage tests passing

- ✅ Phase 4: Utilities (2 hours) - **63 tests passing**
  - Secret Sanitization (19 tests):
    - Detects: OpenAI, Anthropic, GitHub, Slack, AWS keys
    - Auto-sanitizes with [REDACTED-*] placeholders
    - Secure by default
  - Duplicate Detection (27 tests):
    - Levenshtein distance algorithm
    - Keyword extraction and overlap calculation
    - Similarity scoring (60% title, 40% content)
    - 80% threshold for duplicate detection
    - Only checks pending/in-progress items
  - Config Management (17 tests):
    - Load/save config.json
    - Default config generation
    - Validation and sanitization
    - Secure permissions (600)
    - Migration detection support
  - Context Extraction (placeholder for MVP)

- ✅ Phase 5: MCP Tools (Partial) - **20 tests passing**
  - later_capture tool (COMPLETE):
    - Input validation
    - Secret detection and sanitization
    - Duplicate detection with similarity scoring
    - Context extraction and truncation
    - Sequential ID generation
    - Comprehensive error handling
    - All 20 tests passing

**Test Coverage:** 94 passing tests across all implemented phases

**Remaining Work:**
- Phase 5: later_list, later_show, later_do tools (est. 2-3 hours)
- Phase 6: MCP Server implementation and integration (est. 1 hour)
- Phase 7: Build, final testing, and validation (est. 1 hour)

**Architecture Highlights:**
- Strict TDD methodology (RED → GREEN → REFACTOR)
- Hexagonal architecture with storage abstraction
- Security-first design (secret sanitization, file permissions)
- Robust concurrency handling (file locking)
- Comprehensive error handling
- Edge case coverage

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
