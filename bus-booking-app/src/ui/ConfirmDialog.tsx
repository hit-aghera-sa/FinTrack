import { Button } from './Button';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  /** While true the dialog is waiting on the server: both answers are blocked. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The Yes / No confirmation. Closed it renders nothing at all, so a screen can keep it mounted.
 * Both answers are real buttons with their own words — never an icon-only choice.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  if (!open) return null;

  const titleId = 'ui-confirm-dialog-title';

  return (
    <div className="ui-dialog-backdrop">
      <div className="card ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="card-body">
          <h2 className="card-title" id={titleId}>
            {title}
          </h2>
        </div>
        <div className="card-footer ui-dialog-actions">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
