import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

const DB_PORT = 5434;
const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
const APP_PORT = 3100;
// "localhost", not "127.0.0.1": Next's dev server blocks cross-origin asset/HMR
// requests by default, and only recognizes the hostname it was started with.
const BASE_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
  },
  webServer: [
    {
      command: `npx pglite-server --port ${DB_PORT} --max-connections 10`,
      port: DB_PORT,
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      // seed.ts retries until pglite-server is ready, then next only starts once seeding is done.
      command: `npx tsx e2e/seed.ts && npx next dev --port ${APP_PORT}`,
      cwd: here,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL,
        GREENLIE_CONFIG: path.join(here, 'e2e/greenlie.e2e.yml'),
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
