import type { ReactNode } from 'react';

export type AlertKind = 'error' | 'success' | 'info';

export interface AlertProps {
  kind: AlertKind;
  children: ReactNode;
}

const KIND_CLASS: Record<AlertKind, string> = {
  error: 'notice notice-danger',
  success: 'notice notice-success',
  info: 'notice notice-info',
};

/** The word that accompanies the colour, so an alert never relies on colour alone. */
const KIND_WORD: Record<AlertKind, string> = {
  error: 'Error',
  success: 'Success',
  info: 'Information',
};

function KindIcon({ kind }: { kind: AlertKind }): JSX.Element {
  if (kind === 'success') {
    return (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.5A1 1 0 0 0 3.5 19h17a1 1 0 0 0 .9-1.5L13.7 3.9a1 1 0 0 0-1.7 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
    </svg>
  );
}

/** The inline message strip every screen uses for a failure, a confirmation or a hint. */
export function Alert({ kind, children }: AlertProps): JSX.Element {
  return (
    <div className={KIND_CLASS[kind]} role={kind === 'error' ? 'alert' : 'status'}>
      <KindIcon kind={kind} />
      <span>
        <span className="visually-hidden">{KIND_WORD[kind]}: </span>
        {children}
      </span>
    </div>
  );
}
