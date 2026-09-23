import {
  detectTransition,
  evaluateProbe,
  judgeHeartbeat,
  settle,
  type HeartbeatCheck,
  type ProbeCheck,
  type ProbeOutcome,
  type Verdict,
} from '@greenlie/core';
import type { Store } from '@greenlie/db';
import type { Notify } from './notify/notifier.js';

export interface CycleDeps {
  store: Store;
  notify: Notify;
  now: () => Date;
}

/** One run of an HTTP or JSON-volume check, from request to alert. */
export async function runProbeCycle(
  check: ProbeCheck,
  probe: (check: ProbeCheck) => Promise<ProbeOutcome>,
  { store, notify, now }: CycleDeps,
): Promise<Verdict> {
  const state = await store.ensureCheck(check.id, now());
  const outcome = await probe(check);
  const at = now();

  const history = check.rules.volume ? await store.baselineHistory(check.id, check.rules.volume.window) : [];
  const evaluation = evaluateProbe(outcome, check.rules, history);

  const previous = await store.recentVerdicts(check.id, check.confirmations - 1);
  await store.insertRun({
    checkId: check.id,
    at,
    verdict: evaluation.verdict,
    reason: evaluation.reason,
    status: outcome.kind === 'response' ? outcome.status : null,
    latencyMs: outcome.kind === 'response' ? outcome.latencyMs : null,
    volume: evaluation.volume,
  });

  const settled = settle([...previous, evaluation.verdict], check.confirmations);
  await announceIfChanged(check, state.announced, settled, evaluation.reason, at, { store, notify });
  return evaluation.verdict;
}

/** A heartbeat is judged from the state alone: no request, no run row. */
export async function runHeartbeatCycle(check: HeartbeatCheck, { store, notify, now }: CycleDeps): Promise<Verdict> {
  const at = now();
  const state = await store.ensureCheck(check.id, at);
  const judgement = judgeHeartbeat(state.lastPingAt ?? undefined, state.watchingSince, at, check.rules);
  await announceIfChanged(check, state.announced, judgement.verdict, judgement.reason, at, { store, notify });
  return judgement.verdict;
}

async function announceIfChanged(
  check: { id: string; name: string },
  announced: Verdict | null,
  settled: Verdict | undefined,
  reason: string,
  at: Date,
  { store, notify }: Pick<CycleDeps, 'store' | 'notify'>,
): Promise<void> {
  if (settled === undefined || settled === announced) return;

  const transition = detectTransition(announced ?? undefined, settled);
  // Alert first, record second: after a crash in between, the alert is
  // sent twice rather than never.
  if (transition) await notify({ checkId: check.id, checkName: check.name, transition, reason, at });
  await store.announce(check.id, settled, at);
}
