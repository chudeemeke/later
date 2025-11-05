import { describe, it, expect, beforeEach } from '@jest/globals';
import { handleDelete } from '../../src/tools/delete.js';
import type { Storage } from '../../src/storage/interface.js';
import type { DeferredItem } from '../../src/types.js';

describe('Delete Tool', () => {
  let mockStorage: Storage;
  let existingItem: DeferredItem;

  beforeEach(() => {
    existingItem = {
      id: 1,
      decision: 'Test decision',
      context: 'Test context',
      status: 'pending',
      tags: [],
      priority: 'medium',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      dependencies: [],
    };

    mockStorage = {
      append: async () => {},
      readAll: async () => [existingItem],
      findById: async (id: number) => (id === 1 ? existingItem : null),
      update: async (item: DeferredItem) => {
        existingItem = item;
      },
      getNextId: async () => 2,
    };
  });

  describe('validation', () => {
    it('should reject invalid arguments', async () => {
      const result = await handleDelete({} as any, mockStorage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject negative id', async () => {
      const result = await handleDelete({ id: -1 }, mockStorage);

      expect(result.success).toBe(false);
    });

    it('should reject non-integer id', async () => {
      const result = await handleDelete({ id: 3.14 }, mockStorage);

      expect(result.success).toBe(false);
    });
  });

  describe('item existence', () => {
    it('should return error if item not found', async () => {
      const result = await handleDelete({ id: 999 }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('999');
    });

    it('should delete existing item successfully', async () => {
      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
    });
  });

  describe('soft delete (default)', () => {
    it('should mark item as archived by default', async () => {
      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.status).toBe('archived');
    });

    it('should update timestamp', async () => {
      const originalUpdatedAt = existingItem.updated_at;

      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.updated_at).not.toBe(originalUpdatedAt);
    });

    it('should preserve other fields', async () => {
      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.id).toBe(1);
      expect(existingItem.decision).toBe('Test decision');
      expect(existingItem.created_at).toBe('2025-01-01T00:00:00Z');
    });

    it('should include success message', async () => {
      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.message).toContain('archived');
      expect(result.message).toContain('1');
    });
  });

  describe('hard delete', () => {
    it('should accept hard flag', async () => {
      const result = await handleDelete({ id: 1, hard: true }, mockStorage);

      expect(result.success).toBe(true);
    });

    it('should mark as archived (Phase 2 pending)', async () => {
      const result = await handleDelete({ id: 1, hard: true }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.status).toBe('archived');
    });

    it('should include warning about Phase 2', async () => {
      const result = await handleDelete({ id: 1, hard: true }, mockStorage);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorage.update = async () => {
        throw new Error('Storage error');
      };

      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle findById errors gracefully', async () => {
      mockStorage.findById = async () => {
        throw new Error('Find error');
      };

      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle already archived items', async () => {
      existingItem.status = 'archived';

      const result = await handleDelete({ id: 1 }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.status).toBe('archived');
    });

    it('should handle hard=false explicitly', async () => {
      const result = await handleDelete({ id: 1, hard: false }, mockStorage);

      expect(result.success).toBe(true);
      expect(existingItem.status).toBe('archived');
      expect(result.message).toContain('soft delete');
    });
  });
});
