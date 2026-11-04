import type { ReactElement, ReactNode } from 'react';

export interface PageHeaderProps {
  /** The page's one <h1>. */
  title: string;
  /** Optional one-line explanation under the title. */
  description?: string;
  /** Optional controls on the right, e.g. a button. */
  actions?: ReactNode;
}

/**
 * The heading block at the top of every page. The shell renders one automatically from the route's
 * label, so a screen only uses this directly when it needs a description or its own actions.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps): ReactElement {
  return (
    <header className="app-header">
      <div>
        <h1>{title}</h1>
        {description !== undefined ? <p className="app-header-description">{description}</p> : null}
      </div>
      {actions !== undefined ? <div className="app-header-actions">{actions}</div> : null}
    </header>
  );
}
