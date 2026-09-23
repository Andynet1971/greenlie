import type { HeartbeatCheck, ProbeCheck, ProbeOutcome } from '@greenlie/core';
import { createStore, type Connection, type Store } from '@greenlie/db';
import { createTestDatabase } from '@greenlie/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runHeartbeatCycle, runProbeCycle, type CycleDeps } from './cycle.js';
import type { AlertEvent } from './notify/channel.js';

let connection: Connection;
let store: Store;
let alerts: AlertEvent[];
let clock: number;

beforeAll(async () => {
  connection = await createTestDatabase();
  store = createStore(connection.db);
});

beforeEach(async () => {
  await connection.db.execute(sql`truncate table runs, check_state restart identity`);
  alerts = [];
  clock = Date.UTC(2026, 8, 23, 8, 0);
});

afterAll(() => connection.close());

const MINUTE = 60_000;
const deps = (): CycleDeps => ({
  store,
  notify: async (event) => void alerts.push(event),
  now: () => new Date((clock += MINUTE)),
});

const feed: ProbeCheck = {
  type: 'json-volume',
  id: 'feed',
  name: 'Job feed',
  url: 'https://example.com/jobs',
  everyMs: MINUTE,
  timeoutMs: 1_000,
  headers: {},
  confirmations: 2,
  rules: { expectStatus: [200], volume: { path: '$.jobs', thinBelow: 0.5, window: 20, minSamples: 3 } },
};

const jobs = (count: number): ProbeOutcome => ({
  kind: 'response',
  status: 200,
  latencyMs: 40,
  body: { jobs: Array.from({ length: count }, (_, i) => i) },
});

/** Runs the cycle once per outcome and returns the verdicts. */
async function runSequence(outcomes: ProbeOutcome[], check = feed) {
  const verdicts = [];
  for (const outcome of outcomes) {
    verdicts.push(await runProbeCycle(check, async () => outcome, deps()));
  }
  return verdicts;
}

const summary = () => alerts.map((a) => `${a.transition.kind}:${a.transition.to}`);

describe('runProbeCycle', () => {
  it('learns, then settles healthy without a word', async () => {
    expect(await runSequence([jobs(100), jobs(101), jobs(99), jobs(100)])).toEqual(['unknown', 'unknown', 'unknown', 'ok']);
    expect(alerts).toEqual([]);
    expect(await store.ensureCheck('feed', new Date())).toMatchObject({ announced: 'ok' });
  });

  it('stores every run with what it measured', async () => {
    await runSequence([jobs(7)]);
    const [run] = await store.latestRuns('feed', 1);
    expect(run).toMatchObject({ verdict: 'unknown', status: 200, latencyMs: 40, volume: 7 });
  });

  it('stores a network failure without status or latency', async () => {
    await runSequence([{ kind: 'error', message: 'connection refused' }]);
    const [run] = await store.latestRuns('feed', 1);
    expect(run).toMatchObject({ verdict: 'down', reason: 'connection refused', status: null, latencyMs: null, volume: null });
  });

  it('⭐ alerts once on a silent failure, after it is confirmed', async () => {
    await runSequence([jobs(100), jobs(100), jobs(100), jobs(100)]);
    expect(await runSequence([jobs(3)])).toEqual(['thin']);
    expect(alerts).toEqual([]); // one thin run could be a blip

    await runSequence([jobs(3), jobs(3), jobs(3)]);
    expect(summary()).toEqual(['failing:thin']);
    expect(alerts[0]).toMatchObject({ checkName: 'Job feed', reason: 'delivered 3, under 50% of the usual 100' });
  });

  it('⭐ keeps calling a long outage thin — it never becomes the new normal', async () => {
    await runSequence([jobs(100), jobs(100), jobs(100)]);
    const verdicts = await runSequence(Array.from({ length: 30 }, () => jobs(3)));
    expect(new Set(verdicts)).toEqual(new Set(['thin']));
    expect(summary()).toEqual(['failing:thin']);
  });

  it('announces the recovery once it holds', async () => {
    await runSequence([jobs(100), jobs(100), jobs(100), jobs(100), jobs(3), jobs(3)]);
    await runSequence([jobs(100)]);
    expect(summary()).toEqual(['failing:thin']);
    await runSequence([jobs(100)]);
    expect(summary()).toEqual(['failing:thin', 'recovered:ok']);
  });

  it('ignores a single blip between healthy runs', async () => {
    await runSequence([jobs(100), jobs(100), jobs(100), jobs(100), { kind: 'error', message: 'reset' }, jobs(100)]);
    expect(alerts).toEqual([]);
  });

  it('alerts at once when confirmations is 1', async () => {
    const eager = { ...feed, type: 'http' as const, confirmations: 1, rules: { expectStatus: [200] } };
    await runSequence([jobs(1), { kind: 'response', status: 500, latencyMs: 5, body: null }], eager);
    expect(summary()).toEqual(['failing:down']);
  });
});

describe('runHeartbeatCycle', () => {
  const backup: HeartbeatCheck = {
    type: 'heartbeat',
    id: 'backup',
    name: 'Nightly backup',
    token: 'x'.repeat(16),
    rules: { everyMs: 60 * MINUTE, graceMs: 5 * MINUTE },
  };

  it('waits quietly for the first ping', async () => {
    expect(await runHeartbeatCycle(backup, deps())).toBe('unknown');
    expect(alerts).toEqual([]);
  });

  it('alerts when a job that never pinged misses its first deadline', async () => {
    await runHeartbeatCycle(backup, deps());
    clock += 70 * MINUTE;
    expect(await runHeartbeatCycle(backup, deps())).toBe('stale');
    expect(summary()).toEqual(['failing:stale']);
  });

  it('recovers when the ping arrives, and does not repeat itself meanwhile', async () => {
    await runHeartbeatCycle(backup, deps());
    clock += 70 * MINUTE;
    await runHeartbeatCycle(backup, deps());
    await runHeartbeatCycle(backup, deps());
    await store.recordPing('backup', new Date(clock));
    expect(await runHeartbeatCycle(backup, deps())).toBe('ok');
    expect(summary()).toEqual(['failing:stale', 'recovered:ok']);
  });
});
