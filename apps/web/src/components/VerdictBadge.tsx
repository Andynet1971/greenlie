import type { Verdict } from '@greenlie/core';

const LABEL: Record<Verdict, string> = {
  ok: 'OK',
  unknown: 'Unknown',
  slow: 'Slow',
  thin: 'Thin',
  stale: 'Stale',
  down: 'Down',
};

/** The color is never the only signal: the verdict is always spelled out too. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict-badge verdict-${verdict}`}>{LABEL[verdict]}</span>;
}
