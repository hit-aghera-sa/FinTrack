import type { ReactElement } from 'react';

export interface MetricCardProps {
  /** What is being counted, e.g. "People". Shown exactly as written — never restyled to capitals. */
  label: string;
  /** The figure. Pass it already formatted if it needs a currency sign or separators. */
  value: string | number;
  /** Optional supporting line under the figure, e.g. "+12% vs last period". */
  hint?: string;
  /** Colours the hint as good or bad news. Omit for a neutral hint. */
  trend?: 'up' | 'down';
}

/**
 * The app's one summary tile: a label and a figure, for ANY count.
 *
 * It used to accept only the starter's own `Metric` record (with a currency unit and a mandatory
 * percentage delta), so a screen that wanted "People: 8" could not use it and built its own card.
 */
export function MetricCard({ label, value, hint, trend }: MetricCardProps): ReactElement {
  const hintClass = trend === 'up' ? 'metric-delta is-up' : trend === 'down' ? 'metric-delta is-down' : 'metric-delta';
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {hint !== undefined ? <p className={hintClass}>{hint}</p> : null}
    </article>
  );
}
