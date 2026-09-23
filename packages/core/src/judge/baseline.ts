import { median } from '../median.js';
import type { Verdict } from '../verdict.js';

/** One past run of the same check, oldest first. */
export interface HistoryEntry {
  verdict: Verdict;
  volume: number | null;
}

export interface BaselineRules {
  /** How many recent healthy runs the median looks at. */
  window: number;
  /** Below this many, there is no baseline yet and `thin` cannot fire. */
  minSamples: number;
}

export type Baseline =
  | { ready: true; median: number; samples: number }
  | { ready: false; samples: number; needed: number };

/**
 * Runs that were `thin` or `down` never enter the baseline.
 *
 * Otherwise a service that stays broken long enough would drag the median
 * down until "broken" became "usual" and the alarm switched itself off —
 * the silent failure this project exists to catch.
 */
const HEALTHY: ReadonlySet<Verdict> = new Set(['ok', 'unknown', 'slow']);

export function computeBaseline(history: readonly HistoryEntry[], rules: BaselineRules): Baseline {
  const volumes = history
    .filter((entry) => HEALTHY.has(entry.verdict) && entry.volume !== null)
    .map((entry) => entry.volume as number)
    .slice(-rules.window);

  const value = median(volumes);
  if (value === undefined || volumes.length < rules.minSamples) {
    return { ready: false, samples: volumes.length, needed: rules.minSamples };
  }
  return { ready: true, median: value, samples: volumes.length };
}
