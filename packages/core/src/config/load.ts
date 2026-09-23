import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import type { HeartbeatRules } from '../judge/heartbeat.js';
import type { ProbeRules } from '../judge/evaluate.js';
import { interpolate, type Env } from './interpolate.js';
import { configSchema, type RawConfig } from './schema.js';

export interface ProbeCheck {
  type: 'http' | 'json-volume';
  id: string;
  name: string;
  url: string;
  everyMs: number;
  timeoutMs: number;
  headers: Readonly<Record<string, string>>;
  confirmations: number;
  rules: ProbeRules;
}

export interface HeartbeatCheck {
  type: 'heartbeat';
  id: string;
  name: string;
  token: string;
  /** No confirmations here: the grace period already is one. */
  rules: HeartbeatRules;
}

export type Check = ProbeCheck | HeartbeatCheck;

export interface GreenlieConfig {
  checks: Check[];
  alerts: RawConfig['alerts'];
}

export type LoadResult = { ok: true; config: GreenlieConfig } | { ok: false; errors: string[] };

/**
 * YAML text in, a fully resolved config out — or every problem at once,
 * each one pointing at where it is, so nobody fixes them one restart at a time.
 */
export function loadConfig(text: string, env: Env): LoadResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    return { ok: false, errors: [`the file is not valid YAML: ${(error as Error).message}`] };
  }
  if (parsed === null || parsed === undefined) {
    return { ok: false, errors: ['the file is empty: add at least one check'] };
  }

  const { value, missing } = interpolate(parsed, env);
  if (missing.length > 0) {
    return { ok: false, errors: missing.map((name) => `environment variable ${name} is not set`) };
  }

  const result = configSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, errors: formatIssues(result.error.issues) };
  }
  return { ok: true, config: resolve(result.data) };
}

function resolve(raw: RawConfig): GreenlieConfig {
  const checks = raw.checks.map((check): Check => {
    const name = check.name ?? check.id;
    if (check.type === 'heartbeat') {
      return {
        type: 'heartbeat',
        id: check.id,
        name,
        token: check.token,
        rules: { everyMs: check.every, graceMs: check.grace },
      };
    }
    return {
      type: check.type,
      id: check.id,
      name,
      url: check.url,
      everyMs: check.every ?? raw.defaults.every,
      timeoutMs: check.timeout ?? raw.defaults.timeout,
      headers: check.headers ?? {},
      confirmations: check.confirmations,
      rules: {
        expectStatus: check.expectStatus,
        slowAfterMs: check.slowAfter,
        volume:
          check.type === 'json-volume'
            ? { path: check.path, thinBelow: check.thinBelow, window: check.baselineWindow, minSamples: check.minSamples }
            : undefined,
      },
    };
  });
  return { checks, alerts: raw.alerts };
}

/** `checks[2].url: Invalid URL` — the location first, then the problem. */
export function formatIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const where = issue.path.reduce<string>(
      (text, key) => (typeof key === 'number' ? `${text}[${key}]` : `${text}${text ? '.' : ''}${String(key)}`),
      '',
    );
    return where ? `${where}: ${issue.message}` : issue.message;
  });
}
