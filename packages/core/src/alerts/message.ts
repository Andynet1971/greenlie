import type { Transition } from './transition.js';

export interface AlertMessage {
  /** Short enough for an email subject or a chat notification. */
  title: string;
  body: string;
}

export interface AlertContext {
  checkName: string;
  transition: Transition;
  reason: string;
  at: Date;
}

export function composeAlert({ checkName, transition, reason, at }: AlertContext): AlertMessage {
  const { kind, from, to } = transition;
  const title =
    kind === 'recovered'
      ? `[Greenlie] ${checkName} recovered (was ${from})`
      : `[Greenlie] ${checkName} is ${to.toUpperCase()}`;

  const lines = [`${checkName}: ${reason}.`];
  if (kind === 'changed') lines.push(`It was ${from} before.`);
  lines.push(`At ${at.toISOString()}.`);
  return { title, body: lines.join('\n') };
}
