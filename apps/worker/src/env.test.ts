import { describe, expect, it } from 'vitest';
import { readWorkerEnv } from './env.js';

describe('readWorkerEnv', () => {
  it('needs only DATABASE_URL, and defaults the rest', () => {
    expect(readWorkerEnv({ DATABASE_URL: 'postgres://db' })).toEqual({
      ok: true,
      env: { configPath: 'greenlie.config.yml', databaseUrl: 'postgres://db', smtpUrl: undefined, retentionMs: 30 * 86_400_000 },
    });
  });

  it('reads the optional settings', () => {
    const result = readWorkerEnv({
      DATABASE_URL: 'postgres://db',
      GREENLIE_CONFIG: '/etc/greenlie.yml',
      SMTP_URL: 'smtps://u:p@mail',
      GREENLIE_RETENTION: '7d',
    });
    expect(result).toEqual({
      ok: true,
      env: { configPath: '/etc/greenlie.yml', databaseUrl: 'postgres://db', smtpUrl: 'smtps://u:p@mail', retentionMs: 7 * 86_400_000 },
    });
  });

  it('treats an empty SMTP_URL as unset', () => {
    expect(readWorkerEnv({ DATABASE_URL: 'x', SMTP_URL: '' })).toMatchObject({ env: { smtpUrl: undefined } });
  });

  it('reports every problem at once', () => {
    expect(readWorkerEnv({ GREENLIE_RETENTION: 'a month' })).toEqual({
      ok: false,
      errors: [
        'DATABASE_URL is not set',
        expect.stringMatching(/^GREENLIE_RETENTION: "a month" is not a duration/),
      ],
    });
  });
});
