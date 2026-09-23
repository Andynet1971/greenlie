import { describe, expect, it } from 'vitest';
import { judgeResponse, type ProbeOutcome } from './response.js';

const answered = (status: number, latencyMs = 120): ProbeOutcome => ({ kind: 'response', status, latencyMs, body: null });

describe('judgeResponse', () => {
  const rules = { expectStatus: [200], slowAfterMs: 2_000 };

  it('is down on a network error, with the error as the reason', () => {
    expect(judgeResponse({ kind: 'error', message: 'timed out after 10s' }, rules)).toEqual({
      verdict: 'down',
      reason: 'timed out after 10s',
    });
  });

  it('is down on an unexpected status', () => {
    expect(judgeResponse(answered(503), rules)).toEqual({ verdict: 'down', reason: 'answered 503, expected 200' });
  });

  it('lists every accepted status in the reason', () => {
    expect(judgeResponse(answered(500), { expectStatus: [200, 204] }).reason).toBe('answered 500, expected 200 or 204');
  });

  it('is slow past the latency threshold', () => {
    expect(judgeResponse(answered(200, 3_500), rules)).toEqual({
      verdict: 'slow',
      reason: 'answered in 4s, slower than 2s',
    });
  });

  it('is ok exactly at the threshold', () => {
    expect(judgeResponse(answered(200, 2_000), rules).verdict).toBe('ok');
  });

  it('never calls anything slow without a threshold', () => {
    expect(judgeResponse(answered(200, 60_000), { expectStatus: [200] })).toEqual({
      verdict: 'ok',
      reason: 'answered 200 in 1m',
    });
  });
});
