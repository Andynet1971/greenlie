import { isFailing, type Verdict } from '../verdict.js';

export type TransitionKind = 'failing' | 'recovered' | 'changed';

export interface Transition {
  kind: TransitionKind;
  from: Verdict | undefined;
  to: Verdict;
}

/**
 * Alerts fire on changes, never on every run: a check that has been down
 * for a day sends one message, not 288.
 *
 * `previous` is undefined for the very first run of a check. Starting out
 * healthy is not news; starting out broken is.
 */
export function detectTransition(previous: Verdict | undefined, current: Verdict): Transition | null {
  const wasFailing = previous !== undefined && isFailing(previous);
  const nowFailing = isFailing(current);

  if (nowFailing && !wasFailing) return { kind: 'failing', from: previous, to: current };
  if (!nowFailing && wasFailing) return { kind: 'recovered', from: previous, to: current };
  if (nowFailing && previous !== current) return { kind: 'changed', from: previous, to: current };
  return null;
}
