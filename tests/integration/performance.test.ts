import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { Storage } from "../../src/storage/interface.js";
import { JSONLStorage } from "../../src/storage/jsonl.js";
import { handleCapture } from "../../src/tools/core/capture.js";
import { handleList } from "../../src/tools/core/list.js";
import { handleShow } from "../../src/tools/core/show.js";
import { handleUpdate } from "../../src/tools/workflow/update.js";
import { handleDelete } from "../../src/tools/workflow/delete.js";
import { handleSearch } from "../../src/tools/search/search.js";
import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";

const TEST_DIR = path.join(homedir(), ".later-test-performance");

describe("Performance Benchmarks", () => {
  let storage: Storage;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    storage = new JSONLStorage(TEST_DIR);
  });

  afterEach(async () => {
    // Cleanup after tests with retry logic for Windows file handle release
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
        break;
      } catch (error: unknown) {
        const isRetryable =
          error instanceof Error &&
          "code" in error &&
          (error.code === "ENOTEMPTY" || error.code === "EBUSY");
        if (isRetryable && attempt < maxRetries - 1) {
          // Wait for file handles to be released on Windows
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1)),
          );
          continue;
        }
        // Ignore cleanup errors on final attempt
      }
    }
  });

  describe("Operation performance", () => {
    it("should capture items within 100ms target", async () => {
      const startTime = Date.now();

      await handleCapture(
        {
          decision: "Performance test item",
          context: "Testing capture performance",
          tags: ["performance", "test"],
          priority: "medium",
        },
        storage,
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should list items within 250ms target (small dataset)", async () => {
      // Create 10 items
      for (let i = 1; i <= 10; i++) {
        await handleCapture(
          {
            decision: `Item ${i}`,
            context: "Test context",
            tags: ["test"],
            priority: "medium",
          },
          storage,
        );
      }

      const startTime = Date.now();

      await handleList({}, storage);

      const duration = Date.now() - startTime;

      // 500ms allows for CI/WSL overhead while still catching major regressions
      expect(duration).toBeLessThan(500);
    });

    it("should list items within reasonable time (100 items)", async () => {
      // Create 100 items
      for (let i = 1; i <= 100; i++) {
        await handleCapture(
          {
            decision: `Item ${i}`,
            context: "Test context",
            tags: ["test"],
            priority: "medium",
          },
          storage,
        );
      }

      const startTime = Date.now();

      await handleList({}, storage);

      const duration = Date.now() - startTime;

      // Should still be reasonably fast with 100 items
      expect(duration).toBeLessThan(200);
    });

    it("should show item within 50ms target", async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: "Show performance test",
          context: "Testing show performance",
          tags: ["test"],
          priority: "medium",
        },
        storage,
      );

      const startTime = Date.now();

      await handleShow({ id: item.item_id! }, storage);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("should update item within 100ms target", async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: "Update performance test",
          context: "Testing update performance",
          tags: ["test"],
          priority: "medium",
        },
        storage,
      );

      const startTime = Date.now();

      await handleUpdate(
        {
          id: item.item_id!,
          priority: "high",
        },
        storage,
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it("should delete item within 50ms target", async () => {
      // Create an item
      const item = await handleCapture(
        {
          decision: "Delete performance test",
          context: "Testing delete performance",
          tags: ["test"],
          priority: "medium",
        },
        storage,
      );

      const startTime = Date.now();

      await handleDelete({ id: item.item_id! }, storage);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it("should search within 500ms target (100 items)", async () => {
      // Create 100 items with varied content
      for (let i = 1; i <= 100; i++) {
        await handleCapture(
          {
            decision: `${i % 2 === 0 ? "Feature" : "Bug"} item ${i}`,
            context: i % 3 === 0 ? "Database related" : "UI related",
            tags: i % 2 === 0 ? ["feature"] : ["bug"],
            priority: "medium",
          },
          storage,
        );
      }

      const startTime = Date.now();

      await handleSearch(
        {
          query: "database feature",
        },
        storage,
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  describe("Scalability", () => {
    it("should handle 500 items efficiently", async () => {
      const createStartTime = Date.now();

      // Create 500 items
      for (let i = 1; i <= 500; i++) {
        await handleCapture(
          {
            decision: `Item ${i}`,
            context: `Context for item ${i}`,
            tags: ["test"],
            priority: i % 3 === 0 ? "high" : "medium",
          },
          storage,
        );
      }

      const createDuration = Date.now() - createStartTime;

      // Average should be < 100ms per item
      const avgCreateTime = createDuration / 500;
      expect(avgCreateTime).toBeLessThan(100);

      // List should still be fast
      const listStartTime = Date.now();
      const listResult = await handleList({}, storage);
      const listDuration = Date.now() - listStartTime;

      expect(listResult.items.length).toBe(500);
      expect(listDuration).toBeLessThan(500); // Should handle 500 items in < 500ms
    }, 60000); // Increase timeout for large dataset

    it("should filter efficiently with large dataset", async () => {
      // Create 200 items
      for (let i = 1; i <= 200; i++) {
        await handleCapture(
          {
            decision: `Item ${i}`,
            context: "Test",
            tags: ["test"],
            priority: i % 2 === 0 ? "high" : "low",
          },
          storage,
        );
      }

      const startTime = Date.now();

      const result = await handleList({ priority: "high" }, storage);

      const duration = Date.now() - startTime;

      expect(result.items.length).toBe(100); // Half should be high priority
      expect(duration).toBeLessThan(300); // Should filter quickly
    }, 30000);

    it("should search efficiently with large dataset", async () => {
      // Create 200 items with varied keywords
      for (let i = 1; i <= 200; i++) {
        await handleCapture(
          {
            decision: `${i % 5 === 0 ? "Optimize" : "Implement"} feature ${i}`,
            context: `Details about feature ${i}`,
            tags: ["feature"],
            priority: "medium",
          },
          storage,
        );
      }

      const startTime = Date.now();

      const result = await handleSearch(
        {
          query: "optimize feature",
        },
        storage,
      );

      const duration = Date.now() - startTime;

      expect(result.totalFound).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should search 200 items in < 1s
    }, 30000);
  });

  describe("Throughput", () => {
    it("should handle rapid sequential operations", async () => {
      const operations = 50;
      const startTime = Date.now();

      for (let i = 1; i <= operations; i++) {
        await handleCapture(
          {
            decision: `Rapid test ${i}`,
            context: "Testing throughput",
            tags: ["test"],
            priority: "medium",
          },
          storage,
        );
      }

      const duration = Date.now() - startTime;
      const opsPerSecond = (operations / duration) * 1000;

      // Should achieve at least 10 operations per second
      expect(opsPerSecond).toBeGreaterThan(10);
    }, 15000);

    it("should handle mixed operations efficiently", async () => {
      // Create some base items
      const items = [];
      for (let i = 1; i <= 20; i++) {
        const result = await handleCapture(
          {
            decision: `Mixed test ${i}`,
            context: "Testing",
            tags: ["test"],
            priority: "medium",
          },
          storage,
        );
        items.push(result.item_id!);
      }

      const startTime = Date.now();

      // Perform mix of operations
      await handleList({}, storage);
      await handleShow({ id: items[0] }, storage);
      await handleUpdate({ id: items[1], priority: "high" }, storage);
      await handleDelete({ id: items[2] }, storage);
      await handleSearch({ query: "mixed test" }, storage);
      await handleList({ status: "pending" }, storage);

      const duration = Date.now() - startTime;

      // Mixed operations should complete quickly
      expect(duration).toBeLessThan(500);
    }, 15000);
  });
});
