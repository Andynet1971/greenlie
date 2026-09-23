import { formatDuration } from '@greenlie/core';

const CODES: Readonly<Record<string, string>> = {
  ENOTFOUND: 'host not found',
  EAI_AGAIN: 'DNS lookup failed',
  ECONNREFUSED: 'connection refused',
  ECONNRESET: 'connection reset',
  EHOSTUNREACH: 'host unreachable',
  CERT_HAS_EXPIRED: 'TLS certificate expired',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'self-signed TLS certificate',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certificate does not match the host',
};

/**
 * `fetch` fails with "TypeError: fetch failed" and hides the real reason in
 * `cause`. The alert needs the real reason: "connection refused" and
 * "certificate expired" call for very different fixes.
 */
export function describeFetchError(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return `no complete answer within ${formatDuration(timeoutMs)}`;
  }

  const cause: unknown = error.cause;
  const code = cause !== null && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
  if (code) return CODES[code] ?? `request failed (${code})`;
  return error.message;
}
