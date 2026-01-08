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
  // Exclude integration tests that require real server connection (slow, timeout-prone)
  testPathIgnorePatterns: [
    "tests/cli/mcp-client\\.test\\.ts$",
    "tests/cli/integration/",
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    // Exclude main entry point (bootstrapping only)
    "!src/index.ts",
    // Exclude MCP server entrypoint (bootstrapping with stdio transport)
    "!src/presentation/mcp/server.ts",
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
