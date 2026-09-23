import { judgeHeartbeat, type Check, type ProbeCheck, type Verdict } from '@greenlie/core';
import type { CheckState, Run } from '@greenlie/db';
import { type ChartPoint } from './chart';

export interface OverviewRow {
  id: string;
  name: string;
  type: Check['type'];
  verdict: Verdict;
  reason: string;
  lastAt: Date | undefined;
  host: string | undefined;
  /** Oldest first, capped at the last 30 — ready to hand to `buildChart`. */
  series: ChartPoint[];
}

/**
 * One row per check for the overview page.
 *
 * `runsByCheck` must be newest-first, as `Store#latestRuns` returns them.
 * HTTP and JSON-volume checks are judged by their latest run; heartbeats
 * have no "run" to read, so they are judged live from `checkState`.
 */
export function buildOverview(
  checks: readonly Check[],
  runsByCheck: ReadonlyMap<string, readonly Run[]>,
  statesByCheck: ReadonlyMap<string, CheckState>,
  now: Date,
): OverviewRow[] {
  return checks.map((check) => buildRow(check, runsByCheck.get(check.id) ?? [], statesByCheck.get(check.id), now));
}

function buildRow(check: Check, runs: readonly Run[], state: CheckState | undefined, now: Date): OverviewRow {
  if (check.type === 'heartbeat') {
    const judgement = state
      ? judgeHeartbeat(state.lastPingAt ?? undefined, state.watchingSince, now, check.rules)
      : { verdict: 'unknown' as const, reason: 'waiting for the first ping' };
    return {
      id: check.id,
      name: check.name,
      type: check.type,
      verdict: judgement.verdict,
      reason: judgement.reason,
      lastAt: state?.lastPingAt ?? undefined,
      host: undefined,
      series: [],
    };
  }

  const latest = runs[0];
  return {
    id: check.id,
    name: check.name,
    type: check.type,
    verdict: latest?.verdict ?? 'unknown',
    reason: latest?.reason ?? 'no runs yet',
    lastAt: latest?.at,
    host: hostOf(check.url),
    series: buildSeries(check, runs),
  };
}

function buildSeries(check: ProbeCheck, runs: readonly Run[]): ChartPoint[] {
  const valueOf = check.type === 'json-volume' ? (run: Run) => run.volume : (run: Run) => run.latencyMs;
  const points: ChartPoint[] = [];
  // runs is newest-first; take the latest 30, then reverse to oldest-first for the chart.
  for (const run of [...runs.slice(0, 30)].reverse()) {
    const value = valueOf(run);
    if (value === null) continue;
    points.push({ at: run.at, value, verdict: run.verdict });
  }
  return points;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
