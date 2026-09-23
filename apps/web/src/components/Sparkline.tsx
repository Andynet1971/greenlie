import type { Chart as ChartData } from '../lib/chart';

/** Decorative mini chart: the verdict and reason next to it already say it in text. */
export function Sparkline({ chart }: { chart: ChartData }) {
  if (chart.points.length === 0) return null;
  const path = chart.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={chart.viewBox} aria-hidden="true" className="sparkline">
      <path d={path} fill="none" className="chart-line" />
    </svg>
  );
}
