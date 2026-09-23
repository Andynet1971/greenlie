import type { AlertMessage, Transition } from '@greenlie/core';

export interface AlertEvent {
  checkId: string;
  checkName: string;
  transition: Transition;
  reason: string;
  at: Date;
}

/** One way of telling a human. Throws when the message did not get through. */
export interface Channel {
  name: string;
  send(message: AlertMessage, event: AlertEvent): Promise<void>;
}
