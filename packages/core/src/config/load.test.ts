import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadConfig, type LoadResult } from './load.js';

const TOKEN = 'a-long-enough-token-1';

function errorsOf(result: LoadResult): string[] {
  if (result.ok) throw new Error('expected the config to be rejected');
  return result.errors;
}

function configOf(result: LoadResult) {
  if (!result.ok) throw new Error(`expected a valid config, got: ${result.errors.join('; ')}`);
  return result.config;
}

describe('loadConfig — the example file', () => {
  it('stays valid, so the README never ships a broken example', () => {
    const text = readFileSync(new URL('../../../../greenlie.config.example.yml', import.meta.url), 'utf8');
    const env = { JOB_FEED_TOKEN: 'x', BACKUP_PING_TOKEN: TOKEN, ALERT_WEBHOOK_URL: 'https://hooks.example.com/1' };
    const config = configOf(loadConfig(text, env));

    expect(config.checks.map((c) => `${c.id}:${c.type}`)).toEqual([
      'marketing-site:http',
      'job-feed:json-volume',
      'nightly-backup:heartbeat',
    ]);
  });
});

describe('loadConfig — resolving', () => {
  it('fills in every default', () => {
    const config = configOf(loadConfig('checks: [{ id: site, type: http, url: "https://a.io" }]', {}));
    expect(config).toEqual({
      checks: [
        {
          type: 'http',
          id: 'site',
          name: 'site',
          url: 'https://a.io',
          everyMs: 300_000,
          timeoutMs: 10_000,
          headers: {},
          confirmations: 2,
          rules: { expectStatus: [200], slowAfterMs: undefined, volume: undefined },
        },
      ],
      alerts: {},
    });
  });

  it('lets a check override the defaults, and the defaults be changed', () => {
    const yaml = `
defaults: { every: 1m, timeout: 3s }
checks:
  - { id: a, type: http, url: "https://a.io" }
  - { id: b, type: http, url: "https://b.io", every: 30s, timeout: 1s, slowAfter: 500ms, expectStatus: [200, 204] }
`;
    const [a, b] = configOf(loadConfig(yaml, {})).checks;
    expect(a).toMatchObject({ everyMs: 60_000, timeoutMs: 3_000 });
    expect(b).toMatchObject({ everyMs: 30_000, timeoutMs: 1_000, rules: { slowAfterMs: 500, expectStatus: [200, 204] } });
  });

  it('shapes a json-volume check into the rules the evaluator takes', () => {
    const yaml = 'checks: [{ id: feed, name: Feed, type: json-volume, url: "https://a.io", path: $.items }]';
    expect(configOf(loadConfig(yaml, {})).checks[0]).toMatchObject({
      name: 'Feed',
      rules: { volume: { path: '$.items', thinBelow: 0.5, window: 20, minSamples: 5 } },
    });
  });

  it('shapes a heartbeat check, with the default grace', () => {
    const yaml = `checks: [{ id: job, type: heartbeat, every: 1h, token: "${TOKEN}" }]`;
    expect(configOf(loadConfig(yaml, {})).checks[0]).toEqual({
      type: 'heartbeat',
      id: 'job',
      name: 'job',
      token: TOKEN,
      rules: { everyMs: 3_600_000, graceMs: 300_000 },
    });
  });

  it('reads secrets from the environment', () => {
    const yaml = 'checks: [{ id: a, type: http, url: "https://a.io", headers: { Authorization: "Bearer ${T}" } }]';
    expect(configOf(loadConfig(yaml, { T: 'secret' })).checks[0]).toMatchObject({
      headers: { Authorization: 'Bearer secret' },
    });
  });
});

describe('loadConfig — rejecting', () => {
  it('reports broken YAML', () => {
    expect(errorsOf(loadConfig('checks: [', {}))[0]).toMatch(/^the file is not valid YAML/);
  });

  it('names every missing environment variable before validating anything', () => {
    expect(errorsOf(loadConfig('checks: [{ url: "${A}", token: "${B}" }]', {}))).toEqual([
      'environment variable A is not set',
      'environment variable B is not set',
    ]);
  });

  it('refuses a config without checks', () => {
    expect(errorsOf(loadConfig('checks: []', {}))).toEqual(['checks: add at least one check']);
  });

  it.each(['', '# only a comment\n'])('refuses an empty file in plain words: %j', (text) => {
    expect(errorsOf(loadConfig(text, {}))).toEqual(['the file is empty: add at least one check']);
  });

  it('reports a wrong top-level shape without a location', () => {
    expect(errorsOf(loadConfig('- just\n- a list', {}))).toEqual([expect.stringMatching(/^Invalid input/)]);
  });

  it('reports every problem at once, each with its location', () => {
    const yaml = `
checks:
  - { id: Bad_Id, type: http, url: "https://a.io" }
  - { id: b, type: http, url: "ftp://b.io", every: 5 minutes }
  - { id: c, type: json-volume, url: "https://c.io", path: items, thinBelow: 2 }
`;
    const errors = errorsOf(loadConfig(yaml, {}));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^checks\[0\]\.id: use lowercase letters/),
        expect.stringMatching(/^checks\[1\]\.url: /),
        expect.stringMatching(/^checks\[1\]\.every: "5 minutes" is not a duration/),
        expect.stringMatching(/^checks\[2\]\.path: "items" is not a path/),
        expect.stringMatching(/^checks\[2\]\.thinBelow: /),
      ]),
    );
    expect(errors).toHaveLength(5);
  });

  it('refuses minSamples larger than the window it is taken from', () => {
    const yaml = 'checks: [{ id: f, type: json-volume, url: "https://a.io", path: $.x, baselineWindow: 5, minSamples: 8 }]';
    expect(errorsOf(loadConfig(yaml, {}))).toEqual(['checks[0].minSamples: minSamples cannot be larger than baselineWindow']);
  });

  it('refuses a short heartbeat token', () => {
    const yaml = 'checks: [{ id: j, type: heartbeat, every: 1h, token: abc }]';
    expect(errorsOf(loadConfig(yaml, {}))[0]).toMatch(/^checks\[0\]\.token: use at least 16 characters/);
  });

  it('refuses duplicate ids', () => {
    const yaml = `
checks:
  - { id: a, type: http, url: "https://a.io" }
  - { id: a, type: http, url: "https://b.io" }
`;
    expect(errorsOf(loadConfig(yaml, {}))).toEqual(['checks[1].id: "a" is already used by another check']);
  });

  it('refuses a shared token without printing it', () => {
    const yaml = `
checks:
  - { id: a, type: heartbeat, every: 1h, token: "${TOKEN}" }
  - { id: b, type: http, url: "https://b.io" }
  - { id: c, type: heartbeat, every: 1h, token: "${TOKEN}" }
`;
    const errors = errorsOf(loadConfig(yaml, {}));
    expect(errors).toEqual(['checks[2].token: this token is already used by another check']);
    expect(errors.join()).not.toContain(TOKEN);
  });

  it('refuses an unknown check type', () => {
    expect(errorsOf(loadConfig('checks: [{ id: a, type: ping }]', {}))[0]).toMatch(/^checks\[0\]\.type: /);
  });

  it('refuses a bad alert address', () => {
    const yaml = 'checks: [{ id: a, type: http, url: "https://a.io" }]\nalerts: { email: { from: nope, to: [] } }';
    const errors = errorsOf(loadConfig(yaml, {}));
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/^alerts\.email\.from: /), expect.stringMatching(/^alerts\.email\.to: /)]),
    );
  });
});
