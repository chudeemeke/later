import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleUpdate } from '../../src/tools/update.js';
import type { Storage } from '../../src/storage/interface.js';
import type { DeferredItem } from '../../src/types.js';

describe('Update Tool', () => {
  let mockStorage: Storage;
  let existingItem: DeferredItem;

  beforeEach(() => {
    existingItem = {
      id: 1,
      decision: 'Original decision',
      context: 'Original context',
      status: 'pending',
      tags: ['tag1'],
      priority: 'medium',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      dependencies: [],
    };

    mockStorage = {
      append: async () => 2,
      readAll: async () => [existingItem],
      findById: async (id: number) => (id === 1 ? existingItem : null),
      update: async (item: DeferredItem) => {
        existingItem = item;
      },
      delete: async () => {},
      getNextId: async () => 2,
    };
  });

  describe('validation', () => {
    it('should reject invalid arguments', async () => {
      const result = await handleUpdate({} as any, mockStorage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject negative id', async () => {
      const result = await handleUpdate(
        {
          id: -1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
    });

    it('should reject non-integer id', async () => {
      const result = await handleUpdate(
        {
          id: 3.14,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
    });
  });

  describe('item existence', () => {
    it('should return error if item not found', async () => {
      const result = await handleUpdate(
        {
          id: 999,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('999');
    });

    it('should update existing item successfully', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated decision',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.decision).toBe('Updated decision');
    });
  });

  describe('field updates', () => {
    it('should update decision field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'New decision text',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.decision).toBe('New decision text');
    });

    it('should update context field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          context: 'New context information',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.context).toBe('New context information');
    });

    it('should update tags field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          tags: ['new-tag', 'another-tag'],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.tags).toEqual(['new-tag', 'another-tag']);
    });

    it('should update priority field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          priority: 'high',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.priority).toBe('high');
    });

    it('should update status field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          status: 'in-progress',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('in-progress');
    });

    it('should update dependencies field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          dependencies: [2, 3],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.dependencies).toEqual([2, 3]);
    });

    it('should update multiple fields at once', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated decision',
          priority: 'high',
          tags: ['urgent', 'critical'],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.decision).toBe('Updated decision');
      expect(result.item?.priority).toBe('high');
      expect(result.item?.tags).toEqual(['urgent', 'critical']);
    });
  });

  describe('state transitions', () => {
    it('should allow valid pending → in-progress transition', async () => {
      existingItem.status = 'pending';

      const result = await handleUpdate(
        {
          id: 1,
          status: 'in-progress',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('in-progress');
    });

    it('should allow valid in-progress → done transition', async () => {
      existingItem.status = 'in-progress';

      const result = await handleUpdate(
        {
          id: 1,
          status: 'done',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('done');
    });

    it('should reject invalid pending → done transition', async () => {
      existingItem.status = 'pending';

      const result = await handleUpdate(
        {
          id: 1,
          status: 'done',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('transition');
      expect(result.error).toContain('pending');
      expect(result.error).toContain('done');
    });

    it('should reject invalid done → in-progress transition', async () => {
      existingItem.status = 'done';

      const result = await handleUpdate(
        {
          id: 1,
          status: 'in-progress',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('transition');
    });

    it('should allow archived → pending transition (restore)', async () => {
      existingItem.status = 'archived';

      const result = await handleUpdate(
        {
          id: 1,
          status: 'pending',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.status).toBe('pending');
    });
  });

  describe('dependency cycles', () => {
    it('should detect direct dependency cycle (A depends on A)', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          dependencies: [1],
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('cycle');
    });

    it('should detect indirect dependency cycle', async () => {
      // Setup: Item 1 → Item 2 → Item 3 → Item 1 (cycle)
      const item2: DeferredItem = {
        ...existingItem,
        id: 2,
        dependencies: [3],
      };
      const item3: DeferredItem = {
        ...existingItem,
        id: 3,
        dependencies: [1],
      };

      mockStorage.findById = async (id: number) => {
        if (id === 1) return existingItem;
        if (id === 2) return item2;
        if (id === 3) return item3;
        return null;
      };

      // Try to make item 1 depend on item 2 (would create cycle)
      const result = await handleUpdate(
        {
          id: 1,
          dependencies: [2],
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('cycle');
    });

    it('should allow valid dependencies without cycles', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          dependencies: [2, 3],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.dependencies).toEqual([2, 3]);
    });
  });

  describe('timestamp handling', () => {
    it('should preserve created_at timestamp', async () => {
      const originalCreatedAt = existingItem.created_at;

      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.created_at).toBe(originalCreatedAt);
    });

    it('should update updated_at timestamp', async () => {
      const originalUpdatedAt = existingItem.updated_at;

      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.updated_at).not.toBe(originalUpdatedAt);
      expect(new Date(result.item!.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should preserve id field', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.id).toBe(1);
    });
  });

  describe('warnings', () => {
    it('should include warnings for non-blocking issues', async () => {
      // This test might need specific implementation details
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.update = async () => {
        throw new Error('Storage error');
      };

      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle findById errors gracefully', async () => {
      mockStorage.findById = async () => {
        throw new Error('Find error');
      };

      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('success message', () => {
    it('should include success message with item id', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'Updated',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message).toContain('1');
    });

    it('should include updated item in result', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          decision: 'New decision',
          priority: 'high',
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item).toBeDefined();
      expect(result.item?.id).toBe(1);
      expect(result.item?.decision).toBe('New decision');
      expect(result.item?.priority).toBe('high');
    });
  });

  describe('edge cases', () => {
    it('should handle empty tags array', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          tags: [],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.tags).toEqual([]);
    });

    it('should handle empty dependencies array', async () => {
      const result = await handleUpdate(
        {
          id: 1,
          dependencies: [],
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.dependencies).toEqual([]);
    });

    it('should handle very long decision text (up to 500 chars)', async () => {
      const longDecision = 'a'.repeat(500);

      const result = await handleUpdate(
        {
          id: 1,
          decision: longDecision,
        },
        mockStorage
      );

      expect(result.success).toBe(true);
      expect(result.item?.decision).toBe(longDecision);
    });

    it('should reject decision text over 500 chars', async () => {
      const tooLongDecision = 'a'.repeat(501);

      const result = await handleUpdate(
        {
          id: 1,
          decision: tooLongDecision,
        },
        mockStorage
      );

      expect(result.success).toBe(false);
    });
  });
});
