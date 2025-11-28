/**
 * CI-specific Jest configuration
 *
 * Excludes integration tests that are slow, timeout-prone, or require
 * real server connections. Unit tests (including mcp-client.unit.test.ts)
 * are still run to maintain coverage.
 *
 * Excluded in CI:
 * - mcp-client.test.ts (integration test, spawns real server)
 * - cli/integration/ (CLI integration tests)
 * - performance.test.ts (timing-dependent benchmarks)
 * - concurrency.test.ts (flaky race condition tests)
 */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  // CI excludes integration tests that are slow or require real connections
  // NOTE: mcp-client.unit.test.ts is NOT excluded - it provides 100% coverage
  testPathIgnorePatterns: [
    "tests/cli/mcp-client\\.test\\.ts$",
    "tests/cli/integration/",
    "tests/integration/performance\\.test\\.ts$",
    "tests/integration/concurrency\\.test\\.ts$",
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    // Exclude main entry point (bootstrapping only)
    "!src/index.ts",
    // Exclude barrel files (pure re-exports, no logic)
    "!src/tools/**/index.ts",
    // Exclude pure schema definitions (data only, no executable logic)
    "!src/schemas/output-schemas.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary"],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
