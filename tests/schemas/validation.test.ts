/**
 * Comprehensive validation schema tests
 * Phase 2.1: Complete Zod Validation Schemas
 *
 * TDD: These tests define the expected behavior of all validation schemas
 */

import { describe, it, expect } from "@jest/globals";
import {
  // Primitive schemas
  idSchema,
  statusSchema,
  prioritySchema,
  tagsSchema,
  dependenciesSchema,
  cursorSchema,

  // Pagination schemas
  paginationArgsSchema,

  // Filter schemas
  filterOperatorSchema,
  advancedFiltersSchema,
  sortOptionsSchema,

  // Tool schemas
  captureArgsSchema,
  updateArgsSchema,
  deleteArgsSchema,
  listArgsSchema,
  showArgsSchema,
  doArgsSchema,
  searchArgsSchema,
  bulkUpdateArgsSchema,
  bulkDeleteArgsSchema,

  // Validation functions
  validate,
  validateCapture,
  validateUpdate,
  validateDelete,
  validateList,
  validateShow,
  validateDo,
  validateSearch,
  validateBulkUpdate,
  validateBulkDelete,

  // Types
  type ValidationResult,
} from "../../src/schemas/validation.js";

describe("Schemas: Primitive Types", () => {
  describe("idSchema", () => {
    it("should accept positive integers", () => {
      expect(idSchema.safeParse(1).success).toBe(true);
      expect(idSchema.safeParse(100).success).toBe(true);
      expect(idSchema.safeParse(999999).success).toBe(true);
    });

    it("should reject zero", () => {
      expect(idSchema.safeParse(0).success).toBe(false);
    });

    it("should reject negative numbers", () => {
      expect(idSchema.safeParse(-1).success).toBe(false);
      expect(idSchema.safeParse(-100).success).toBe(false);
    });

    it("should reject non-integers", () => {
      expect(idSchema.safeParse(1.5).success).toBe(false);
      expect(idSchema.safeParse(3.14).success).toBe(false);
    });

    it("should reject non-numbers", () => {
      expect(idSchema.safeParse("1").success).toBe(false);
      expect(idSchema.safeParse(null).success).toBe(false);
      expect(idSchema.safeParse(undefined).success).toBe(false);
    });
  });

  describe("statusSchema", () => {
    it("should accept valid statuses", () => {
      expect(statusSchema.safeParse("pending").success).toBe(true);
      expect(statusSchema.safeParse("in-progress").success).toBe(true);
      expect(statusSchema.safeParse("done").success).toBe(true);
      expect(statusSchema.safeParse("archived").success).toBe(true);
    });

    it("should reject invalid statuses", () => {
      expect(statusSchema.safeParse("completed").success).toBe(false);
      expect(statusSchema.safeParse("cancelled").success).toBe(false);
      expect(statusSchema.safeParse("PENDING").success).toBe(false);
      expect(statusSchema.safeParse("").success).toBe(false);
    });
  });

  describe("prioritySchema", () => {
    it("should accept valid priorities", () => {
      expect(prioritySchema.safeParse("low").success).toBe(true);
      expect(prioritySchema.safeParse("medium").success).toBe(true);
      expect(prioritySchema.safeParse("high").success).toBe(true);
    });

    it("should reject invalid priorities", () => {
      expect(prioritySchema.safeParse("urgent").success).toBe(false);
      expect(prioritySchema.safeParse("critical").success).toBe(false);
      expect(prioritySchema.safeParse("LOW").success).toBe(false);
      expect(prioritySchema.safeParse(1).success).toBe(false);
    });
  });

  describe("tagsSchema", () => {
    it("should accept valid tag arrays", () => {
      expect(tagsSchema.safeParse(["tag1"]).success).toBe(true);
      expect(tagsSchema.safeParse(["tag1", "tag2"]).success).toBe(true);
      expect(tagsSchema.safeParse(["optimization", "database"]).success).toBe(
        true,
      );
    });

    it("should accept undefined (optional)", () => {
      expect(tagsSchema.safeParse(undefined).success).toBe(true);
    });

    it("should reject empty strings in array", () => {
      expect(tagsSchema.safeParse([""]).success).toBe(false);
      expect(tagsSchema.safeParse(["valid", ""]).success).toBe(false);
    });

    it("should reject tags exceeding max length (50 chars)", () => {
      const longTag = "a".repeat(51);
      expect(tagsSchema.safeParse([longTag]).success).toBe(false);
    });

    it("should reject arrays with more than 20 tags", () => {
      const manyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      expect(tagsSchema.safeParse(manyTags).success).toBe(false);
    });

    it("should accept up to 20 tags", () => {
      const maxTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      expect(tagsSchema.safeParse(maxTags).success).toBe(true);
    });

    it("should reject non-arrays", () => {
      expect(tagsSchema.safeParse("tag").success).toBe(false);
      expect(tagsSchema.safeParse({ tag: "value" }).success).toBe(false);
    });
  });

  describe("dependenciesSchema", () => {
    it("should accept valid dependency arrays", () => {
      expect(dependenciesSchema.safeParse([1]).success).toBe(true);
      expect(dependenciesSchema.safeParse([1, 2, 3]).success).toBe(true);
      expect(dependenciesSchema.safeParse([100, 200]).success).toBe(true);
    });

    it("should accept undefined (optional)", () => {
      expect(dependenciesSchema.safeParse(undefined).success).toBe(true);
    });

    it("should reject negative IDs", () => {
      expect(dependenciesSchema.safeParse([-1]).success).toBe(false);
      expect(dependenciesSchema.safeParse([1, -2, 3]).success).toBe(false);
    });

    it("should reject non-integer IDs", () => {
      expect(dependenciesSchema.safeParse([1.5]).success).toBe(false);
    });

    it("should reject arrays with more than 50 dependencies", () => {
      const manyDeps = Array.from({ length: 51 }, (_, i) => i + 1);
      expect(dependenciesSchema.safeParse(manyDeps).success).toBe(false);
    });

    it("should accept up to 50 dependencies", () => {
      const maxDeps = Array.from({ length: 50 }, (_, i) => i + 1);
      expect(dependenciesSchema.safeParse(maxDeps).success).toBe(true);
    });
  });

  describe("cursorSchema", () => {
    it("should accept valid base64 cursors", () => {
      // Valid base64 strings
      expect(cursorSchema.safeParse("MQ==").success).toBe(true);
      expect(cursorSchema.safeParse("MTIz").success).toBe(true);
      expect(cursorSchema.safeParse("eyJpZCI6MTIzfQ==").success).toBe(true);
    });

    it("should reject invalid base64 characters", () => {
      expect(cursorSchema.safeParse("abc!@#").success).toBe(false);
      expect(cursorSchema.safeParse("has spaces").success).toBe(false);
    });

    it("should reject empty strings", () => {
      expect(cursorSchema.safeParse("").success).toBe(false);
    });
  });
});

