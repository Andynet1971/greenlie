import { describe, expect, it } from 'vitest';
import type { Verdict } from '../verdict.js';
import { computeBaseline, type HistoryEntry } from './baseline.js';

const run = (volume: number | null, verdict: Verdict = 'ok'): HistoryEntry => ({ verdict, volume });
const rules = { window: 5, minSamples: 3 };

describe('computeBaseline', () => {
  it('is not ready with no history', () => {
    expect(computeBaseline([], rules)).toEqual({ ready: false, samples: 0, needed: 3 });
  });

  it('is not ready below minSamples', () => {
    expect(computeBaseline([run(10), run(12)], rules)).toEqual({ ready: false, samples: 2, needed: 3 });
  });

  it('is the median of the healthy runs once there are enough', () => {
    expect(computeBaseline([run(10), run(30), run(20)], rules)).toEqual({ ready: true, median: 20, samples: 3 });
  });

  it('only looks at the most recent window', () => {
    const history = [run(1000), run(1000), run(10), run(10), run(10), run(10), run(10)];
    expect(computeBaseline(history, rules)).toEqual({ ready: true, median: 10, samples: 5 });
  });

  it('counts learning and slow runs as healthy', () => {
    const history = [run(10, 'unknown'), run(10, 'slow'), run(10, 'ok')];
    expect(computeBaseline(history, rules)).toMatchObject({ ready: true, samples: 3 });
  });

  it('skips runs without a volume', () => {
    expect(computeBaseline([run(10), run(null), run(10)], rules)).toMatchObject({ ready: false, samples: 2 });
  });

  it('never lets a long outage become the new normal', () => {
    // Twenty thin runs in a row must not drag "usual" down to 3.
    const history = [run(100), run(100), run(100), ...Array.from({ length: 20 }, () => run(3, 'thin'))];
    expect(computeBaseline(history, rules)).toEqual({ ready: true, median: 100, samples: 3 });
  });

  it('ignores down runs as well', () => {
    const history = [run(100), run(100), run(100), run(0, 'down'), run(0, 'down'), run(0, 'down')];
    expect(computeBaseline(history, rules)).toMatchObject({ median: 100 });
  });
});
