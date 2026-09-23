import type { Judgement } from '../verdict.js';
import type { Baseline } from './baseline.js';

/**
 * `thin`: the service answered, successfully, with much less than usual.
 * `thinBelow` is a fraction of the median — 0.5 means "under half".
 */
export function judgeVolume(volume: number, baseline: Baseline, thinBelow: number): Judgement {
  if (!baseline.ready) {
    return {
      verdict: 'unknown',
      reason: `delivered ${volume}; still learning what is usual (${baseline.samples} of ${baseline.needed} runs)`,
    };
  }

  const threshold = baseline.median * thinBelow;
  if (volume < threshold) {
    return {
      verdict: 'thin',
      reason: `delivered ${volume}, under ${Math.round(thinBelow * 100)}% of the usual ${baseline.median}`,
    };
  }
  return { verdict: 'ok', reason: `delivered ${volume}, usual is ${baseline.median}` };
}