describe("Schemas: Pagination", () => {
  describe("paginationArgsSchema", () => {
    it("should accept forward pagination with first", () => {
      expect(paginationArgsSchema.safeParse({ first: 10 }).success).toBe(true);
    });

    it("should accept forward pagination with first and after", () => {
      expect(
        paginationArgsSchema.safeParse({ first: 10, after: "MQ==" }).success,
      ).toBe(true);
    });

    it("should accept backward pagination with last", () => {
      expect(paginationArgsSchema.safeParse({ last: 10 }).success).toBe(true);
    });

    it("should accept backward pagination with last and before", () => {
      expect(
        paginationArgsSchema.safeParse({ last: 10, before: "MQ==" }).success,
      ).toBe(true);
    });

    it("should reject using both first and last", () => {
      const result = paginationArgsSchema.safeParse({ first: 10, last: 10 });
      expect(result.success).toBe(false);
    });

    it("should reject using both after and before", () => {
      const result = paginationArgsSchema.safeParse({
        first: 10,
        after: "MQ==",
        before: "Mg==",
      });
      expect(result.success).toBe(false);
    });

    it("should reject first less than 1", () => {
      expect(paginationArgsSchema.safeParse({ first: 0 }).success).toBe(false);
      expect(paginationArgsSchema.safeParse({ first: -1 }).success).toBe(false);
    });

    it("should reject first greater than 100", () => {
      expect(paginationArgsSchema.safeParse({ first: 101 }).success).toBe(
        false,
      );
    });

    it("should accept first up to 100", () => {
      expect(paginationArgsSchema.safeParse({ first: 100 }).success).toBe(true);
    });

    it("should accept empty object", () => {
      expect(paginationArgsSchema.safeParse({}).success).toBe(true);
    });
  });
});

