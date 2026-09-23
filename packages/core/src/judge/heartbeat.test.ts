import { describe, expect, it } from 'vitest';
import { judgeHeartbeat } from './heartbeat.js';

const HOUR = 3_600_000;
const rules = { everyMs: 24 * HOUR, graceMs: HOUR / 2 };
const at = (hours: number) => new Date(Date.UTC(2026, 8, 23) + hours * HOUR);

describe('judgeHeartbeat', () => {
  it('waits for the first ping without complaining', () => {
    expect(judgeHeartbeat(undefined, at(0), at(3), rules)).toEqual({
      verdict: 'unknown',
      reason: 'waiting for the first ping',
    });
  });

  it('turns stale when the first ping never comes', () => {
    expect(judgeHeartbeat(undefined, at(0), at(25), rules)).toEqual({
      verdict: 'stale',
      reason: 'no ping yet after 1d 1h, expected every 1d',
    });
  });

  it('is ok while the last ping is recent', () => {
    expect(judgeHeartbeat(at(0), at(-100), at(2), rules)).toEqual({ verdict: 'ok', reason: 'last ping 2h ago' });
  });

  it('is still ok inside the grace period', () => {
    expect(judgeHeartbeat(at(0), at(-100), at(24.5), rules).verdict).toBe('ok');
  });

  it('is stale once the grace period is over', () => {
    expect(judgeHeartbeat(at(0), at(-100), at(26), rules)).toEqual({
      verdict: 'stale',
      reason: 'no ping for 1d 2h, expected every 1d',
    });
  });
});
