import type { Verdict } from '@greenlie/core';

export interface ChartPoint {
  at: Date;
  value: number;
  verdict: Verdict;
}

export interface PlottedPoint extends ChartPoint {
  x: number;
  y: number;
}

export interface Chart {
  viewBox: string;
  points: PlottedPoint[];
  /** Undefined when there is no threshold to draw, e.g. a check with no `slowAfter`. */
  thresholdY: number | undefined;
}

export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 160;
const WIDTH = CHART_WIDTH;
const HEIGHT = CHART_HEIGHT;
const PAD_X = 8;
const PAD_Y = 12;

/**
 * Plots points onto a fixed `viewBox`, so the SVG never needs client-side
 * measurement. The threshold — if any — is folded into the value range
 * before scaling, so a threshold outside the data still lands on the chart
 * instead of clipping off it.
 */
export function buildChart(points: readonly ChartPoint[], threshold?: number): Chart {
  const viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  if (points.length === 0) {
    return { viewBox, points: [], thresholdY: undefined };
  }

  const values = points.map((point) => point.value);
  const scaleValues = threshold === undefined ? values : [...values, threshold];
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);
  const range = max - min;

  const scaleY = (value: number): number => {
    if (range === 0) return HEIGHT / 2;
    return PAD_Y + (1 - (value - min) / range) * (HEIGHT - 2 * PAD_Y);
  };
  const scaleX = (index: number): number => {
    if (points.length === 1) return WIDTH / 2;
    return PAD_X + (index / (points.length - 1)) * (WIDTH - 2 * PAD_X);
  };

  return {
    viewBox,
    points: points.map((point, index) => ({ ...point, x: scaleX(index), y: scaleY(point.value) })),
    thresholdY: threshold === undefined ? undefined : scaleY(threshold),
  };
}
