import './Spinner.css';

export interface SpinnerProps {
  /** The words shown beside the ring. Defaults to "Loading…". */
  label?: string;
}

/** The loading view: a turning ring AND its words, announced politely while a screen waits. */
export function Spinner({ label = 'Loading…' }: SpinnerProps): JSX.Element {
  return (
    <div className="ui-spinner" role="status" aria-live="polite">
      <span className="ui-spinner-ring" aria-hidden="true" />
      <span className="ui-spinner-label">{label}</span>
    </div>
  );
}
