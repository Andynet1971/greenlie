import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';

afterEach(() => void vi.restoreAllMocks());

describe('createLogger', () => {
  it('writes one JSON object per line, with time and level first', () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line))('warn', 'check failing', { check: 'api' });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
    expect(Object.keys(entry)).toEqual(['time', 'level', 'message', 'check']);
    expect(entry).toMatchObject({ level: 'warn', message: 'check failing', check: 'api' });
  });

  it('writes to stdout by default', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    createLogger()('info', 'started');
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/"message":"started"\}\n$/));
  });
});
