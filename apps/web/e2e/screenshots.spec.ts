import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

// Tagged @screenshots so `npm run e2e` (--grep-invert) skips it and
// `npm run screenshots` (--grep) runs only this — see package.json.
test.describe('@screenshots', () => {
  test.use({ viewport: { width: 1200, height: 800 } });

  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/screenshots');

  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`overview screenshot (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await page.screenshot({ path: path.join(outDir, `overview-${colorScheme}.png`) });
    });

    test(`detail screenshot (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/checks/job-feed');
      await page.screenshot({ path: path.join(outDir, `detail-${colorScheme}.png`) });
    });
  }
});
