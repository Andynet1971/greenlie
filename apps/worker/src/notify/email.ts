import type { Channel } from './channel.js';

/** The one method of a nodemailer transport this channel uses. */
export interface MailTransport {
  sendMail(mail: { from: string; to: string[]; subject: string; text: string }): Promise<unknown>;
}

export function emailChannel(transport: MailTransport, from: string, to: readonly string[]): Channel {
  return {
    name: 'email',
    async send(message) {
      await transport.sendMail({ from, to: [...to], subject: message.title, text: message.body });
    },
  };
}
