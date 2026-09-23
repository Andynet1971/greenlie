import { measureVolume } from '../volume/measure.js';
import { worst, type Judgement } from '../verdict.js';
import { computeBaseline, type BaselineRules, type HistoryEntry } from './baseline.js';
import { judgeResponse, type ProbeOutcome, type ResponseRules } from './response.js';
import { judgeVolume } from './volume.js';

export interface VolumeRules extends BaselineRules {
  path: string;
  thinBelow: number;
}

export interface ProbeRules extends ResponseRules {
  /** Present only on `json-volume` checks. */
  volume?: VolumeRules | undefined;
}

export interface Evaluation extends Judgement {
  /** Stored with the run, so it can feed the next baseline. */
  volume: number | null;
}

/** The whole decision for one HTTP or JSON-volume run. */
export function evaluateProbe(
  outcome: ProbeOutcome,
  rules: ProbeRules,
  history: readonly HistoryEntry[],
): Evaluation {
  const response = judgeResponse(outcome, rules);
  if (response.verdict === 'down' || outcome.kind === 'error' || !rules.volume) {
    return { ...response, volume: null };
  }

  const measured = measureVolume(outcome.body, rules.volume.path);
  if (!measured.ok) {
    return { verdict: 'down', reason: measured.error, volume: null };
  }

  const baseline = computeBaseline(history, rules.volume);
  const volume = judgeVolume(measured.volume, baseline, rules.volume.thinBelow);
  return { ...worst(response, volume), volume: measured.volume };
}
