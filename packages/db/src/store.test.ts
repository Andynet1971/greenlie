import type { Verdict } from '@greenlie/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createStore, type Store } from './store.js';
import { createTestDatabase } from './testing.js';
import type { Connection } from './connect.js';

let connection: Connection;
let store: Store;

beforeAll(async () => {
  connection = await createTestDatabase();
  store = createStore(connection.db);
});

beforeEach(async () => {
  await connection.db.execute(sql`truncate table runs, check_state restart identity`);
});

afterAll(async () => {
  await connection.close();
});

const t = (minute: number) => new Date(Date.UTC(2026, 8, 23, 8, minute));

async function addRuns(checkId: string, runs: [Verdict, number | null][]) {
  for (const [i, [verdict, volume]] of runs.entries()) {
    await store.insertRun({ checkId, at: t(i), verdict, reason: verdict, volume });
  }
}

describe('ensureCheck', () => {
  it('creates the state on first sight and keeps the original watchingSince', async () => {
    const first = await store.ensureCheck('api', t(0));
    const again = await store.ensureCheck('api', t(30));
    expect(first).toEqual({ checkId: 'api', watchingSince: t(0), announced: null, announcedAt: null, lastPingAt: null });
    expect(again.watchingSince).toEqual(t(0));
  });
});

describe('announce and recordPing', () => {
  it('update only the check they name', async () => {
    await store.ensureCheck('a', t(0));
    await store.ensureCheck('b', t(0));
    await store.announce('a', 'down', t(5));
    await store.recordPing('a', t(6));

    expect(await store.ensureCheck('a', t(9))).toMatchObject({ announced: 'down', announcedAt: t(5), lastPingAt: t(6) });
    expect(await store.ensureCheck('b', t(9))).toMatchObject({ announced: null, lastPingAt: null });
  });
});

describe('recentVerdicts', () => {
  it('returns the latest verdicts of one check, oldest first', async () => {
    await addRuns('api', [['ok', null], ['slow', null], ['down', null], ['ok', null]]);
    await addRuns('other', [['thin', 1]]);
    expect(await store.recentVerdicts('api', 3)).toEqual(['slow', 'down', 'ok']);
  });

  it('breaks ties on the same timestamp by insertion order', async () => {
    await store.insertRun({ checkId: 'api', at: t(0), verdict: 'ok', reason: '' });
    await store.insertRun({ checkId: 'api', at: t(0), verdict: 'down', reason: '' });
    expect(await store.recentVerdicts('api', 1)).toEqual(['down']);
  });
});

describe('baselineHistory', () => {
  it('⭐ still finds the healthy runs behind a long outage', async () => {
    const healthy: [Verdict, number][] = [['ok', 100], ['ok', 101], ['ok', 99]];
    const outage: [Verdict, number][] = Array.from({ length: 30 }, () => ['thin', 3]);
    await addRuns('feed', [...healthy, ...outage]);

    expect(await store.baselineHistory('feed', 20)).toEqual([
      { verdict: 'ok', volume: 100 },
      { verdict: 'ok', volume: 101 },
      { verdict: 'ok', volume: 99 },
    ]);
  });

  it('keeps learning and slow runs, drops down runs and runs without a volume', async () => {
    await addRuns('feed', [['unknown', 10], ['slow', 11], ['down', null], ['ok', null], ['stale', 5], ['ok', 12]]);
    expect(await store.baselineHistory('feed', 10)).toEqual([
      { verdict: 'unknown', volume: 10 },
      { verdict: 'slow', volume: 11 },
      { verdict: 'ok', volume: 12 },
    ]);
  });

  it('returns only the most recent ones', async () => {
    await addRuns('feed', [['ok', 1], ['ok', 2], ['ok', 3]]);
    expect(await store.baselineHistory('feed', 2)).toEqual([
      { verdict: 'ok', volume: 2 },
      { verdict: 'ok', volume: 3 },
    ]);
  });
});

describe('latestRuns', () => {
  it('returns full rows, newest first', async () => {
    await addRuns('api', [['ok', null], ['down', null]]);
    const rows = await store.latestRuns('api', 5);
    expect(rows.map((r) => [r.verdict, r.at])).toEqual([
      ['down', t(1)],
      ['ok', t(0)],
    ]);
  });
});

describe('pruneRuns', () => {
  it('deletes what is older than the cutoff and says how much', async () => {
    await addRuns('api', [['ok', null], ['ok', null], ['ok', null]]);
    expect(await store.pruneRuns(t(2))).toBe(2);
    expect(await store.recentVerdicts('api', 10)).toEqual(['ok']);
  });
});

describe('the schema', () => {
  it('refuses a verdict that does not exist', async () => {
    await expect(
      store.insertRun({ checkId: 'api', at: t(0), verdict: 'broken' as Verdict, reason: '' }),
    ).rejects.toThrow();
  });
});
