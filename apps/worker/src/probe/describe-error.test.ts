import { describe, expect, it } from 'vitest';
import { describeFetchError } from './describe-error.js';

const failed = (code?: string) => new TypeError('fetch failed', { cause: code ? Object.assign(new Error(code), { code }) : undefined });

describe('describeFetchError', () => {
  it('turns a timeout into a sentence with the limit', () => {
    expect(describeFetchError(new DOMException('aborted', 'TimeoutError'), 10_000)).toBe('no complete answer within 10s');
    expect(describeFetchError(new DOMException('aborted', 'AbortError'), 500)).toBe('no complete answer within 500ms');
  });

  it('digs the real reason out of "fetch failed"', () => {
    expect(describeFetchError(failed('ECONNREFUSED'), 1)).toBe('connection refused');
    expect(describeFetchError(failed('CERT_HAS_EXPIRED'), 1)).toBe('TLS certificate expired');
  });

  it('keeps an unknown code instead of losing it', () => {
    expect(describeFetchError(failed('EPROTO'), 1)).toBe('request failed (EPROTO)');
  });

  it('falls back to the message when there is no code', () => {
    expect(describeFetchError(failed(), 1)).toBe('fetch failed');
    expect(describeFetchError(new TypeError('fetch failed', { cause: 'plain string' }), 1)).toBe('fetch failed');
  });

  it('copes with something thrown that is not an Error', () => {
    expect(describeFetchError('boom', 1)).toBe('boom');
  });
});
