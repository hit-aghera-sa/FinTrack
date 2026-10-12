import type { ReactElement, ReactNode } from 'react';

export interface CardProps {
  /** Optional heading of the card. */
  title?: string;
  /** Optional line beside the title. */
  description?: string;
  /** Optional buttons or links in the card's header, e.g. "Edit". */
  actions?: ReactNode;
  /** Optional footer row, usually a form's Save / Cancel buttons. */
  footer?: ReactNode;
  /** Remove the inner padding, for content that brings its own (a list, a table). */
  flush?: boolean;
  children: ReactNode;
}

/**
 * A titled panel: the container for a form, a record's details or any other block of a page.
 * With a `title` it is a labelled region, so assistive technology can jump to it by name.
 */
export function Card({ title, description, actions, footer, flush, children }: CardProps): ReactElement {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section className="card" aria-label={title}>
      {hasHeader ? (
        <div className="card-header">
          <div>
            {title !== undefined ? <h2 className="card-title">{title}</h2> : null}
            {description !== undefined ? <p className="card-description">{description}</p> : null}
          </div>
          {actions !== undefined ? <div className="page-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush === true ? 'card-body is-flush' : 'card-body'}>{children}</div>
      {footer !== undefined ? <div className="card-footer">{footer}</div> : null}
    </section>
  );
}
