import { parseDuration, type Env } from '@greenlie/core';

export interface WorkerEnv {
  configPath: string;
  databaseUrl: string;
  smtpUrl: string | undefined;
  retentionMs: number;
}

export type EnvResult = { ok: true; env: WorkerEnv } | { ok: false; errors: string[] };

/** All the worker reads from the environment, checked in one place. */
export function readWorkerEnv(env: Env): EnvResult {
  const errors: string[] = [];

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) errors.push('DATABASE_URL is not set');

  let retentionMs = 30 * 86_400_000;
  if (env.GREENLIE_RETENTION) {
    try {
      retentionMs = parseDuration(env.GREENLIE_RETENTION);
    } catch (error) {
      errors.push(`GREENLIE_RETENTION: ${(error as Error).message}`);
    }
  }

  if (errors.length > 0 || !databaseUrl) return { ok: false, errors };
  return {
    ok: true,
    env: {
      configPath: env.GREENLIE_CONFIG ?? 'greenlie.config.yml',
      databaseUrl,
      smtpUrl: env.SMTP_URL || undefined,
      retentionMs,
    },
  };
}
