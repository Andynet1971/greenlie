import type { GreenlieConfig } from '@greenlie/core';
import { createStore, type Connection, type Store } from '@greenlie/db';
import { createTestDatabase } from '@greenlie/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Logger } from './logger.js';
import { startServer, type TestServer } from './test-helpers/http-server.js';
import { HEARTBEAT_SWEEP_MS, PRUNE_EVERY_MS, buildTasks } from './tasks.js';

let connection: Connection;
let store: Store;
let server: TestServer;

beforeAll(async () => {
  connection = await createTestDatabase();
  store = createStore(connection.db);
  server = await startServer((_req, res) => res.writeHead(200).end('ok'));
});

afterAll(async () => {
  await server.close();
  await connection.close();
});

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 23);

function setup() {
  const config: GreenlieConfig = {
    alerts: {},
    checks: [
      {
        type: 'http',
        id: 'site',
        name: 'Site',
        url: server.url,
        everyMs: 120_000,
        timeoutMs: 2_000,
        headers: {},
        confirmations: 1,
        rules: { expectStatus: [200] },
      },
      { type: 'heartbeat', id: 'backup', name: 'Backup', token: 'x'.repeat(16), rules: { everyMs: DAY, graceMs: 0 } },
    ],
  };
  const logs: string[] = [];
  const log: Logger = (_level, message) => void logs.push(message);
  const tasks = buildTasks(config, { store, notify: async () => undefined, now: () => new Date(NOW), log, retentionMs: 30 * DAY });
  return { tasks, logs, task: (name: string) => tasks.find((t) => t.name === name) };
}

describe('buildTasks', () => {
  it('makes one task per check, plus pruning, each at its own pace', () => {
    expect(setup().tasks.map((t) => [t.name, t.everyMs])).toEqual([
      ['site', 120_000],
      ['backup', HEARTBEAT_SWEEP_MS],
      ['prune', PRUNE_EVERY_MS],
    ]);
  });

  it('wires probe tasks to the real network and the store', async () => {
    await setup().task('site')?.run();
    expect(await store.recentVerdicts('site', 1)).toEqual(['ok']);
  });

  it('wires heartbeat tasks to the state', async () => {
    await setup().task('backup')?.run();
    expect(await store.ensureCheck('backup', new Date())).toMatchObject({ watchingSince: new Date(NOW) });
  });

  it('prunes runs past the retention, and logs only when it deleted something', async () => {
    const { task, logs } = setup();
    await store.insertRun({ checkId: 'site', at: new Date(NOW - 31 * DAY), verdict: 'ok', reason: 'old' });

    await task('prune')?.run();
    expect(logs).toEqual(['old runs pruned']);
    await task('prune')?.run();
    expect(logs).toEqual(['old runs pruned']);
  });
});
