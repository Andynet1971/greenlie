import { computeBaseline, judgeVolume, type HistoryEntry } from '@greenlie/core';
import { connect, createStore, runMigrations } from '@greenlie/db';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5434/postgres';

/** pglite-server needs a moment to accept connections; retry instead of racing it. */
async function connectWithRetry(url: string, attempts = 30, delayMs = 500) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await connect(url);
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('unreachable');
}

async function main() {
  const connection = await connectWithRetry(DATABASE_URL);
  await runMigrations(connection.db);
  const store = createStore(connection.db);
  const now = new Date();
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);

  // A plain HTTP check, healthy.
  await store.ensureCheck('marketing-site', at(60));
  await store.insertRun({
    checkId: 'marketing-site',
    at: at(1),
    verdict: 'ok',
    reason: 'answered 200 in 40ms',
    status: 200,
    latencyMs: 40,
    volume: null,
  });

  // A json-volume check: 10 healthy runs at 100, then 3 thin runs at 3 — the
  // volume rules must match apps/web/e2e/greenlie.e2e.yml. Verdicts are computed
  // with the real core logic, so this stays correct if that logic ever changes.
  await store.ensureCheck('job-feed', at(60));
  const volumeRules = { window: 20, minSamples: 5, thinBelow: 0.5 };
  const history: HistoryEntry[] = [];
  const volumes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 3, 3, 3];
  for (const [index, volume] of volumes.entries()) {
    const baseline = computeBaseline(history, volumeRules);
    const judgement = judgeVolume(volume, baseline, volumeRules.thinBelow);
    await store.insertRun({
      checkId: 'job-feed',
      at: at(volumes.length - index),
      verdict: judgement.verdict,
      reason: judgement.reason,
      status: 200,
      latencyMs: 30,
      volume,
    });
    if (judgement.verdict === 'ok' || judgement.verdict === 'unknown' || judgement.verdict === 'slow') {
      history.push({ verdict: judgement.verdict, volume });
    }
  }

  // A heartbeat with a recent ping.
  await store.ensureCheck('nightly-backup', at(60));
  await store.recordPing('nightly-backup', at(2));
  await store.insertRun({
    checkId: 'nightly-backup',
    at: at(2),
    verdict: 'ok',
    reason: 'ping received',
    status: null,
    latencyMs: null,
    volume: null,
  });

  // "never-pinged" is left untouched: no check_state row, no runs.

  await connection.close();
  console.log('seeded e2e fixture data');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
