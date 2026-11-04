import type { ReactElement } from 'react';
import { errorText } from './logic.js';
import { ControlStyles } from './styles.js';

export interface ErrorLineProps {
  /** The single message to show, or `null` when there is nothing to report. */
  readonly message: string | null | undefined;
}

/**
 * Renders at most ONE error message, above the list. Renders nothing at all when the
 * message is null, undefined or blank.
 */
export function ErrorLine({ message }: ErrorLineProps): ReactElement | null {
  const text = errorText(message);
  if (text === null) return null;
  return (
    <>
      <ControlStyles />
      <p className="controls-error" role="alert" data-testid="error-line">
        {text}
      </p>
    </>
  );
}
