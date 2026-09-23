import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against the sources of sibling packages, never a stale build.
    alias: [
      { find: /^@greenlie\/core$/, replacement: source('./packages/core/src/index.ts') },
      { find: /^@greenlie\/db\/testing$/, replacement: source('./packages/db/src/testing.ts') },
      { find: /^@greenlie\/db$/, replacement: source('./packages/db/src/index.ts') },
    ],
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    // Each PGlite is private to its test file; a real server is shared, and
    // parallel files would truncate each other's tables mid-test.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    // PGlite takes a moment to boot; a slow CI runner should not fail on that.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      // main.ts and lib/server.ts only wire things together; testing.ts is the
      // test harness itself. Pages and components have no Vitest render target —
      // Playwright e2e covers them instead.
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        '**/main.ts',
        '**/testing.ts',
        '**/test-helpers/**',
        'apps/web/src/lib/server.ts',
        'apps/web/src/app/**',
        'apps/web/src/components/**',
      ],
      thresholds: {
        // The core is pure logic: every line and branch is reachable from a test.
        'packages/core/src/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
      },
    },
  },
});
