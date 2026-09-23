/**
 * Every check ends in exactly one verdict. The list is ordered by severity:
 * when two judgements disagree, the one further down the list wins.
 */
export const VERDICTS = ['ok', 'unknown', 'slow', 'thin', 'stale', 'down'] as const;

export type Verdict = (typeof VERDICTS)[number];

export interface Judgement {
  verdict: Verdict;
  /** One human sentence that explains the verdict — it ends up in the alert. */
  reason: string;
}

const FAILING: ReadonlySet<Verdict> = new Set(['slow', 'thin', 'stale', 'down']);

/** `ok` and `unknown` are the only verdicts nobody needs to be told about. */
export function isFailing(verdict: Verdict): boolean {
  return FAILING.has(verdict);
}

export function severity(verdict: Verdict): number {
  return VERDICTS.indexOf(verdict);
}

/** The more severe of two judgements; on a tie the first one is kept. */
export function worst(a: Judgement, b: Judgement): Judgement {
  return severity(b.verdict) > severity(a.verdict) ? b : a;
}
