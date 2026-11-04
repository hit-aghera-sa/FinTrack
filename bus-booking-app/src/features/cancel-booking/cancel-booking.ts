import { UNEXPECTED_MESSAGE, isApiError, isOfflineError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';

/**
 * THE RULES BEHIND THE CANCEL CONTROL — pure, so the hidden-button case and the messages can be read
 * and tested without rendering anything or reaching the network.
 *
 * Cancellation itself belongs to the backend: the one-hour cut-off, the seat release and the status
 * change are all decided by `POST /api/bookings/:bookingId/cancel`. This module only decides whether
 * the control is offered at all, which address to call, and which sentence a traveller reads.
 */

/** The cancellation endpoint's shape, for documentation and tests. */
export const CANCEL_BOOKING_API_PATH = '/bookings/:bookingId/cancel';

/** The `/api`-relative address that cancels one booking (the API client adds the `/api` prefix). */
export function cancelBookingRequestPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/cancel`;
}

/**
 * Whether the Cancel control is offered at all.
 *
 * A booking is cancellable only while it is still BOOKED and the backend — which owns the one-hour
 * cut-off — says so through `canCancel`. Inside that last hour, or once the booking is cancelled or
 * completed, the control renders nothing: there is no disabled button and no explanatory note.
 */
export function isCancellable(booking: BookingRecord): boolean {
  return booking.status === 'BOOKED' && booking.canCancel;
}

/** The confirmation sentence, naming the human booking reference the traveller recognises. */
export function cancellationMessageFor(booking: BookingRecord): string {
  return MESSAGES.bookingCancelled(booking.id);
}

/**
 * The booking as it stands after a cancellation, used only when the endpoint answered with no body:
 * cancelled, no longer cancellable, and stamped with the moment it happened.
 */
export function cancelledLocally(booking: BookingRecord, cancelledAt: string): BookingRecord {
  return { ...booking, status: 'CANCELLED', canCancel: false, cancelledAt };
}

/**
 * What a traveller is told when the cancellation did not happen.
 *
 * A refusal inside the cut-off arrives as the server's own catalogue sentence ("This booking can no
 * longer be cancelled."); a request that never reached the backend becomes the no-internet sentence;
 * anything else falls back to the API client's generic wording.
 */
export function describeCancelError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (isApiError(error)) return error.message;
  return UNEXPECTED_MESSAGE;
}
