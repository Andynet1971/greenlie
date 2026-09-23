import type { Check } from '@greenlie/core';
import { describe, expect, it } from 'vitest';
import { findHeartbeatByToken } from './token';

const heartbeat = (id: string, token: string): Check => ({
  type: 'heartbeat',
  id,
  name: id,
  token,
  rules: { everyMs: 1000, graceMs: 1000 },
});

const http = (id: string): Check => ({
  type: 'http',
  id,
  name: id,
  url: 'https://example.com',
  everyMs: 1000,
  timeoutMs: 1000,
  headers: {},
  confirmations: 1,
  rules: { expectStatus: [200] },
});

describe('findHeartbeatByToken', () => {
  it('finds the matching heartbeat check', () => {
    const checks = [http('site'), heartbeat('backup', 'secret-token')];
    expect(findHeartbeatByToken(checks, 'secret-token')?.id).toBe('backup');
  });

  it('returns undefined for an unknown token', () => {
    const checks = [heartbeat('backup', 'secret-token')];
    expect(findHeartbeatByToken(checks, 'wrong-token')).toBeUndefined();
  });

  it('ignores probe checks entirely', () => {
    expect(findHeartbeatByToken([http('site')], 'anything')).toBeUndefined();
  });

  it('does not match on a partial or longer token', () => {
    const checks = [heartbeat('backup', 'secret')];
    expect(findHeartbeatByToken(checks, 'secret-extra')).toBeUndefined();
    expect(findHeartbeatByToken(checks, 'secre')).toBeUndefined();
  });
});
