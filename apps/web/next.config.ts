import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The Postgres driver and the in-process test database are Node-only:
  // bundling them for the server runtime would break on native/WASM bits.
  // @greenlie/db also resolves its migrations folder with `new URL(..., import.meta.url)`,
  // which the bundler cannot statically trace into a non-JS directory.
  serverExternalPackages: ['pg', '@electric-sql/pglite', '@greenlie/db'],
  // The dev server otherwise only trusts "localhost"; the e2e suite and some
  // local tooling hit it via the literal loopback address instead.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