describe("Schemas: Filters", () => {
  describe("filterOperatorSchema", () => {
    it("should accept eq operator", () => {
      expect(filterOperatorSchema.safeParse({ eq: "pending" }).success).toBe(
        true,
      );
      expect(filterOperatorSchema.safeParse({ eq: 1 }).success).toBe(true);
    });

    it("should accept ne operator", () => {
      expect(filterOperatorSchema.safeParse({ ne: "archived" }).success).toBe(
        true,
      );
    });

    it("should accept in operator", () => {
      expect(
        filterOperatorSchema.safeParse({ in: ["pending", "in-progress"] })
          .success,
      ).toBe(true);
    });

    it("should accept contains operator", () => {
      expect(
        filterOperatorSchema.safeParse({ contains: "optimize" }).success,
      ).toBe(true);
    });

    it("should accept startsWith operator", () => {
      expect(
        filterOperatorSchema.safeParse({ startsWith: "Fix" }).success,
      ).toBe(true);
    });

    it("should accept endsWith operator", () => {
      expect(filterOperatorSchema.safeParse({ endsWith: "bug" }).success).toBe(
        true,
      );
    });

    it("should accept gte operator", () => {
      expect(filterOperatorSchema.safeParse({ gte: 10 }).success).toBe(true);
    });

    it("should accept lte operator", () => {
      expect(filterOperatorSchema.safeParse({ lte: 100 }).success).toBe(true);
    });

    it("should accept hasTag operator", () => {
      expect(
        filterOperatorSchema.safeParse({ hasTag: "optimization" }).success,
      ).toBe(true);
    });

    it("should accept empty object", () => {
      expect(filterOperatorSchema.safeParse({}).success).toBe(true);
    });

    it("should reject multiple operators on same field", () => {
      const result = filterOperatorSchema.safeParse({ eq: "a", ne: "b" });
      expect(result.success).toBe(false);
    });
  });

  describe("advancedFiltersSchema", () => {
    it("should accept status filter", () => {
      expect(
        advancedFiltersSchema.safeParse({ status: { eq: "pending" } }).success,
      ).toBe(true);
    });

    it("should accept priority filter", () => {
      expect(
        advancedFiltersSchema.safeParse({
          priority: { in: ["high", "medium"] },
        }).success,
      ).toBe(true);
    });

    it("should accept multiple filters", () => {
      const result = advancedFiltersSchema.safeParse({
        status: { eq: "pending" },
        priority: { eq: "high" },
        decision: { contains: "optimize" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept tags filter with hasTag", () => {
      expect(
        advancedFiltersSchema.safeParse({ tags: { hasTag: "database" } })
          .success,
      ).toBe(true);
    });

    it("should accept date range filters", () => {
      const result = advancedFiltersSchema.safeParse({
        created_at: { gte: 1699000000000 },
        updated_at: { lte: 1700000000000 },
      });
      expect(result.success).toBe(true);
    });

    it("should accept undefined", () => {
      expect(advancedFiltersSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe("sortOptionsSchema", () => {
    it("should accept valid sort options", () => {
      expect(
        sortOptionsSchema.safeParse({ field: "created_at", direction: "DESC" })
          .success,
      ).toBe(true);
      expect(
        sortOptionsSchema.safeParse({ field: "priority", direction: "ASC" })
          .success,
      ).toBe(true);
    });

    it("should accept all valid fields", () => {
      const validFields = [
        "created_at",
        "updated_at",
        "priority",
        "status",
        "id",
      ];
      for (const field of validFields) {
        expect(
          sortOptionsSchema.safeParse({ field, direction: "ASC" }).success,
        ).toBe(true);
      }
    });

    it("should reject invalid fields", () => {
      expect(
        sortOptionsSchema.safeParse({ field: "decision", direction: "ASC" })
          .success,
      ).toBe(false);
    });

    it("should reject invalid direction", () => {
      expect(
        sortOptionsSchema.safeParse({ field: "id", direction: "ASCENDING" })
          .success,
      ).toBe(false);
    });
  });
});

describe("Schemas: Tool Arguments", () => {
  describe("captureArgsSchema", () => {
    it("should accept minimal valid args", () => {
      expect(
        captureArgsSchema.safeParse({ decision: "Test decision" }).success,
      ).toBe(true);
    });

    it("should accept full args", () => {
      const result = captureArgsSchema.safeParse({
        decision: "Test decision",
        context: "Some context",
        tags: ["tag1", "tag2"],
        priority: "high",
        dependencies: [1, 2],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty decision", () => {
      expect(captureArgsSchema.safeParse({ decision: "" }).success).toBe(false);
    });

    it("should reject decision over 500 chars", () => {
      expect(
        captureArgsSchema.safeParse({ decision: "a".repeat(501) }).success,
      ).toBe(false);
    });

    it("should accept decision up to 500 chars", () => {
      expect(
        captureArgsSchema.safeParse({ decision: "a".repeat(500) }).success,
      ).toBe(true);
    });

    it("should reject context over 10000 chars", () => {
      expect(
        captureArgsSchema.safeParse({
          decision: "test",
          context: "a".repeat(10001),
        }).success,
      ).toBe(false);
    });

    it("should accept context up to 10000 chars", () => {
      expect(
        captureArgsSchema.safeParse({
          decision: "test",
          context: "a".repeat(10000),
        }).success,
      ).toBe(true);
    });

    it("should reject missing decision", () => {
      expect(
        captureArgsSchema.safeParse({ context: "context only" }).success,
      ).toBe(false);
    });
  });

  describe("updateArgsSchema", () => {
    it("should accept id with any update field", () => {
      expect(
        updateArgsSchema.safeParse({ id: 1, decision: "Updated" }).success,
      ).toBe(true);
      expect(
        updateArgsSchema.safeParse({ id: 1, status: "done" }).success,
      ).toBe(true);
      expect(
        updateArgsSchema.safeParse({ id: 1, priority: "high" }).success,
      ).toBe(true);
    });

    it("should accept id only (no updates)", () => {
      // Valid - business logic handles this case
      expect(updateArgsSchema.safeParse({ id: 1 }).success).toBe(true);
    });

    it("should reject missing id", () => {
      expect(updateArgsSchema.safeParse({ decision: "Updated" }).success).toBe(
        false,
      );
    });

    it("should reject invalid id", () => {
      expect(
        updateArgsSchema.safeParse({ id: -1, decision: "Updated" }).success,
      ).toBe(false);
    });

    it("should accept all valid status values", () => {
      const statuses = ["pending", "in-progress", "done", "archived"];
      for (const status of statuses) {
        expect(updateArgsSchema.safeParse({ id: 1, status }).success).toBe(
          true,
        );
      }
    });
  });

  describe("deleteArgsSchema", () => {
    it("should accept id only", () => {
      expect(deleteArgsSchema.safeParse({ id: 1 }).success).toBe(true);
    });

    it("should accept id with hard flag", () => {
      expect(deleteArgsSchema.safeParse({ id: 1, hard: true }).success).toBe(
        true,
      );
      expect(deleteArgsSchema.safeParse({ id: 1, hard: false }).success).toBe(
        true,
      );
    });

    it("should reject missing id", () => {
      expect(deleteArgsSchema.safeParse({ hard: true }).success).toBe(false);
    });

    it("should reject invalid hard flag type", () => {
      expect(deleteArgsSchema.safeParse({ id: 1, hard: "yes" }).success).toBe(
        false,
      );
    });
  });

  describe("listArgsSchema", () => {
    it("should accept empty/undefined args", () => {
      expect(listArgsSchema.safeParse({}).success).toBe(true);
      expect(listArgsSchema.safeParse(undefined).success).toBe(true);
    });

    it("should accept legacy filter args", () => {
      expect(listArgsSchema.safeParse({ status: "pending" }).success).toBe(
        true,
      );
      expect(listArgsSchema.safeParse({ priority: "high" }).success).toBe(true);
      expect(listArgsSchema.safeParse({ tags: ["tag1", "tag2"] }).success).toBe(
        true,
      );
      expect(listArgsSchema.safeParse({ limit: 50 }).success).toBe(true);
    });

    it("should accept advanced filters", () => {
      expect(
        listArgsSchema.safeParse({
          filters: { status: { eq: "pending" } },
        }).success,
      ).toBe(true);
    });

    it("should accept orderBy", () => {
      expect(
        listArgsSchema.safeParse({
          orderBy: [{ field: "created_at", direction: "DESC" }],
        }).success,
      ).toBe(true);
    });

    it("should accept pagination", () => {
      expect(
        listArgsSchema.safeParse({
          pagination: { first: 10, after: "MQ==" },
        }).success,
      ).toBe(true);
    });

    it("should reject limit below 1", () => {
      expect(listArgsSchema.safeParse({ limit: 0 }).success).toBe(false);
    });

    it("should reject limit above 1000", () => {
      expect(listArgsSchema.safeParse({ limit: 1001 }).success).toBe(false);
    });

    it("should reject more than 3 sort options", () => {
      expect(
        listArgsSchema.safeParse({
          orderBy: [
            { field: "created_at", direction: "DESC" },
            { field: "priority", direction: "ASC" },
            { field: "status", direction: "DESC" },
            { field: "id", direction: "ASC" },
          ],
        }).success,
      ).toBe(false);
    });
  });

  describe("showArgsSchema", () => {
    it("should accept valid id", () => {
      expect(showArgsSchema.safeParse({ id: 1 }).success).toBe(true);
      expect(showArgsSchema.safeParse({ id: 999 }).success).toBe(true);
    });

    it("should reject missing id", () => {
      expect(showArgsSchema.safeParse({}).success).toBe(false);
    });

    it("should reject invalid id", () => {
      expect(showArgsSchema.safeParse({ id: 0 }).success).toBe(false);
      expect(showArgsSchema.safeParse({ id: -1 }).success).toBe(false);
      expect(showArgsSchema.safeParse({ id: "1" }).success).toBe(false);
    });
  });

  describe("doArgsSchema", () => {
    it("should accept valid id", () => {
      expect(doArgsSchema.safeParse({ id: 1 }).success).toBe(true);
    });

    it("should reject missing id", () => {
      expect(doArgsSchema.safeParse({}).success).toBe(false);
    });

    it("should reject invalid id", () => {
      expect(doArgsSchema.safeParse({ id: -1 }).success).toBe(false);
    });
  });

  describe("searchArgsSchema", () => {
    it("should accept query only", () => {
      expect(searchArgsSchema.safeParse({ query: "optimize" }).success).toBe(
        true,
      );
    });

    it("should accept full args", () => {
      const result = searchArgsSchema.safeParse({
        query: "database optimization",
        fields: ["decision", "context"],
        limit: 20,
        minScore: 0.5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      expect(searchArgsSchema.safeParse({ query: "" }).success).toBe(false);
    });

    it("should reject query over 500 chars", () => {
      expect(
        searchArgsSchema.safeParse({ query: "a".repeat(501) }).success,
      ).toBe(false);
    });

    it("should accept valid fields", () => {
      expect(
        searchArgsSchema.safeParse({
          query: "test",
          fields: ["decision"],
        }).success,
      ).toBe(true);
      expect(
        searchArgsSchema.safeParse({
          query: "test",
          fields: ["context"],
        }).success,
      ).toBe(true);
      expect(
        searchArgsSchema.safeParse({
          query: "test",
          fields: ["tags"],
        }).success,
      ).toBe(true);
      expect(
        searchArgsSchema.safeParse({
          query: "test",
          fields: ["decision", "context", "tags"],
        }).success,
      ).toBe(true);
    });

    it("should reject invalid fields", () => {
      expect(
        searchArgsSchema.safeParse({
          query: "test",
          fields: ["invalid"],
        }).success,
      ).toBe(false);
    });

    it("should reject limit below 1", () => {
      expect(
        searchArgsSchema.safeParse({ query: "test", limit: 0 }).success,
      ).toBe(false);
    });

    it("should reject limit above 100", () => {
      expect(
        searchArgsSchema.safeParse({ query: "test", limit: 101 }).success,
      ).toBe(false);
    });

    it("should reject minScore below 0", () => {
      expect(
        searchArgsSchema.safeParse({ query: "test", minScore: -0.1 }).success,
      ).toBe(false);
    });

    it("should reject minScore above 1", () => {
      expect(
        searchArgsSchema.safeParse({ query: "test", minScore: 1.1 }).success,
      ).toBe(false);
    });

    it("should accept minScore of 0 and 1", () => {
      expect(
        searchArgsSchema.safeParse({ query: "test", minScore: 0 }).success,
      ).toBe(true);
      expect(
        searchArgsSchema.safeParse({ query: "test", minScore: 1 }).success,
      ).toBe(true);
    });
  });

  describe("bulkUpdateArgsSchema", () => {
    it("should accept valid bulk update args", () => {
      const result = bulkUpdateArgsSchema.safeParse({
        ids: [1, 2, 3],
        changes: { status: "done" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept multiple changes", () => {
      const result = bulkUpdateArgsSchema.safeParse({
        ids: [1, 2],
        changes: {
          status: "in-progress",
          priority: "high",
          tags: ["urgent"],
        },
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty ids array", () => {
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [],
          changes: { status: "done" },
        }).success,
      ).toBe(false);
    });

    it("should reject more than 100 ids", () => {
      const manyIds = Array.from({ length: 101 }, (_, i) => i + 1);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: manyIds,
          changes: { status: "done" },
        }).success,
      ).toBe(false);
    });

    it("should accept up to 100 ids", () => {
      const maxIds = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: maxIds,
          changes: { status: "done" },
        }).success,
      ).toBe(true);
    });

    it("should reject empty changes object", () => {
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1, 2],
          changes: {},
        }).success,
      ).toBe(false);
    });

    it("should accept all valid change fields", () => {
      // Test each field individually
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { decision: "New decision" },
        }).success,
      ).toBe(true);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { context: "New context" },
        }).success,
      ).toBe(true);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { tags: ["new-tag"] },
        }).success,
      ).toBe(true);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { priority: "low" },
        }).success,
      ).toBe(true);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { status: "archived" },
        }).success,
      ).toBe(true);
      expect(
        bulkUpdateArgsSchema.safeParse({
          ids: [1],
          changes: { dependencies: [2, 3] },
        }).success,
      ).toBe(true);
    });
  });

  describe("bulkDeleteArgsSchema", () => {
    it("should accept valid bulk delete args", () => {
      expect(bulkDeleteArgsSchema.safeParse({ ids: [1, 2, 3] }).success).toBe(
        true,
      );
    });

    it("should accept ids with hard flag", () => {
      expect(
        bulkDeleteArgsSchema.safeParse({ ids: [1, 2], hard: true }).success,
      ).toBe(true);
      expect(
        bulkDeleteArgsSchema.safeParse({ ids: [1, 2], hard: false }).success,
      ).toBe(true);
    });

    it("should reject empty ids array", () => {
      expect(bulkDeleteArgsSchema.safeParse({ ids: [] }).success).toBe(false);
    });

    it("should reject more than 100 ids", () => {
      const manyIds = Array.from({ length: 101 }, (_, i) => i + 1);
      expect(bulkDeleteArgsSchema.safeParse({ ids: manyIds }).success).toBe(
        false,
      );
    });

    it("should reject invalid id values", () => {
      expect(bulkDeleteArgsSchema.safeParse({ ids: [0] }).success).toBe(false);
      expect(bulkDeleteArgsSchema.safeParse({ ids: [-1] }).success).toBe(false);
      expect(bulkDeleteArgsSchema.safeParse({ ids: [1.5] }).success).toBe(
        false,
      );
    });
  });
});

