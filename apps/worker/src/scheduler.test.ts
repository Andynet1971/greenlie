import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from './logger.js';
import { startScheduler, type Task } from './scheduler.js';

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

const quiet: Logger = () => undefined;

describe('startScheduler', () => {
  it('runs each task after its first delay, then every interval', async () => {
    const runs: number[] = [];
    const task: Task = { name: 't', everyMs: 1_000, run: async () => void runs.push(Date.now()) };
    const start = Date.now();
    const scheduler = startScheduler([task], { log: quiet, firstRunDelayMs: () => 100 });

    await vi.advanceTimersByTimeAsync(2_150);
    expect(runs.map((t) => t - start)).toEqual([100, 1_100, 2_100]);
    await scheduler.stop();
  });

  it('never overlaps runs of a slow task: the interval starts when a run ends', async () => {
    let running = 0;
    let maxRunning = 0;
    const task: Task = {
      name: 'slow',
      everyMs: 100,
      run: async () => {
        maxRunning = Math.max(maxRunning, ++running);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        running--;
      },
    };
    const scheduler = startScheduler([task], { log: quiet, firstRunDelayMs: () => 0 });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(maxRunning).toBe(1);

    // A run is in flight: stop() waits for it, so time must move on.
    const stopping = scheduler.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopping;
  });

  it('logs a failing task and keeps scheduling it', async () => {
    const errors: unknown[] = [];
    const log: Logger = (level, _message, fields) => void (level === 'error' && errors.push(fields));
    let calls = 0;
    const task: Task = {
      name: 'flaky',
      everyMs: 100,
      run: async () => {
        calls++;
        throw new Error('database unavailable');
      },
    };
    const scheduler = startScheduler([task], { log, firstRunDelayMs: () => 0 });
    await vi.advanceTimersByTimeAsync(250);
    expect(calls).toBe(3);
    expect(errors[0]).toEqual({ task: 'flaky', error: 'database unavailable' });
    await scheduler.stop();
  });

  it('logs something thrown that is not an Error', async () => {
    const errors: unknown[] = [];
    const log: Logger = (_level, _message, fields) => void errors.push(fields);
    const scheduler = startScheduler([{ name: 'odd', everyMs: 100, run: () => Promise.reject('nope') }], {
      log,
      firstRunDelayMs: () => 0,
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(errors[0]).toEqual({ task: 'odd', error: 'nope' });
    await scheduler.stop();
  });

  it('stop() waits for the run in flight and schedules nothing more', async () => {
    let finished = 0;
    const task: Task = {
      name: 't',
      everyMs: 100,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        finished++;
      },
    };
    const scheduler = startScheduler([task], { log: quiet, firstRunDelayMs: () => 0 });
    await vi.advanceTimersByTimeAsync(10);

    const stopping = scheduler.stop();
    await vi.advanceTimersByTimeAsync(500);
    await stopping;
    expect(finished).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(finished).toBe(1);
  });

  it('spreads first runs over at most ten seconds by default', async () => {
    const at: number[] = [];
    const start = Date.now();
    const tasks: Task[] = Array.from({ length: 20 }, (_, i) => ({
      name: `t${i}`,
      everyMs: 3_600_000,
      run: async () => void at.push(Date.now() - start),
    }));
    const scheduler = startScheduler(tasks, { log: quiet });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(at).toHaveLength(20);
    expect(Math.max(...at)).toBeLessThan(10_000);
    await scheduler.stop();
  });
});
