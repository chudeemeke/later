/**
 * CI-specific Jest configuration
 *
 * Extends the base config but:
 * 1. Excludes integration tests (slow, timeout-prone in CI)
 * 2. Excludes corresponding source files from coverage calculation
 *
 * This ensures coverage thresholds are fair - we don't penalize coverage
 * for files whose tests are intentionally excluded in CI.
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
  // CI excludes integration tests that are slow or require real connections
  testPathIgnorePatterns: [
    "tests/cli/mcp-client\\.test\\.ts$",
    "tests/cli/integration/",
    "tests/integration/performance/",
    "tests/integration/concurrency/",
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
    // CI-specific exclusions: source files whose tests are excluded in CI
    // This ensures fair coverage calculation
    "!src/cli/mcp-client.ts",
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
