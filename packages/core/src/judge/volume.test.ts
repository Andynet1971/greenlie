import { describe, expect, it } from 'vitest';
import type { Baseline } from './baseline.js';
import { judgeVolume } from './volume.js';

const usual = (median: number): Baseline => ({ ready: true, median, samples: 20 });

describe('judgeVolume', () => {
  it('is unknown while still learning, and says how far along it is', () => {
    expect(judgeVolume(0, { ready: false, samples: 2, needed: 5 }, 0.5)).toEqual({
      verdict: 'unknown',
      reason: 'delivered 0; still learning what is usual (2 of 5 runs)',
    });
  });

  it('is thin under the threshold', () => {
    expect(judgeVolume(12, usual(745), 0.5)).toEqual({
      verdict: 'thin',
      reason: 'delivered 12, under 50% of the usual 745',
    });
  });

  it('is ok exactly at the threshold', () => {
    expect(judgeVolume(50, usual(100), 0.5).verdict).toBe('ok');
  });

  it('is ok above it, and says what usual is', () => {
    expect(judgeVolume(740, usual(745), 0.5)).toEqual({ verdict: 'ok', reason: 'delivered 740, usual is 745' });
  });

  it('never calls an always-empty feed thin', () => {
    expect(judgeVolume(0, usual(0), 0.5).verdict).toBe('ok');
  });
});
