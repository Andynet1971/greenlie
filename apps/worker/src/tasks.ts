import type { GreenlieConfig } from '@greenlie/core';
import type { Store } from '@greenlie/db';
import { runHeartbeatCycle, runProbeCycle, type CycleDeps } from './cycle.js';
import type { Logger } from './logger.js';
import { runProbe } from './probe/run-probe.js';
import type { Task } from './scheduler.js';

/** Heartbeats are cheap to judge; checking often keeps "stale" timely. */
export const HEARTBEAT_SWEEP_MS = 30_000;
export const PRUNE_EVERY_MS = 6 * 3_600_000;

export function buildTasks(
  config: GreenlieConfig,
  deps: CycleDeps & { log: Logger; retentionMs: number; store: Store },
): Task[] {
  const tasks: Task[] = config.checks.map((check) =>
    check.type === 'heartbeat'
      ? { name: check.id, everyMs: HEARTBEAT_SWEEP_MS, run: () => runHeartbeatCycle(check, deps) }
      : { name: check.id, everyMs: check.everyMs, run: () => runProbeCycle(check, runProbe, deps) },
  );

  tasks.push({
    name: 'prune',
    everyMs: PRUNE_EVERY_MS,
    run: async () => {
      const deleted = await deps.store.pruneRuns(new Date(deps.now().getTime() - deps.retentionMs));
      if (deleted > 0) deps.log('info', 'old runs pruned', { deleted });
    },
  });
  return tasks;
}
