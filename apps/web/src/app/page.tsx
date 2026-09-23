import { isFailing } from '@greenlie/core';
import type { CheckState, Run } from '@greenlie/db';
import Link from 'next/link';
import { Sparkline } from '../components/Sparkline';
import { VerdictBadge } from '../components/VerdictBadge';
import { buildChart } from '../lib/chart';
import { buildOverview } from '../lib/overview';
import { getConfig, getStore } from '../lib/server';
import { relativeTime } from '../lib/time';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const config = await getConfig();
  const store = await getStore();
  const now = new Date();

  const runsByCheck = new Map<string, Run[]>();
  const statesByCheck = new Map<string, CheckState>();
  await Promise.all(
    config.checks.map(async (check) => {
      if (check.type === 'heartbeat') {
        const state = await store.getState(check.id);
        if (state) statesByCheck.set(check.id, state);
      } else {
        runsByCheck.set(check.id, await store.latestRuns(check.id, 30));
      }
    }),
  );

  const rows = buildOverview(config.checks, runsByCheck, statesByCheck, now);
  const failing = rows.filter((row) => isFailing(row.verdict)).length;

  return (
    <>
      <meta httpEquiv="refresh" content="60" />
      <h1>Greenlie</h1>
      <p className="tagline">Your monitoring is green. Is it lying?</p>
      <p className="summary">
        {rows.length === 0
          ? 'No checks configured yet.'
          : `${rows.length - failing} of ${rows.length} check${rows.length === 1 ? '' : 's'} ok${failing > 0 ? `, ${failing} failing` : ''}`}
      </p>
      {rows.length > 0 && (
        <ul className="check-list">
          {rows.map((row) => (
            <li key={row.id} className="check-row">
              <div className="check-row-main">
                <Link href={`/checks/${row.id}`}>{row.name}</Link>
                <VerdictBadge verdict={row.verdict} />
              </div>
              <p className="check-reason">{row.reason}</p>
              <p className="check-meta">
                {row.host ? `${row.host} · ` : ''}
                {row.lastAt ? (
                  <time dateTime={row.lastAt.toISOString()}>last run {relativeTime(row.lastAt, now)}</time>
                ) : (
                  'no runs yet'
                )}
              </p>
              {row.series.length > 0 && <Sparkline chart={buildChart(row.series)} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
