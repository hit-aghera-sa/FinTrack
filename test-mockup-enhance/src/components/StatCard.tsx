import type { ReactElement } from 'react';

export interface StatCardProps {
  /** What the figure counts, e.g. "Open todos". */
  label: string;
  /** The figure, already formatted for display. A number is shown as written. */
  value: string | number;
  /** Optional line under the figure, e.g. "3 due today". */
  hint?: string;
  /** Colours the hint: "up" reads as good, "down" as bad. Omit for a neutral hint. */
  trend?: 'up' | 'down';
}

/**
 * One summary figure. Shows ANY number with its label - put several inside
 * `<section className="stat-grid">` for a row of figures.
 */
export function StatCard({ label, value, hint, trend }: StatCardProps): ReactElement {
  const hintClass = trend === 'up' ? 'stat-hint is-up' : trend === 'down' ? 'stat-hint is-down' : 'stat-hint';
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint !== undefined ? <p className={hintClass}>{hint}</p> : null}
    </article>
  );
}
