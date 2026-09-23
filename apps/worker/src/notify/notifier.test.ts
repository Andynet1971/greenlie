import { describe, expect, it } from 'vitest';
import type { Logger } from '../logger.js';
import type { AlertEvent, Channel } from './channel.js';
import { createNotifier } from './notifier.js';

const event: AlertEvent = {
  checkId: 'api',
  checkName: 'API',
  transition: { kind: 'failing', from: 'ok', to: 'down' },
  reason: 'connection refused',
  at: new Date('2026-09-23T08:30:00Z'),
};

function recorder() {
  const lines: { level: string; message: string; fields?: Record<string, unknown> }[] = [];
  const log: Logger = (level, message, fields) => lines.push({ level, message, ...(fields ? { fields } : {}) });
  return { lines, log };
}

const channel = (name: string, send: Channel['send']): Channel => ({ name, send });

describe('createNotifier', () => {
  it('logs every alert, even with no channel configured', async () => {
    const { lines, log } = recorder();
    await createNotifier([], log)(event);
    expect(lines).toEqual([
      { level: 'warn', message: '[Greenlie] API is DOWN', fields: { check: 'api', kind: 'failing', reason: 'connection refused' } },
    ]);
  });

  it('delivers to every channel', async () => {
    const got: string[] = [];
    const channels = ['a', 'b'].map((name) => channel(name, async (message) => void got.push(`${name}:${message.title}`)));
    await createNotifier(channels, recorder().log)(event);
    expect(got).toEqual(['a:[Greenlie] API is DOWN', 'b:[Greenlie] API is DOWN']);
  });

  it('keeps going when one channel fails, and logs which one', async () => {
    const { lines, log } = recorder();
    let delivered = false;
    const channels = [
      channel('email', async () => {
        throw new Error('SMTP 535 authentication failed');
      }),
      channel('webhook', async () => {
        delivered = true;
      }),
    ];

    await expect(createNotifier(channels, log)(event)).resolves.toBeUndefined();
    expect(delivered).toBe(true);
    expect(lines.at(-1)).toEqual({
      level: 'error',
      message: 'alert not delivered',
      fields: { channel: 'email', check: 'api', error: 'SMTP 535 authentication failed' },
    });
  });

  it('copes with a channel that throws something that is not an Error', async () => {
    const { lines, log } = recorder();
    await createNotifier([channel('odd', () => Promise.reject('nope'))], log)(event);
    expect(lines.at(-1)?.fields).toMatchObject({ error: 'nope' });
  });
});
