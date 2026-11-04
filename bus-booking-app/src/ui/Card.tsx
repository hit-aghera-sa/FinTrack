import type { ReactNode } from 'react';
import './Card.css';

export interface CardProps {
  children: ReactNode;
  /** Given, the whole card becomes one real button — keyboard reachable and announced as such. */
  onClick?: () => void;
  disabled?: boolean;
  /** Test hook only; never shown to a reader. */
  testId?: string;
}

/** The app's surface for a grouped block of content: a trip, a ticket, a form section. */
export function Card({ children, onClick, disabled = false, testId }: CardProps): JSX.Element {
  if (onClick !== undefined) {
    return (
      <button
        type="button"
        className="card ui-card-action"
        disabled={disabled}
        data-testid={testId}
        onClick={onClick}
      >
        <span className="card-body">{children}</span>
      </button>
    );
  }

  return (
    <div className="card" data-testid={testId} aria-disabled={disabled ? true : undefined}>
      <div className="card-body">{children}</div>
    </div>
  );
}
