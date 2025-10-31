# V3 Intelligence (v3.0+)

**Goal:** Proactive AI assistance and smart automation

**Timeline:** After V2 mature (~6 months usage data)

**Success Criteria:** System suggests actions before user thinks of them

## Philosophy

**From reactive to proactive:**
- V1: User asks, system responds
- V2: System scales, user searches
- **V3: System predicts, suggests, automates**

## New Features

### 1. Smart Reminders

**Auto-detect forgotten items:**
```
📅 Reminder: 3 items deferred > 90 days

[5]  Database migration plan      120d  high
[12] Refactor authentication      150d  medium
[23] Add telemetry                 180d  low

These items may be:
  - Forgotten (schedule review)
  - Obsolete (mark done or archive)
  - Still relevant (update context)

Review now? [Y/n]
```

**Implementation:**
- Weekly background check
- Configurable thresholds
- Smart scheduling (not annoying)

### 2. Context Auto-Refresh

**Detect stale context:**
```
Item #5: Database migration plan (120d old)

Context mentions "using MySQL 5.7"
Current codebase shows: PostgreSQL 14

⚠️  Context may be outdated
   Refresh context from current state? [Y/n]
```

**Implementation:**
- Compare context keywords vs current codebase
- Detect version changes (package.json, etc.)
- Offer automated refresh

### 3. Intelligent Categorization

**Learn from user patterns:**
```
Capturing: "Optimize API response time"

Suggested category: optimization:performance
Tags: api, performance, latency

Based on similar items:
  - [3] Optimize database queries → optimization:performance
  - [7] Reduce bundle size → optimization:performance

Accept suggestions? [Y/n/edit]
```

**Implementation:**
- ML on user's categorization history
- Keyword extraction + similarity
- Confidence score (only suggest if > 80%)

### 4. Dependency Auto-Detection

**Infer dependencies from context:**
```
Capturing: "Deploy new API version"

Potential dependencies detected:
  - [15] Write API migration guide (mentions "deploy")
  - [22] Update API tests (mentions "API")

Add as dependencies? [Y/n/select]
```

**Implementation:**
- Keyword overlap analysis
- Temporal proximity (recent items likely related)
- User can confirm/reject

### 5. Smart Breakdown Suggestions

**Convert to todos with AI:**
```
/later do 5

Item #5: Database migration plan

AI-suggested breakdown:
  1. Audit current schema and data
  2. Write migration scripts (with rollback)
  3. Test on staging environment
  4. Schedule downtime window
  5. Execute migration with monitoring
  6. Verify data integrity post-migration
  7. Update documentation

Estimated: 3 days
Complexity: High
Risk: Medium

Accept breakdown? [Y/n/edit]
```

**Implementation:**
- Claude API with specialized prompt
- Time/complexity estimation
- Risk assessment

### 6. Pattern Recognition

**Learn user workflows:**
```
Pattern detected:
  You often defer "optimization" items for ~90 days
  Then batch-process them together

Suggestion:
  Auto-tag optimization items with "batch-optimize"
  Remind every 90 days to review batch?

Enable workflow? [Y/n]
```

**Implementation:**
- Analyze capture → action patterns
- Detect recurring themes
- Suggest automation

### 7. Context Enrichment

**Auto-add relevant info:**
```
Capturing: "Upgrade React to v19"

Enriching context...
  ✅ Current version: React 18.2.0 (from package.json)
  ✅ Latest version: React 19.0.0
  ✅ Breaking changes: 15 detected
  ✅ Migration guide: https://react.dev/blog/2025/...

Context auto-enriched. Review? [Y/n]
```

**Implementation:**
- Parse package.json, dependencies
- Check for updates
- Fetch relevant docs
- Add to context automatically

### 8. Intelligent Search

**Semantic search (not just keywords):**
```bash
/later search "make queries faster"

Results (semantic matching):
  [3]  Optimize database queries        (95% match)
  [12] Add caching layer                (87% match)
  [18] Reduce API latency               (82% match)
  [25] Use CDN for static assets        (75% match)

Note: "make queries faster" matched "optimize", "caching", "latency"
```

