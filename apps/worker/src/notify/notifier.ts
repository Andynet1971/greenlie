import { composeAlert } from '@greenlie/core';
import type { Logger } from '../logger.js';
import type { AlertEvent, Channel } from './channel.js';

export type Notify = (event: AlertEvent) => Promise<void>;

/**
 * Sends to every channel at once and never throws: a broken SMTP server
 * must not stop the webhook, and must not stop the monitoring either.
 * Every alert is logged, so it exists somewhere even when no channel works.
 */
export function createNotifier(channels: readonly Channel[], log: Logger): Notify {
  return async (event) => {
    const message = composeAlert(event);
    log('warn', message.title, { check: event.checkId, kind: event.transition.kind, reason: event.reason });

    const results = await Promise.allSettled(channels.map((channel) => channel.send(message, event)));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        log('error', 'alert not delivered', {
          channel: channels[i]?.name,
          check: event.checkId,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  };
}