describe("Validation Functions", () => {
  describe("validate<T> generic function", () => {
    it("should return success with parsed data for valid input", () => {
      const result = validate(idSchema, 42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it("should return errors for invalid input", () => {
      const result = validate(idSchema, -1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should format error paths correctly", () => {
      const result = validate(captureArgsSchema, { decision: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]).toContain("decision");
      }
    });
  });

  describe("validateCapture", () => {
    it("should validate and return typed result", () => {
      const result = validateCapture({ decision: "Test" });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should return errors for invalid input", () => {
      const result = validateCapture({ decision: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateUpdate", () => {
    it("should validate update args", () => {
      const result = validateUpdate({ id: 1, status: "done" });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateDelete", () => {
    it("should validate delete args", () => {
      const result = validateDelete({ id: 1 });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateList", () => {
    it("should validate list args", () => {
      const result = validateList({ status: "pending" });
      expect(result.valid).toBe(true);
    });

    it("should handle undefined", () => {
      const result = validateList(undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateShow", () => {
    it("should validate show args", () => {
      const result = validateShow({ id: 1 });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateDo", () => {
    it("should validate do args", () => {
      const result = validateDo({ id: 1 });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateSearch", () => {
    it("should validate search args", () => {
      const result = validateSearch({ query: "optimize" });
      expect(result.valid).toBe(true);
    });

    it("should return errors for invalid search", () => {
      const result = validateSearch({ query: "" });
      expect(result.valid).toBe(false);
    });
  });

  describe("validateBulkUpdate", () => {
    it("should validate bulk update args", () => {
      const result = validateBulkUpdate({
        ids: [1, 2],
        changes: { status: "done" },
      });
      expect(result.valid).toBe(true);
    });

    it("should reject empty changes", () => {
      const result = validateBulkUpdate({
        ids: [1, 2],
        changes: {},
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("validateBulkDelete", () => {
    it("should validate bulk delete args", () => {
      const result = validateBulkDelete({ ids: [1, 2, 3] });
      expect(result.valid).toBe(true);
    });

    it("should reject empty ids", () => {
      const result = validateBulkDelete({ ids: [] });
      expect(result.valid).toBe(false);
    });
  });
});

describe("Edge Cases", () => {
  describe("null and undefined handling", () => {
    it("should handle null inputs", () => {
      expect(validateCapture(null as any).valid).toBe(false);
      expect(validateUpdate(null as any).valid).toBe(false);
      expect(validateDelete(null as any).valid).toBe(false);
      expect(validateShow(null as any).valid).toBe(false);
      expect(validateDo(null as any).valid).toBe(false);
      expect(validateSearch(null as any).valid).toBe(false);
      expect(validateBulkUpdate(null as any).valid).toBe(false);
      expect(validateBulkDelete(null as any).valid).toBe(false);
    });

    it("should handle undefined inputs where appropriate", () => {
      expect(validateList(undefined).valid).toBe(true); // List allows no args
    });
  });

  describe("extra unknown fields", () => {
    it("should strip unknown fields by default", () => {
      const result = validate(captureArgsSchema, {
        decision: "Test",
        unknownField: "ignored",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).unknownField).toBeUndefined();
      }
    });
  });

  describe("type coercion", () => {
    it("should not coerce string to number for id", () => {
      expect(validate(idSchema, "123").success).toBe(false);
    });

    it("should not coerce number to string for status", () => {
      expect(validate(statusSchema, 1).success).toBe(false);
    });
  });

  describe("boundary values", () => {
    it("should accept boundary values for decision length", () => {
      // Exactly 1 char
      expect(captureArgsSchema.safeParse({ decision: "a" }).success).toBe(true);
      // Exactly 500 chars
      expect(
        captureArgsSchema.safeParse({ decision: "a".repeat(500) }).success,
      ).toBe(true);
    });

    it("should accept boundary values for limit", () => {
      expect(listArgsSchema.safeParse({ limit: 1 }).success).toBe(true);
      expect(listArgsSchema.safeParse({ limit: 1000 }).success).toBe(true);
    });

    it("should accept boundary values for pagination first/last", () => {
      expect(paginationArgsSchema.safeParse({ first: 1 }).success).toBe(true);
      expect(paginationArgsSchema.safeParse({ first: 100 }).success).toBe(true);
      expect(paginationArgsSchema.safeParse({ last: 1 }).success).toBe(true);
      expect(paginationArgsSchema.safeParse({ last: 100 }).success).toBe(true);
    });
  });
});
