import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  StalenessChecker,
  DEFAULT_STALENESS_CONFIG,
} from '../../../src/domain/services/StalenessChecker.js';
import { Item } from '../../../src/domain/entities/Item.js';

describe('StalenessChecker Service', () => {
  let checker: StalenessChecker;

  beforeEach(() => {
    checker = new StalenessChecker();
  });

  // Helper to create item with specific age
  const createItemWithAge = (
    id: number,
    daysOld: number,
    options: {
      priority?: 'low' | 'medium' | 'high';
      status?: 'pending' | 'in-progress' | 'done' | 'archived';
      context?: string;
      dependencies?: number[];
    } = {}
  ): Item => {
    const item = Item.create(id, {
      decision: `Decision ${id}`,
      priority: options.priority,
      context: options.context,
      dependencies: options.dependencies,
    });

    // Manually set dates using fromProps to simulate age
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysOld);
    const updatedAt = new Date(createdAt);

    const reconstituted = Item.fromProps({
      ...item.toProps(),
      createdAt,
      updatedAt,
      status: options.status || 'pending',
    });

    return reconstituted;
  };

  describe('checkItem', () => {
    it('should identify fresh item as not stale', () => {
      const item = createItemWithAge(1, 5);

      const result = checker.checkItem(item);

      expect(result.isStale).toBe(false);
      expect(result.stalenessScore).toBeLessThan(0.5);
    });

    it('should identify old item as stale', () => {
      const item = createItemWithAge(1, 45);

      const result = checker.checkItem(item);

      expect(result.isStale).toBe(true);
      expect(result.stalenessScore).toBeGreaterThanOrEqual(0.5);
    });

    it('should use shorter threshold for high priority', () => {
      const highPriority = createItemWithAge(1, 10, { priority: 'high' });

      const result = checker.checkItem(highPriority);

      expect(result.applicableThreshold).toBe(
        DEFAULT_STALENESS_CONFIG.highPriorityThresholdDays
      );
      expect(result.isStale).toBe(true); // 10 days > 7 day threshold
    });

    it('should use shorter threshold for in-progress items', () => {
      const inProgress = createItemWithAge(1, 20, { status: 'in-progress' });

      const result = checker.checkItem(inProgress);

      expect(result.applicableThreshold).toBe(
        DEFAULT_STALENESS_CONFIG.inProgressThresholdDays
      );
    });

    it('should mark completed items as not stale', () => {
      const completed = createItemWithAge(1, 100, { status: 'done' });

      const result = checker.checkItem(completed);

      expect(result.isStale).toBe(false);
      expect(result.stalenessScore).toBe(0);
      expect(result.recommendation).toBe('none');
    });

    it('should mark archived items as not stale', () => {
      const archived = createItemWithAge(1, 100, { status: 'archived' });

      const result = checker.checkItem(archived);

      expect(result.isStale).toBe(false);
    });
  });

  describe('staleness factors', () => {
    it('should calculate time factor', () => {
      const halfThreshold = createItemWithAge(
        1,
        DEFAULT_STALENESS_CONFIG.defaultThresholdDays / 2
      );

      const result = checker.checkItem(halfThreshold);

      expect(result.factors.timeFactor).toBeCloseTo(0.5, 1);
    });

    it('should cap time factor at 1', () => {
      const veryOld = createItemWithAge(1, 100);

      const result = checker.checkItem(veryOld);

      expect(result.factors.timeFactor).toBe(1);
    });

    it('should have higher priority factor for high priority', () => {
      const high = createItemWithAge(1, 10, { priority: 'high' });
      const low = createItemWithAge(2, 10, { priority: 'low' });

      const highResult = checker.checkItem(high);
      const lowResult = checker.checkItem(low);

      expect(highResult.factors.priorityFactor).toBeGreaterThan(
        lowResult.factors.priorityFactor
      );
    });

    it('should have higher activity factor for in-progress', () => {
      const inProgress = createItemWithAge(1, 10, { status: 'in-progress' });
      const pending = createItemWithAge(2, 10, { status: 'pending' });

      const inProgressResult = checker.checkItem(inProgress);
      const pendingResult = checker.checkItem(pending);

      expect(inProgressResult.factors.activityFactor).toBeGreaterThan(
        pendingResult.factors.activityFactor
      );
    });
  });

  describe('recommendations', () => {
    it('should recommend review for moderately stale items', () => {
      const item = createItemWithAge(1, 35);

      const result = checker.checkItem(item);

      expect(result.recommendation).toBe('review');
    });

    it('should recommend refresh for stale items with context', () => {
      const item = createItemWithAge(1, 50, {
        context: 'This is some context that might need refreshing',
      });

      const result = checker.checkItem(item);

      // Very stale with context should recommend refresh
      expect(['refresh', 'review', 'archive']).toContain(result.recommendation);
    });

    it('should recommend archive for very stale low priority items', () => {
      const item = createItemWithAge(1, 90, { priority: 'low' });

      const result = checker.checkItem(item);

      expect(result.recommendation).toBe('archive');
    });

    it('should recommend none for fresh items', () => {
      const item = createItemWithAge(1, 5);

      const result = checker.checkItem(item);

      expect(result.recommendation).toBe('none');
    });
  });

  describe('checkItems', () => {
    it('should check multiple items', () => {
      const items = [
        createItemWithAge(1, 5),
        createItemWithAge(2, 40),
        createItemWithAge(3, 60),
      ];

      const results = checker.checkItems(items);

      expect(results.length).toBe(3);
      expect(results[0].isStale).toBe(false);
      expect(results[1].isStale).toBe(true);
      expect(results[2].isStale).toBe(true);
    });
  });

  describe('getStaleItems', () => {
    it('should return only stale items', () => {
      const items = [
        createItemWithAge(1, 5),
        createItemWithAge(2, 40),
        createItemWithAge(3, 60),
      ];

      const stale = checker.getStaleItems(items);

      expect(stale.length).toBe(2);
      expect(stale.map((s) => s.itemId)).toContain(2);
      expect(stale.map((s) => s.itemId)).toContain(3);
    });

    it('should filter by minimum score', () => {
      const items = [
        createItemWithAge(1, 20), // Less stale
        createItemWithAge(2, 60, { priority: 'high', status: 'in-progress' }), // Very stale (high priority + in-progress = high score)
      ];

      const veryStale = checker.getStaleItems(items, 0.7);

      expect(veryStale.length).toBe(1);
      expect(veryStale[0].itemId).toBe(2);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', () => {
      const items = [
        createItemWithAge(1, 5),
        createItemWithAge(2, 40),
        createItemWithAge(3, 60, { priority: 'high' }),
      ];

      const report = checker.generateReport(items);

      expect(report.totalItems).toBe(3);
      expect(report.staleItems).toBeGreaterThan(0);
      expect(report.avgStaleness).toBeGreaterThan(0);
    });

    it('should categorize items by recommendation', () => {
      const items = [
        createItemWithAge(1, 5), // None
        createItemWithAge(2, 35), // Review
        createItemWithAge(3, 100, { priority: 'low' }), // Archive (100 days > 30*2.5=75)
      ];

      const report = checker.generateReport(items);

      expect(report.itemsByRecommendation.none).toContain(1);
      expect(report.itemsByRecommendation.review).toContain(2);
      expect(report.itemsByRecommendation.archive).toContain(3);
    });

    it('should identify most stale items', () => {
      const items = [
        createItemWithAge(1, 10),
        createItemWithAge(2, 40),
        createItemWithAge(3, 80, { priority: 'high' }), // High priority to ensure highest score
      ];

      const report = checker.generateReport(items);

      expect(report.mostStale.length).toBeGreaterThan(0);
      expect(report.mostStale[0].itemId).toBe(3); // Most stale first (highest score due to priority)
    });
  });

  describe('checkContextStaleness', () => {
    it('should detect stale context when files changed', () => {
      const item = Item.fromProps({
        id: 1,
        decision: 'Test',
        context: 'Some context',
        status: 'pending',
        tags: [],
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        contextFiles: ['src/file1.ts', 'src/file2.ts'],
        contextHash: JSON.stringify({
          'src/file1.ts': 'hash1',
          'src/file2.ts': 'hash2',
        }),
      });

      const currentHashes = {
        'src/file1.ts': 'newhash1', // Changed
        'src/file2.ts': 'hash2', // Same
      };

      const result = checker.checkContextStaleness(item, currentHashes);

      expect(result.isContextStale).toBe(true);
      expect(result.changedFiles).toContain('src/file1.ts');
    });

    it('should detect missing files', () => {
      const item = Item.fromProps({
        id: 1,
        decision: 'Test',
        context: 'Context',
        status: 'pending',
        tags: [],
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
        contextFiles: ['src/deleted.ts'],
        contextHash: JSON.stringify({ 'src/deleted.ts': 'hash' }),
      });

      const currentHashes = {}; // File doesn't exist

      const result = checker.checkContextStaleness(item, currentHashes);

      expect(result.isContextStale).toBe(true);
      expect(result.reason).toContain('no longer exist');
    });

    it('should return not stale when no context files', () => {
      const item = Item.create(1, { decision: 'Test' });

      const result = checker.checkContextStaleness(item, {});

      expect(result.isContextStale).toBe(false);
    });
  });

  describe('getUrgentItems', () => {
    it('should include critically stale items', () => {
      const items = [
        createItemWithAge(1, 5),
        createItemWithAge(2, 80, { priority: 'high' }), // Critical (high priority ensures score > 0.65)
      ];

      const urgent = checker.getUrgentItems(items);

      expect(urgent.map((u) => u.itemId)).toContain(2);
      expect(urgent.map((u) => u.itemId)).not.toContain(1);
    });

    it('should include high priority stale items', () => {
      const items = [
        createItemWithAge(1, 10, { priority: 'high' }), // High priority, past threshold
        createItemWithAge(2, 20, { priority: 'low' }), // Low priority, not critical
      ];

      const urgent = checker.getUrgentItems(items);

      expect(urgent.map((u) => u.itemId)).toContain(1);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customChecker = new StalenessChecker({
        defaultThresholdDays: 10,
      });

      const item = createItemWithAge(1, 15);
      const result = customChecker.checkItem(item);

      expect(result.applicableThreshold).toBe(10);
      expect(result.isStale).toBe(true);
    });

    it('should allow updating configuration', () => {
      checker.configure({ defaultThresholdDays: 5 });

      const item = createItemWithAge(1, 7);
      const result = checker.checkItem(item);

      expect(result.applicableThreshold).toBe(5);
    });

    it('should return current configuration', () => {
      const config = checker.getConfig();

      expect(config.defaultThresholdDays).toBe(
        DEFAULT_STALENESS_CONFIG.defaultThresholdDays
      );
    });
  });
});
