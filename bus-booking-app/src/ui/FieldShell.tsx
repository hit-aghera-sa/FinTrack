import type { ReactNode } from 'react';
import './FieldShell.css';

export interface FieldShellProps {
  /** The visible label text. */
  label: string;
  /** The id of the control this label points at. */
  controlId: string;
  /** The id the error message is given, so the control can describe itself with it. */
  errorId: string;
  /** The inline error, or null/undefined when the field is fine. */
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}

/** Whether a possibly-null error string actually carries a message. */
export function hasMessage(error?: string | null): boolean {
  return typeof error === 'string' && error.trim().length > 0;
}

/**
 * The label + control + inline error wrapper shared by TextField and SelectField, so every field in
 * the app reports a problem the same way: a word, not just a colour.
 */
export function FieldShell({ label, controlId, errorId, error, required = false, children }: FieldShellProps): JSX.Element {
  const invalid = hasMessage(error);
  return (
    <div className={invalid ? 'field ui-field has-error' : 'field ui-field'}>
      <label className="field-label" htmlFor={controlId}>
        {label}
        {required ? <span className="ui-field-required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {invalid ? (
        <span className="field-hint ui-field-error" id={errorId} role="alert">
          <span className="visually-hidden">Error: </span>
          {error}
        </span>
      ) : null}
    </div>
  );
}
