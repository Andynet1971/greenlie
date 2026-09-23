import { parsePath, resolvePath } from './path.js';

export type Measurement = { ok: true; volume: number } | { ok: false; error: string };

/**
 * How much a response delivered: the length of the array at `path`.
 *
 * A missing path or a non-array is an error, never a volume of zero —
 * "the API changed shape" and "the API returned nothing" are different
 * failures, and conflating them would hide the first behind the second.
 */
export function measureVolume(body: unknown, path: string): Measurement {
  const resolved = resolvePath(body, parsePath(path));
  if (!resolved.found) {
    return { ok: false, error: `the response has nothing at ${resolved.missing}` };
  }
  if (!Array.isArray(resolved.value)) {
    return { ok: false, error: `expected a list at ${path}, found ${describe(resolved.value)}` };
  }
  return { ok: true, volume: resolved.value.length };
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}
