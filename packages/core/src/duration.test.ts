import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration } from './duration.js';

describe('parseDuration', () => {
  it.each([
    ['500ms', 500],
    ['30s', 30_000],
    ['5m', 300_000],
    ['24h', 86_400_000],
    ['7d', 604_800_000],
    ['1.5h', 5_400_000],
    [' 10s ', 10_000],
  ])('reads %s as %i ms', (text, ms) => {
    expect(parseDuration(text)).toBe(ms);
  });

  it.each(['10', 's', '10 s', '10sec', '-5m', ''])('rejects %j, which has no valid unit', (text) => {
    expect(() => parseDuration(text)).toThrow(/is not a duration: use a number and a unit/);
  });

  it('rejects zero', () => {
    expect(() => parseDuration('0s')).toThrow(/longer than zero/);
  });
});

describe('formatDuration', () => {
  it.each([
    [250, '250ms'],
    [45_000, '45s'],
    [5_400_000, '1h 30m'],
    [93_600_000, '1d 2h'],
    [90_061_000, '1d 1h'],
    [86_400_000, '1d'],
  ])('writes %i ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
