import { readFileSync } from 'node:fs';
import { loadConfig } from '@greenlie/core';
import { connect, createStore } from '@greenlie/db';
import nodemailer from 'nodemailer';
import { readWorkerEnv } from './env.js';
import { createLogger } from './logger.js';
import type { Channel } from './notify/channel.js';
import { emailChannel } from './notify/email.js';
import { createNotifier } from './notify/notifier.js';
import { webhookChannel } from './notify/webhook.js';
import { startScheduler } from './scheduler.js';
import { buildTasks } from './tasks.js';

const log = createLogger();

function fail(message: string, errors: readonly string[]): never {
  log('error', message, { errors });
  process.exit(1);
}

const envResult = readWorkerEnv(process.env);
if (!envResult.ok) fail('invalid environment', envResult.errors);
const env = envResult.env;

let text: string;
try {
  text = readFileSync(env.configPath, 'utf8');
} catch (error) {
  fail(`cannot read ${env.configPath}`, [(error as Error).message]);
}

const loaded = loadConfig(text, process.env);
if (!loaded.ok) fail(`invalid ${env.configPath}`, loaded.errors);
const config = loaded.config;

const channels: Channel[] = [];
if (config.alerts.webhook) channels.push(webhookChannel(config.alerts.webhook.url));
if (config.alerts.email) {
  if (!env.smtpUrl) fail('invalid environment', ['alerts.email is configured but SMTP_URL is not set']);
  channels.push(emailChannel(nodemailer.createTransport(env.smtpUrl), config.alerts.email.from, config.alerts.email.to));
}

const connection = await connect(env.databaseUrl);
const store = createStore(connection.db);
const deps = { store, notify: createNotifier(channels, log), now: () => new Date(), log, retentionMs: env.retentionMs };
const scheduler = startScheduler(buildTasks(config, deps), { log });

log('info', 'greenlie worker started', {
  checks: config.checks.length,
  channels: channels.map((c) => c.name),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log('info', 'shutting down', { signal });
    void scheduler
      .stop()
      .then(() => connection.close())
      .then(() => process.exit(0));
  });
}
