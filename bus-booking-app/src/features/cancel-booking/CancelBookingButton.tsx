import { useState, type CSSProperties } from 'react';
import { apiFetch } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import { Alert, Button, ConfirmDialog } from '../../ui/index.js';
import {
  cancelBookingRequestPath,
  cancelledLocally,
  cancellationMessageFor,
  describeCancelError,
  isCancellable,
} from './cancel-booking.js';

export interface CancelBookingButtonProps {
  /** The booking this control cancels, exactly as the bookings API stated it. */
  booking: BookingRecord;
  /**
   * Called once the backend has cancelled the booking: the cancelled record (status Cancelled) and
   * the confirmation sentence naming the booking reference, so the caller can refresh its list and
   * show the message.
   */
  onCancelled: (booking: BookingRecord, message: string) => void;
}

/** Layout only — every colour, border and font comes from the shared UI kit's primitives. */
const LAYOUT: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  alignItems: 'flex-start',
};

/**
 * THE TRAVELLER'S CANCEL CONTROL — rendered inside the bookings list and the ticket view, with no
 * route of its own.
 *
 * It renders NOTHING AT ALL when the booking is no longer cancellable (inside the last hour before
 * departure, or already cancelled or completed). Otherwise it offers a Cancel button, asks
 * "Cancel this booking?" with Yes, cancel and No, and on confirmation calls
 * `POST /api/bookings/:bookingId/cancel` — the whole booking, never a single seat — so the seats are
 * released by the API immediately. The confirmation sentence is handed back to the caller; a refusal
 * inside the cut-off and any connectivity failure are shown here as their mapped messages.
 */
export function CancelBookingButton({ booking, onCancelled }: CancelBookingButtonProps): JSX.Element | null {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!isCancellable(booking)) return null;

  const runCancel = async (): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      const updated = await apiFetch<BookingRecord | null>(cancelBookingRequestPath(booking.id), {
        method: 'POST',
      });
      const cancelled = updated ?? cancelledLocally(booking, new Date().toISOString());
      setBusy(false);
      setOpen(false);
      onCancelled(cancelled, cancellationMessageFor(booking));
    } catch (error: unknown) {
      setBusy(false);
      setOpen(false);
      setFailure(describeCancelError(error));
    }
  };

  return (
    <div data-testid="cancel-booking-confirmation-flow-page" style={LAYOUT}>
      <Button
        variant="danger"
        onClick={() => {
          setFailure(null);
          setOpen(true);
        }}
      >
        Cancel
      </Button>

      {failure !== null ? (
        <div data-testid="cancel-booking-confirmation-flow-error">
          <Alert kind="error">{failure}</Alert>
        </div>
      ) : null}

      <ConfirmDialog
        open={open}
        title={MESSAGES.cancelConfirmTitle}
        confirmLabel={MESSAGES.cancelConfirmYes}
        cancelLabel={MESSAGES.cancelConfirmNo}
        busy={busy}
        onConfirm={() => {
          void runCancel();
        }}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
      />
    </div>
  );
}
