import type { ReactNode } from 'react';
import './Button.css';

export interface ButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** While true the button is busy: it cannot be pressed twice and says so to assistive tech. */
  loading?: boolean;
  onClick?: () => void;
}

/** The app's one button. Primary for the main action, secondary beside it, danger for destruction. */
export function Button({
  children,
  type = 'button',
  variant = 'primary',
  disabled = false,
  loading = false,
  onClick,
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={`button button-${variant}`}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      onClick={onClick}
    >
      {loading ? (
        <>
          <span className="ui-button-busy" aria-hidden="true" />
          <span className="visually-hidden">Working… </span>
        </>
      ) : null}
      {children}
    </button>
  );
}
