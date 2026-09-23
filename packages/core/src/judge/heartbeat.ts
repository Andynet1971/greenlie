import { formatDuration } from '../duration.js';
import type { Judgement } from '../verdict.js';

export interface HeartbeatRules {
  everyMs: number;
  graceMs: number;
}

/**
 * A heartbeat check is judged by silence: the job pings Greenlie, and
 * Greenlie complains when a ping is overdue.
 *
 * `watchingSince` is when Greenlie started expecting pings. Before the
 * first ping arrives the deadline counts from there, so a job that has
 * never run still turns `stale` instead of staying `unknown` forever.
 */
export function judgeHeartbeat(
  lastPingAt: Date | undefined,
  watchingSince: Date,
  now: Date,
  rules: HeartbeatRules,
): Judgement {
  const from = lastPingAt ?? watchingSince;
  const silence = now.getTime() - from.getTime();

  if (silence > rules.everyMs + rules.graceMs) {
    const since = lastPingAt ? `no ping for ${formatDuration(silence)}` : `no ping yet after ${formatDuration(silence)}`;
    return { verdict: 'stale', reason: `${since}, expected every ${formatDuration(rules.everyMs)}` };
  }
  if (!lastPingAt) {
    return { verdict: 'unknown', reason: 'waiting for the first ping' };
  }
  return { verdict: 'ok', reason: `last ping ${formatDuration(silence)} ago` };
}
