import type { ProbeCheck } from '@greenlie/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closedPortUrl, startServer, type TestServer } from '../test-helpers/http-server.js';
import { runProbe } from './run-probe.js';

let server: TestServer;

beforeAll(async () => {
  server = await startServer((req, res) => {
    switch (req.url) {
      case '/jobs':
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jobs: [1, 2, 3] }));
        break;
      case '/maintenance':
        res.writeHead(200, { 'content-type': 'text/html' }).end('<h1>Back soon</h1>');
        break;
      case '/broken':
        res.writeHead(503).end('unavailable');
        break;
      case '/moved':
        res.writeHead(301, { location: '/jobs' }).end();
        break;
      case '/hang':
        break; // never answers
      case '/stall':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{"jobs": ['); // headers sent, body never finishes
        break;
      default:
        res.writeHead(200).end('ok');
    }
  });
});

afterAll(() => server.close());

const check = (path: string, overrides: Partial<ProbeCheck> = {}): ProbeCheck => ({
  type: 'json-volume',
  id: 'test',
  name: 'Test',
  url: `${server.url}${path}`,
  everyMs: 60_000,
  timeoutMs: 2_000,
  headers: {},
  confirmations: 1,
  rules: { expectStatus: [200] },
  ...overrides,
});

describe('runProbe', () => {
  it('returns status, latency and the parsed JSON body', async () => {
    const outcome = await runProbe(check('/jobs'));
    expect(outcome).toMatchObject({ kind: 'response', status: 200, body: { jobs: [1, 2, 3] } });
    expect(outcome.kind === 'response' && outcome.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('passes a body that is not JSON on as text', async () => {
    expect(await runProbe(check('/maintenance'))).toMatchObject({ status: 200, body: '<h1>Back soon</h1>' });
  });

  it('does not keep the body of a plain HTTP check', async () => {
    expect(await runProbe(check('/jobs', { type: 'http' }))).toMatchObject({ status: 200, body: null });
  });

  it('reports an error status as a response, for the core to judge', async () => {
    expect(await runProbe(check('/broken'))).toMatchObject({ kind: 'response', status: 503 });
  });

  it('follows redirects', async () => {
    expect(await runProbe(check('/moved'))).toMatchObject({ status: 200, body: { jobs: [1, 2, 3] } });
  });

  it('sends the configured headers and says who it is', async () => {
    await runProbe(check('/echo', { headers: { authorization: 'Bearer abc' } }));
    const request = server.received.at(-1);
    expect(request?.headers.authorization).toBe('Bearer abc');
    expect(request?.headers['user-agent']).toMatch(/^Greenlie\//);
  });

  it('times out a server that never answers', async () => {
    expect(await runProbe(check('/hang', { timeoutMs: 300 }))).toEqual({
      kind: 'error',
      message: 'no complete answer within 300ms',
    });
  });

  it('times out a body that never finishes, not only missing headers', async () => {
    expect(await runProbe(check('/stall', { timeoutMs: 300 }))).toEqual({
      kind: 'error',
      message: 'no complete answer within 300ms',
    });
  });

  it('names a refused connection', async () => {
    expect(await runProbe(check('', { url: await closedPortUrl() }))).toEqual({
      kind: 'error',
      message: 'connection refused',
    });
  });
});
