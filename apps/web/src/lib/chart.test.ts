import { describe, expect, it } from 'vitest';
import { buildChart, type ChartPoint } from './chart';

const point = (value: number, verdict: ChartPoint['verdict'] = 'ok'): ChartPoint => ({
  at: new Date('2026-09-23T00:00:00Z'),
  value,
  verdict,
});

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a defined value');
  return value;
}

describe('buildChart', () => {
  it('returns an empty chart with no points, on the same fixed viewBox', () => {
    const chart = buildChart([]);
    expect(chart.points).toEqual([]);
    expect(chart.thresholdY).toBeUndefined();
    expect(chart.viewBox).toBe('0 0 600 160');
  });

  it('places a single point without dividing by zero', () => {
    const chart = buildChart([point(50)]);
    expect(chart.points).toHaveLength(1);
    expect(defined(chart.points[0]).x).toBe(300);
    expect(Number.isFinite(defined(chart.points[0]).y)).toBe(true);
  });

  it('centers every point vertically when all values are equal', () => {
    const chart = buildChart([point(10), point(10), point(10)]);
    for (const p of chart.points) expect(p.y).toBe(80);
  });

  it('spaces points evenly across the width', () => {
    const chart = buildChart([point(1), point(2), point(3)]);
    expect(chart.points.map((p) => p.x)).toEqual([8, 300, 592]);
  });

  it('includes an out-of-range threshold in the scale instead of clipping it', () => {
    const chart = buildChart([point(10), point(20)], 100);
    expect(chart.thresholdY).toBeDefined();
    // The threshold is above every point, so it must plot above them (smaller y).
    const thresholdY = defined(chart.thresholdY);
    for (const p of chart.points) expect(thresholdY).toBeLessThan(p.y);
  });

  it('omits thresholdY when no threshold is given', () => {
    const chart = buildChart([point(1)]);
    expect(chart.thresholdY).toBeUndefined();
  });
});
