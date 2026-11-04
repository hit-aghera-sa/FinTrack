/**
 * THE CANCEL BOOKING CONFIRMATION FLOW.
 *
 * This feature owns no route: `CancelBookingButton` is the control the My bookings list and the
 * booking ticket render for one booking. It hides itself when the booking can no longer be
 * cancelled, asks for confirmation, calls the cancellation endpoint and hands the confirmation
 * sentence back to the caller so the list refreshes with the Cancelled status.
 *
 *   <CancelBookingButton booking={booking} onCancelled={(cancelled, message) => { ... }} />
 */
export { CancelBookingButton } from './CancelBookingButton';
export type { CancelBookingButtonProps } from './CancelBookingButton';
export {
  CANCEL_BOOKING_API_PATH,
  cancelBookingRequestPath,
  cancellationMessageFor,
  cancelledLocally,
  describeCancelError,
  isCancellable,
} from './cancel-booking.js';