**Implementation:**
- Embeddings (sentence transformers)
- Semantic similarity
- Still works offline (fallback to keywords)

### 9. Decision Templates

**Common decision patterns:**
```
Capturing: "Migrate authentication to OAuth2"

This looks like: "Technology Migration" decision

Apply template? [Y/n]
  - Add tags: migration, authentication, oauth2
  - Add checklist: audit, plan, test, rollback, execute
  - Set priority: high (default for migrations)
  - Add dependencies: (search for "auth" items)

[Y]: Apply template
[n]: Skip
```

**Implementation:**
- Detect keywords → match template
- User can customize templates
- Learn from usage (improve templates)

### 10. Proactive Archive Suggestions

**Context-aware archival:**
```
Weekly Review: 5 items may be obsolete

[8]  Upgrade to Python 3.8 (done via other work)
     Git log shows: "Upgrade to Python 3.11" committed 2 months ago
     Suggest: Archive as obsolete

[15] Fix IE11 compatibility (no longer needed)
     Dependencies show: "browserslist: > 1%, not IE 11"
     Suggest: Archive as obsolete

Archive suggestions? [Y/n/review]
```

**Implementation:**
- Cross-reference with git log
- Check dependencies for version changes
- Detect obsolete technologies

## Implementation Approach

**Incremental rollout:**
1. V3.0: Smart reminders, context refresh
2. V3.1: Intelligent categorization, dependency detection
3. V3.2: Smart breakdown, pattern recognition
4. V3.3: Context enrichment, semantic search
5. V3.4: Decision templates, proactive archive

**Each feature:**
- Optional (can disable)
- Configurable (thresholds, frequency)
- Non-intrusive (suggestions, not mandates)

## AI Model Strategy

**Haiku 4.5 (default):**
- Fast (< 2s)
- Cheap ($0.001 per operation)
- Good enough for most features

**Sonnet 4.5 (on-demand):**
- Better quality
- More expensive ($0.003 per operation)
- User can upgrade: `/later config --ai-model sonnet`

**Local fallback:**
- Keyword-based for search
- Rule-based for categorization
- Works offline

## Privacy & Control

**User control:**
```bash
# Disable specific features
/later config --disable-smart-reminders
/later config --disable-auto-categorization

# Adjust frequency
/later config --reminder-frequency weekly  # Or monthly, never

# Data stays local
# AI only sees: title + context (user controls what to capture)
```

**No telemetry:**
- No usage data sent to server
- AI calls are stateless (no training on user data)
- User retains full control

## Success Metrics

- Smart reminder usefulness: > 70% acted upon
- Auto-categorization accuracy: > 85%
- Dependency detection precision: > 80%
- User time saved: ~5 min/week
- Feature adoption: > 50% enable smart features

## Risks

**Over-automation:**
- Too many suggestions → annoying
- Mitigated by: Configurable frequency, easy disable

**AI errors:**
- Wrong categorization → user override
- Mitigated by: Confidence thresholds, user confirmation

**Complexity creep:**
- Too many features → confusing
- Mitigated by: Progressive disclosure, defaults off

## Timeline

| Quarter | Features | Status |
|---------|----------|--------|
| Q1 | Smart reminders, context refresh | Foundation |
| Q2 | Intelligent categorization, dependencies | Learning |
| Q3 | Smart breakdown, pattern recognition | Automation |
| Q4 | Context enrichment, semantic search | Advanced |

**Total:** ~1 year for full V3 rollout

## Beyond V3

**Future possibilities:**
- Integration with calendar (schedule reviews)
- Team collaboration (shared deferred items)
- Mobile app (native iOS/Android)
- Web dashboard (visual interface)
- Voice capture (Siri/Alexa integration)

**But first:** Validate V3 intelligence features with users

## Related

- [V2 SQLite](v2-sqlite.md) - Previous phase
- [Context Extraction](../../technical/implementation/context-extraction.md) - AI integration
- [Apple-Style Philosophy](../../design/philosophy/apple-style-philosophy.md) - Progressive disclosure

---

**Status:** Design phase
**Implementation:** After V2 mature and user feedback collected
