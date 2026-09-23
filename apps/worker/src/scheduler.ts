import type { Logger } from './logger.js';

export interface Task {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

export interface Scheduler {
  /** Stops scheduling and waits for the runs already in flight. */
  stop(): Promise<void>;
}

export interface SchedulerOptions {
  log: Logger;
  /** Spreads the first runs so a restart does not fire every check at once. */
  firstRunDelayMs?: (task: Task) => number;
}

/**
 * Fixed delay, not fixed rate: the next run is scheduled when the previous
 * one ends, so a check that hangs until its timeout can never pile up.
 */
export function startScheduler(tasks: readonly Task[], { log, firstRunDelayMs = spread }: SchedulerOptions): Scheduler {
  let stopped = false;
  const timers = new Set<NodeJS.Timeout>();
  const inFlight = new Set<Promise<void>>();

  const plan = (task: Task, delayMs: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      const running = execute(task).finally(() => inFlight.delete(running));
      inFlight.add(running);
    }, delayMs);
    timers.add(timer);
  };

  const execute = async (task: Task) => {
    try {
      await task.run();
    } catch (error) {
      log('error', 'task failed', { task: task.name, error: error instanceof Error ? error.message : String(error) });
    }
    if (!stopped) plan(task, task.everyMs);
  };

  for (const task of tasks) plan(task, firstRunDelayMs(task));

  return {
    async stop() {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await Promise.all(inFlight);
    },
  };
}

function spread(task: Task): number {
  return Math.floor(Math.random() * Math.min(task.everyMs, 10_000));
}
