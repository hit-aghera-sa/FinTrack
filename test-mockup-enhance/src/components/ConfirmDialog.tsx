import { useEffect, useId, useRef, type ReactElement } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  /** Whether the dialog is shown. The page owns this state. */
  open: boolean;
  /** The question, e.g. "Delete this todo?". */
  title: string;
  /** Optional consequence, e.g. "This cannot be undone." */
  message?: string;
  /** The confirming button's text. Defaults to "Confirm". */
  confirmLabel?: string;
  /** The cancelling button's text. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Draws the confirming button as a destructive action. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before something that cannot be undone, such as deleting a record.
 *
 * Opens with the Cancel button focused, so Enter never confirms by accident, and Escape cancels.
 * Renders nothing while closed.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement | null {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message !== undefined ? messageId : undefined}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {message !== undefined ? (
          <p id={messageId} className="dialog-message">
            {message}
          </p>
        ) : null}
        <div className="dialog-actions">
          <Button ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
