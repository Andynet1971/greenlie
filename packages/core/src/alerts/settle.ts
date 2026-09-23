import { VERDICTS, isFailing, severity, type Verdict } from '../verdict.js';

/**
 * One bad run is a blip; `confirmations` bad runs in a row are a problem.
 * Returns the verdict worth acting on, or undefined while the picture is mixed.
 *
 * - the last runs all agree → that verdict
 * - all failing, but in different ways → the most severe one, so a service
 *   flapping between `thin` and `down` settles on `down` instead of
 *   sending a "changed" alert on every run
 * - all healthy (`ok` and `unknown` mixed) → the latest
 * - healthy and failing mixed → undefined: wait and see
 *
 * `recent` is oldest first and includes the run just made.
 */
export function settle(recent: readonly Verdict[], confirmations: number): Verdict | undefined {
  const last = recent.slice(-confirmations);
  if (last.length < confirmations) return undefined;

  if (last.every(isFailing)) {
    return last.reduce((worst, v) => (severity(v) > severity(worst) ? v : worst), VERDICTS[0]);
  }
  if (last.some(isFailing)) return undefined;
  return last.at(-1);
}
