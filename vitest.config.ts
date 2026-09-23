import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      // The core is pure logic: every line and branch is reachable from a test.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
