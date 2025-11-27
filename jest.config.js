export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  // Exclude integration tests that require real server connection (slow, timeout-prone)
  testPathIgnorePatterns: [
    'tests/cli/mcp-client\\.test\\.ts$',
    'tests/cli/integration/',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    // Exclude main entry point (bootstrapping only)
    '!src/index.ts',
    // Exclude barrel files (pure re-exports, no logic)
    '!src/tools/**/index.ts',
    // Exclude pure schema definitions (data only, no executable logic)
    '!src/schemas/output-schemas.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
