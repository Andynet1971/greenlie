import { describe, expect, it } from 'vitest';
import { relativeTime } from './time';

const now = new Date('2026-09-23T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('relativeTime', () => {
  it('is "just now" right up to the minute boundary', () => {
    expect(relativeTime(now, now)).toBe('just now');
    expect(relativeTime(ago(59_999), now)).toBe('just now');
  });

  it('counts minutes up to the hour boundary', () => {
    expect(relativeTime(ago(60_000), now)).toBe('1 min ago');
    expect(relativeTime(ago(3 * 60_000), now)).toBe('3 min ago');
    expect(relativeTime(ago(3_599_999), now)).toBe('59 min ago');
  });

  it('counts hours up to the day boundary', () => {
    expect(relativeTime(ago(3_600_000), now)).toBe('1 h ago');
    expect(relativeTime(ago(2 * 3_600_000), now)).toBe('2 h ago');
    expect(relativeTime(ago(86_400_000 - 1), now)).toBe('23 h ago');
  });

  it('counts days, singular and plural', () => {
    expect(relativeTime(ago(86_400_000), now)).toBe('1 day ago');
    expect(relativeTime(ago(4 * 86_400_000), now)).toBe('4 days ago');
  });
});
