import { formatDuration } from '../duration.js';
import type { Judgement } from '../verdict.js';

/** What the worker saw. Pure data: all the I/O happened before this point. */
export type ProbeOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'response'; status: number; latencyMs: number; body: unknown };

export interface ResponseRules {
  expectStatus: readonly number[];
  slowAfterMs?: number | undefined;
}

export function judgeResponse(outcome: ProbeOutcome, rules: ResponseRules): Judgement {
  if (outcome.kind === 'error') {
    return { verdict: 'down', reason: outcome.message };
  }
  if (!rules.expectStatus.includes(outcome.status)) {
    return {
      verdict: 'down',
      reason: `answered ${outcome.status}, expected ${rules.expectStatus.join(' or ')}`,
    };
  }
  if (rules.slowAfterMs !== undefined && outcome.latencyMs > rules.slowAfterMs) {
    return {
      verdict: 'slow',
      reason: `answered in ${formatDuration(outcome.latencyMs)}, slower than ${formatDuration(rules.slowAfterMs)}`,
    };
  }
  return { verdict: 'ok', reason: `answered ${outcome.status} in ${formatDuration(outcome.latencyMs)}` };
}
