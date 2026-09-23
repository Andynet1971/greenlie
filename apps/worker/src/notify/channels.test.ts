import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer, type TestServer } from '../test-helpers/http-server.js';
import type { AlertEvent } from './channel.js';
import { emailChannel } from './email.js';
import { webhookChannel } from './webhook.js';

const event: AlertEvent = {
  checkId: 'job-feed',
  checkName: 'Job feed',
  transition: { kind: 'failing', from: 'ok', to: 'thin' },
  reason: 'delivered 3, under 50% of the usual 100',
  at: new Date('2026-09-23T08:30:00Z'),
};
const message = { title: '[Greenlie] Job feed is THIN', body: 'details' };

let server: TestServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('webhookChannel', () => {
  it('POSTs one JSON document with everything a receiver needs', async () => {
    server = await startServer((_req, res) => res.writeHead(204).end());
    await webhookChannel(server.url).send(message, event);

    const [request] = server.received;
    expect(request?.method).toBe('POST');
    expect(request?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request?.body ?? '')).toEqual({
      title: '[Greenlie] Job feed is THIN',
      text: 'details',
      check: { id: 'job-feed', name: 'Job feed' },
      kind: 'failing',
      from: 'ok',
      to: 'thin',
      reason: 'delivered 3, under 50% of the usual 100',
      at: '2026-09-23T08:30:00.000Z',
    });
  });

  it('sends null, not a missing field, when there was no previous state', async () => {
    server = await startServer((_req, res) => res.writeHead(200).end());
    await webhookChannel(server.url).send(message, { ...event, transition: { kind: 'failing', from: undefined, to: 'down' } });
    expect(JSON.parse(server.received[0]?.body ?? '')).toMatchObject({ from: null, to: 'down' });
  });

  it('fails loudly when the receiver refuses', async () => {
    server = await startServer((_req, res) => res.writeHead(500).end());
    await expect(webhookChannel(server.url).send(message, event)).rejects.toThrow('webhook answered 500');
  });

  it('gives up on a receiver that hangs', async () => {
    server = await startServer(() => undefined);
    await expect(webhookChannel(server.url, 200).send(message, event)).rejects.toThrow();
  });
});

describe('emailChannel', () => {
  it('sends the title as subject and the body as text', async () => {
    // The only stand-in in the worker tests: an SMTP server is out of scope.
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };
    await emailChannel(transport, 'greenlie@example.com', ['a@example.com', 'b@example.com']).send(message, event);
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'greenlie@example.com',
      to: ['a@example.com', 'b@example.com'],
      subject: '[Greenlie] Job feed is THIN',
      text: 'details',
    });
  });
});
