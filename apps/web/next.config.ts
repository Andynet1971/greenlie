import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The Postgres driver and the in-process test database are Node-only:
  // bundling them for the server runtime would break on native/WASM bits.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  // Next infers the monorepo root from the outermost lockfile; making it explicit
  // avoids a wrong guess silently leaving files out of the standalone output.
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  // The dev server otherwise only trusts "localhost"; the e2e suite and some
  // local tooling hit it via the literal loopback address instead.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
