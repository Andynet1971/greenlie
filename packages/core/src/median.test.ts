import { describe, expect, it } from 'vitest';
import { median } from './median.js';

describe('median', () => {
  it('is undefined for no values', () => {
    expect(median([])).toBeUndefined();
  });

  it('takes the middle value of an odd count, whatever the order', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('averages the two middle values of an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('ignores a single freak run, unlike the mean', () => {
    expect(median([100, 102, 98, 101, 5000])).toBe(101);
  });

  it('does not reorder the caller’s array', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});
