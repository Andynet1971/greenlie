import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the overview shows all four checks, each with a verdict spelled out in text', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.check-row');
  await expect(rows).toHaveCount(4);
  for (const badge of await page.locator('.check-row .verdict-badge').all()) {
    await expect(badge).not.toBeEmpty();
  }
});

test('the thin check shows why: delivered 3, under 50% of the usual 100', async ({ page }) => {
  await page.goto('/');
  const jobFeedRow = page.locator('.check-row', { has: page.getByRole('link', { name: 'Job feed API' }) });
  await expect(jobFeedRow.locator('.check-reason')).toHaveText('delivered 3, under 50% of the usual 100');
  await expect(jobFeedRow.locator('.verdict-badge')).toHaveText('Thin');
});

test('the detail page has a labeled chart with a threshold line, and a table of runs', async ({ page }) => {
  await page.goto('/checks/job-feed');
  // Next's own dev-tools toggle is also role=img in dev mode; scope to our chart.
  const chart = page.locator('svg.chart');
  await expect(chart).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('.chart-threshold')).toHaveCount(1);
  await expect(page.locator('.runs-table tbody tr')).toHaveCount(13);
});

test('an unknown check id renders the app 404', async ({ page }) => {
  const response = await page.goto('/checks/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('pinging the right token succeeds and the heartbeat reads ok on reload; the wrong token 404s', async ({
  page,
  request,
}) => {
  const good = await request.get('/ping/e2e-test-token-nightly-backup');
  expect(good.status()).toBe(200);

  await page.goto('/checks/nightly-backup');
  // The runs table has its own per-row badges; only the page-level one is a direct child of <main>.
  await expect(page.locator('main > .verdict-badge')).toHaveText('OK');

  const bad = await request.get('/ping/wrong-token-altogether');
  expect(bad.status()).toBe(404);
});

test('/healthz reports ok', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no axe violations on the overview or the detail page (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });

    // meta-refresh is disabled on purpose: the overview's 60s <meta http-equiv="refresh">
    // is the deliberate no-JavaScript update mechanism (STATO_E_ROADMAP.md, Fase 3), which
    // axe flags on principle regardless of the interval. Everything else must stay clean.
    await page.goto('/');
    const overviewResults = await new AxeBuilder({ page }).disableRules(['meta-refresh']).analyze();
    expect(overviewResults.violations).toEqual([]);

    await page.goto('/checks/job-feed');
    const detailResults = await new AxeBuilder({ page }).analyze();
    expect(detailResults.violations).toEqual([]);
  });
}

test('no horizontal scroll at 375px, on the overview and the detail page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });

  for (const path of ['/', '/checks/job-feed']) {
    await page.goto(path);
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows, `${path} scrolls horizontally at 375px`).toBe(false);
  }
});
