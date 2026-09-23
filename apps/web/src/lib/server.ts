import { readFileSync } from 'node:fs';
import { loadConfig, type GreenlieConfig } from '@greenlie/core';
import { connect, createStore, type Database, type Store } from '@greenlie/db';

interface Context {
  config: GreenlieConfig;
  store: Store;
  db: Database;
}

declare global {
  var __greenlieContext: Promise<Context> | undefined;
}

function readConfig(): GreenlieConfig {
  const path = process.env.GREENLIE_CONFIG ?? 'greenlie.config.yml';
  let text: string;
  try {
    // The config path comes from an env var, so the bundler can't know it statically;
    // it genuinely only needs this one file, not the whole project traced with it.
    text = readFileSync(/* turbopackIgnore: true */ path, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${path}: ${(error as Error).message}`, { cause: error });
  }
  const result = loadConfig(text, process.env);
  if (!result.ok) {
    throw new Error(`invalid ${path}:\n${result.errors.join('\n')}`);
  }
  return result.config;
}

async function setup(): Promise<Context> {
  const config = readConfig();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const connection = await connect(databaseUrl);
  return { config, store: createStore(connection.db), db: connection.db };
}

/** The only I/O boundary in the web app: reads the config once, one cached connection. */
function context(): Promise<Context> {
  globalThis.__greenlieContext ??= setup();
  return globalThis.__greenlieContext;
}

export async function getConfig(): Promise<GreenlieConfig> {
  return (await context()).config;
}

export async function getStore(): Promise<Store> {
  return (await context()).store;
}

export async function getDb(): Promise<Database> {
  return (await context()).db;
}
