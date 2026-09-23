import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from './baseline.js';
import { evaluateProbe, type ProbeRules } from './evaluate.js';
import type { ProbeOutcome } from './response.js';

const jobs = (count: number, latencyMs = 100): ProbeOutcome => ({
  kind: 'response',
  status: 200,
  latencyMs,
  body: { jobs: Array.from({ length: count }, (_, i) => ({ id: i })) },
});

const volumeRules: ProbeRules = {
  expectStatus: [200],
  slowAfterMs: 1_000,
  volume: { path: '$.jobs', thinBelow: 0.5, window: 20, minSamples: 3 },
};

const usual: HistoryEntry[] = [100, 98, 102].map((volume) => ({ verdict: 'ok', volume }));

describe('evaluateProbe', () => {
  it('stops at down: a failed request has no volume to judge', () => {
    expect(evaluateProbe({ kind: 'error', message: 'ECONNREFUSED' }, volumeRules, usual)).toEqual({
      verdict: 'down',
      reason: 'ECONNREFUSED',
      volume: null,
    });
  });

  it('stops at down on a bad status, even if the body has a list', () => {
    const outcome: ProbeOutcome = { kind: 'response', status: 500, latencyMs: 50, body: { jobs: [1] } };
    expect(evaluateProbe(outcome, volumeRules, usual)).toMatchObject({ verdict: 'down', volume: null });
  });

  it('judges plain HTTP checks by the response alone', () => {
    expect(evaluateProbe(jobs(0), { expectStatus: [200] }, [])).toEqual({
      verdict: 'ok',
      reason: 'answered 200 in 100ms',
      volume: null,
    });
  });

  it('⭐ catches the silent failure: 200 OK, fast, and nearly empty', () => {
    expect(evaluateProbe(jobs(3), volumeRules, usual)).toEqual({
      verdict: 'thin',
      reason: 'delivered 3, under 50% of the usual 100',
      volume: 3,
    });
  });

  it('is ok when the volume is usual, and says so in volume terms', () => {
    expect(evaluateProbe(jobs(97), volumeRules, usual)).toEqual({
      verdict: 'ok',
      reason: 'delivered 97, usual is 100',
      volume: 97,
    });
  });

  it('reports thin over slow when both are true', () => {
    expect(evaluateProbe(jobs(3, 5_000), volumeRules, usual).verdict).toBe('thin');
  });

  it('reports slow over learning', () => {
    expect(evaluateProbe(jobs(100, 5_000), volumeRules, []).verdict).toBe('slow');
  });

  it('is unknown while learning, but still records the volume for next time', () => {
    expect(evaluateProbe(jobs(100), volumeRules, [])).toMatchObject({ verdict: 'unknown', volume: 100 });
  });

  it('is down when the API changed shape', () => {
    const outcome: ProbeOutcome = { kind: 'response', status: 200, latencyMs: 80, body: { results: [] } };
    expect(evaluateProbe(outcome, volumeRules, usual)).toEqual({
      verdict: 'down',
      reason: 'the response has nothing at $.jobs',
      volume: null,
    });
  });
});
