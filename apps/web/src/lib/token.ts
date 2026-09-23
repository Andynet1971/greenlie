import { createHash, timingSafeEqual } from 'node:crypto';
import type { Check, HeartbeatCheck } from '@greenlie/core';

const hash = (token: string): Buffer => createHash('sha256').update(token).digest();

/**
 * Finds the heartbeat check whose token matches, without a timing side
 * channel: every check is compared (no early return on match), and each
 * comparison is a fixed-length, constant-time digest compare.
 */
export function findHeartbeatByToken(checks: readonly Check[], token: string): HeartbeatCheck | undefined {
  const candidate = hash(token);
  let found: HeartbeatCheck | undefined;
  for (const check of checks) {
    if (check.type !== 'heartbeat') continue;
    const stored = hash(check.token);
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
      found = check;
    }
  }
  return found;
}
