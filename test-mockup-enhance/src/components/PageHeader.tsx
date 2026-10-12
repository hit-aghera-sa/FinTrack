import type { ReactElement, ReactNode } from 'react';

export interface PageHeaderProps {
  /** The page's name. The shell passes the route label. */
  title: string;
  /** Optional line under the title saying what the page is for. */
  description?: string;
  /** Optional buttons or links aligned opposite the title, e.g. "Add todo". */
  actions?: ReactNode;
}

/**
 * The heading of a page. The shell renders one for every page from its route label, so a page uses
 * this itself only for a SECTION inside the page that needs a description or actions of its own.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps): ReactElement {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description !== undefined ? <p className="page-description">{description}</p> : null}
      </div>
      {actions !== undefined ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
