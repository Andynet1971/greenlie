import { CHART_WIDTH, type Chart as ChartData } from '../lib/chart';

interface ChartProps {
  chart: ChartData;
  title: string;
  label: string;
}

function pathFor(chart: ChartData): string {
  return chart.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

/** Plain SVG, no client JavaScript: an accessible line chart of one series. */
export function Chart({ chart, title, label }: ChartProps) {
  return (
    <svg viewBox={chart.viewBox} role="img" aria-label={label} className="chart">
      <title>{title}</title>
      {chart.thresholdY !== undefined && (
        <line x1={0} x2={CHART_WIDTH} y1={chart.thresholdY} y2={chart.thresholdY} className="chart-threshold" />
      )}
      {chart.points.length > 0 && <path d={pathFor(chart)} fill="none" className="chart-line" />}
      {chart.points.map((point) => (
        <circle
          key={point.at.toISOString()}
          cx={point.x}
          cy={point.y}
          r={3}
          className={`chart-point verdict-${point.verdict}`}
        />
      ))}
    </svg>
  );
}
