import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  /** Short statement of what is missing, e.g. "No people match that search". */
  title: string;
  /** Optional extra line: why, or what to do next. */
  message?: string;
  /** Optional way out, e.g. a link or a "Clear search" button. */
  action?: ReactNode;
}

/**
 * What a screen shows when it has nothing to list — no results, no data yet, or a page that does not
 * exist. One shared look, so "empty" reads the same everywhere in the app.
 */
export function EmptyState({ title, message, action }: EmptyStateProps): ReactElement {
  return (
    <section className="empty-state" role="status">
      <p className="empty-state-title">{title}</p>
      {message !== undefined ? <p className="empty-state-message">{message}</p> : null}
      {action !== undefined ? <div className="empty-state-action">{action}</div> : null}
    </section>
  );
}
