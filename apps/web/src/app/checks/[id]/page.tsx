import { computeBaseline, formatDuration, judgeHeartbeat } from '@greenlie/core';
import type { Run } from '@greenlie/db';
import { notFound } from 'next/navigation';
import { Chart } from '../../../components/Chart';
import { VerdictBadge } from '../../../components/VerdictBadge';
import { buildChart, type ChartPoint } from '../../../lib/chart';
import { getConfig, getStore } from '../../../lib/server';
import { relativeTime } from '../../../lib/time';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CheckDetailPage({ params }: PageProps) {
  const { id } = await params;
  const config = await getConfig();
  const check = config.checks.find((candidate) => candidate.id === id);
  if (!check) notFound();

  const store = await getStore();
  const now = new Date();
  const runs = await store.latestRuns(check.id, 50);

  if (check.type === 'heartbeat') {
    const state = await store.getState(check.id);
    const judgement = state
      ? judgeHeartbeat(state.lastPingAt ?? undefined, state.watchingSince, now, check.rules)
      : { verdict: 'unknown' as const, reason: 'waiting for the first ping' };

    return (
      <>
        <h1>{check.name}</h1>
        <VerdictBadge verdict={judgement.verdict} />
        <p className="reason">{judgement.reason}</p>
        <dl className="settings">
          <div>
            <dt>Expected every</dt>
            <dd>{formatDuration(check.rules.everyMs)}</dd>
          </div>
          <div>
            <dt>Grace period</dt>
            <dd>{formatDuration(check.rules.graceMs)}</dd>
          </div>
        </dl>
        <RunsTable runs={runs} now={now} />
      </>
    );
  }

  const latest = runs[0];
  const verdict = latest?.verdict ?? 'unknown';
  const reason = latest?.reason ?? 'no runs yet';

  let threshold: number | undefined;
  let points: ChartPoint[];
  let metric: 'Volume' | 'Latency';

  if (check.type === 'json-volume') {
    const volumeRules = check.rules.volume;
    if (!volumeRules) throw new Error(`check "${check.id}" is json-volume but has no volume rules`);
    const history = await store.baselineHistory(check.id, volumeRules.window);
    const baseline = computeBaseline(history, volumeRules);
    threshold = baseline.ready ? baseline.median * volumeRules.thinBelow : undefined;
    points = pointsFrom(runs, (run) => run.volume);
    metric = 'Volume';
  } else {
    threshold = check.rules.slowAfterMs;
    points = pointsFrom(runs, (run) => run.latencyMs);
    metric = 'Latency';
  }

  const chart = buildChart(points, threshold);

  return (
    <>
      <h1>{check.name}</h1>
      <VerdictBadge verdict={verdict} />
      <p className="reason">{reason}</p>
      <dl className="settings">
        <div>
          <dt>Runs every</dt>
          <dd>{formatDuration(check.everyMs)}</dd>
        </div>
        <div>
          <dt>Confirmations</dt>
          <dd>{check.confirmations}</dd>
        </div>
        {check.type === 'json-volume' && check.rules.volume && (
          <div>
            <dt>Thin below</dt>
            <dd>{Math.round(check.rules.volume.thinBelow * 100)}% of usual</dd>
          </div>
        )}
        {check.type === 'http' && check.rules.slowAfterMs !== undefined && (
          <div>
            <dt>Slow after</dt>
            <dd>{formatDuration(check.rules.slowAfterMs)}</dd>
          </div>
        )}
      </dl>
      {chart.points.length > 0 && (
        <Chart chart={chart} title={`${metric} over the last ${chart.points.length} runs`} label={`${metric} chart: ${reason}`} />
      )}
      <RunsTable runs={runs} now={now} />
    </>
  );
}

function pointsFrom(runs: readonly Run[], valueOf: (run: Run) => number | null): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const run of [...runs].reverse()) {
    const value = valueOf(run);
    if (value === null) continue;
    points.push({ at: run.at, value, verdict: run.verdict });
  }
  return points;
}

function RunsTable({ runs, now }: { runs: readonly Run[]; now: Date }) {
  if (runs.length === 0) return <p>No runs yet.</p>;
  return (
    <table className="runs-table">
      <caption>Last {runs.length} runs</caption>
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Verdict</th>
          <th scope="col">Reason</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>
              <time dateTime={run.at.toISOString()}>{relativeTime(run.at, now)}</time>
            </td>
            <td>
              <VerdictBadge verdict={run.verdict} />
            </td>
            <td>{run.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
