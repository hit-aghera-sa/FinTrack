import type { ReactElement, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  /** The meaning of the colour: "success" done/active, "warning" pending, "danger" overdue/failed. */
  tone?: BadgeTone;
  children: ReactNode;
}

/** A small label for a record's status or category. The text carries the meaning; the colour supports it. */
export function Badge({ tone = 'neutral', children }: BadgeProps): ReactElement {
  return <span className={tone === 'neutral' ? 'badge' : 'badge badge-' + tone}>{children}</span>;
}
