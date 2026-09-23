import type { ProbeCheck, ProbeOutcome } from '@greenlie/core';
import { describeFetchError } from './describe-error.js';

const USER_AGENT = 'Greenlie/0.1 (+https://github.com/Andynet1971/greenlie)';

/**
 * The only place that touches the network. Everything it learns goes into
 * a plain `ProbeOutcome`; deciding what that means is the core's job.
 *
 * The timeout covers the body as well as the headers, and latency is measured
 * to the last byte: a server that sends headers fast and then stalls is slow.
 */
export async function runProbe(check: ProbeCheck): Promise<ProbeOutcome> {
  const started = performance.now();
  try {
    const response = await fetch(check.url, {
      headers: { 'user-agent': USER_AGENT, ...check.headers },
      signal: AbortSignal.timeout(check.timeoutMs),
      redirect: 'follow',
    });
    const text = await response.text();
    const latencyMs = Math.round(performance.now() - started);
    return { kind: 'response', status: response.status, latencyMs, body: check.type === 'json-volume' ? parseJson(text) : null };
  } catch (error) {
    return { kind: 'error', message: describeFetchError(error, check.timeoutMs) };
  }
}

/** Unparseable text is passed on as text; the core reports it as "not JSON". */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
