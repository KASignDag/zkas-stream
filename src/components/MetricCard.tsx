import type { ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
};

export function MetricCard({ icon, label, value, sub, accent }: Props) {
  return (
    <div className={`metric-card ${accent ? 'accent' : ''}`}>
      <div className="metric-label"><span className="metric-icon">{icon}</span>{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
