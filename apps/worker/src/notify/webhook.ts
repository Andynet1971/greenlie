import type { Channel } from './channel.js';

/**
 * A generic JSON POST: Slack, Discord, ntfy, Zapier or a script of your own
 * can all take it, so no integration needs to be built for each of them.
 */
export function webhookChannel(url: string, timeoutMs = 10_000): Channel {
  return {
    name: 'webhook',
    async send(message, event) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          title: message.title,
          text: message.body,
          check: { id: event.checkId, name: event.checkName },
          kind: event.transition.kind,
          from: event.transition.from ?? null,
          to: event.transition.to,
          reason: event.reason,
          at: event.at.toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error(`webhook answered ${response.status}`);
      }
    },
  };
}
