import type { Check } from '@greenlie/core';
import type { CheckState, Run } from '@greenlie/db';
import { describe, expect, it } from 'vitest';
import { buildOverview } from './overview';

const now = new Date('2026-09-23T12:00:00Z');

const http: Check = {
  type: 'http',
  id: 'site',
  name: 'Marketing site',
  url: 'https://example.com/status',
  everyMs: 60_000,
  timeoutMs: 5000,
  headers: {},
  confirmations: 1,
  rules: { expectStatus: [200] },
};

const jsonVolume: Check = {
  type: 'json-volume',
  id: 'feed',
  name: 'Job feed',
  url: 'https://api.example.com/jobs',
  everyMs: 60_000,
  timeoutMs: 5000,
  headers: {},
  confirmations: 1,
  rules: { expectStatus: [200], volume: { path: '$.items', thinBelow: 0.5, window: 20, minSamples: 5 } },
};

const heartbeat: Check = {
  type: 'heartbeat',
  id: 'backup',
  name: 'Nightly backup',
  token: 'secret',
  rules: { everyMs: 86_400_000, graceMs: 1_800_000 },
};

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a defined value');
  return value;
}

function run(overrides: Partial<Run>): Run {
  return {
    id: 1,
    checkId: 'site',
    at: now,
    verdict: 'ok',
    reason: 'answered 200 in 40ms',
    status: 200,
    latencyMs: 40,
    volume: null,
    ...overrides,
  };
}

describe('buildOverview', () => {
  it('judges an HTTP check by its latest run and reads the host from the url', () => {
    const runs = new Map([['site', [run({ verdict: 'slow', reason: 'answered in 3s, slower than 2s' })]]]);
    const row = defined(buildOverview([http], runs, new Map(), now)[0]);
    expect(row).toMatchObject({ verdict: 'slow', reason: 'answered in 3s, slower than 2s', host: 'example.com' });
  });

  it('falls back to unknown / "no runs yet" when a probe check has no runs', () => {
    const row = defined(buildOverview([http], new Map(), new Map(), now)[0]);
    expect(row).toMatchObject({ verdict: 'unknown', reason: 'no runs yet' });
  });

  it('judges a heartbeat live from its state, not from a run', () => {
    const states = new Map<string, CheckState>([
      ['backup', { checkId: 'backup', watchingSince: now, announced: null, announcedAt: null, lastPingAt: now }],
    ]);
    const row = defined(buildOverview([heartbeat], new Map(), states, now)[0]);
    expect(row.verdict).toBe('ok');
    expect(row.host).toBeUndefined();
    expect(row.series).toEqual([]);
  });

  it('reports a heartbeat with no state yet as unknown, waiting for the first ping', () => {
    const row = defined(buildOverview([heartbeat], new Map(), new Map(), now)[0]);
    expect(row).toMatchObject({ verdict: 'unknown', reason: 'waiting for the first ping' });
  });

  it('builds the series oldest-first, capped at 30, skipping runs without a value', () => {
    const runs = Array.from({ length: 32 }, (_, i) =>
      run({ id: i, at: new Date(now.getTime() + i * 1000), latencyMs: i === 31 ? null : i }),
    ).reverse(); // newest-first, as latestRuns returns them
    const row = defined(buildOverview([http], new Map([['site', runs]]), new Map(), now)[0]);
    expect(row.series).toHaveLength(29);
    expect(defined(row.series[0]).value).toBe(2); // oldest kept: index 2 of 0..31, last 30 are 2..31
    expect(defined(row.series.at(-1)).value).toBe(30); // 31 was dropped (null latency)
  });

  it('reads volume for json-volume checks and latency for http checks', () => {
    const runs = new Map([['feed', [run({ checkId: 'feed', volume: 42, latencyMs: null })]]]);
    const row = defined(buildOverview([jsonVolume], runs, new Map(), now)[0]);
    expect(row.series).toEqual([{ at: now, value: 42, verdict: 'ok' }]);
  });
});
