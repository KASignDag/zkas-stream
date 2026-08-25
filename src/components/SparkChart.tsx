import { useMemo } from 'react';

type Point = { x: number; y: number };

type Props = {
  values: Array<number | null | undefined>;
  labels?: number[];
  height?: number;
  fill?: boolean;
};

export function SparkChart({ values, labels, height = 170, fill = true }: Props) {
  const chart = useMemo(() => {
    const points: Point[] = [];
    values.forEach((value, i) => {
      if (typeof value === 'number' && Number.isFinite(value)) points.push({ x: i, y: value });
    });
    if (points.length < 2) return null;
    const ys = points.map((p) => p.y);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min || 1;
    const width = 1000;
    const padY = 12;
    const innerH = height - padY * 2;
    const coords = points.map((p) => {
      const x = (p.x / Math.max(1, values.length - 1)) * width;
      const y = padY + (1 - (p.y - min) / span) * innerH;
      return [x, y] as const;
    });
    const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const area = `${line} L ${coords.at(-1)![0]} ${height} L ${coords[0][0]} ${height} Z`;
    return { line, area, min, max };
  }, [values, height]);

  if (!chart) return <div className="chart-empty">Waiting for enough live data…</div>;

  const labelSpan = labels && labels.length > 1 ? Math.max(0, labels.at(-1)! - labels[0]) : 0;
  const formatLabel = (value: number) => {
    const date = new Date(value);
    if (labelSpan >= 48 * 60 * 60 * 1000) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (labelSpan >= 12 * 60 * 60 * 1000) return date.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const firstLabel = labels?.length ? formatLabel(labels[0]) : '';
  const lastLabel = labels?.length ? formatLabel(labels.at(-1)!) : '';

  return (
    <div className="spark-wrap">
      <svg className="spark" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" role="img" aria-label="Network trend chart">
        <defs>
          <linearGradient id="zkasArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => <line key={p} x1="0" x2="1000" y1={height * p} y2={height * p} className="chart-grid" />)}
        {fill && <path d={chart.area} fill="url(#zkasArea)" className="chart-area" />}
        <path d={chart.line} className="chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      {(firstLabel || lastLabel) && <div className="chart-labels"><span>{firstLabel}</span><span>{lastLabel}</span></div>}
    </div>
  );
}
