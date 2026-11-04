import { MESSAGES } from '../../messages/index.js';
import { BookingNotCancellableError, BookingNotFoundError, CANCEL_CUTOFF_MS, } from '../../models/bookings/index.js';
/**
 * What a caller is told for a booking reference that is not theirs, or does not exist. Deliberately
 * the same sentence for both, so a booking id cannot be probed for existence.
 */
export const BOOKING_NOT_FOUND_MESSAGE = 'That booking could not be found.';
/** Milliseconds from `now` to the scheduled departure, or null when the stored instant is unusable. */
export function msUntilDeparture(departureAt, now) {
    const departureMs = Date.parse(departureAt);
    if (Number.isNaN(departureMs))
        return null;
    return departureMs - now.getTime();
}
/**
 * True when the bus leaves in one hour or less — the window in which cancellation is refused.
 *
 * The boundary is exact: at precisely one hour before departure the booking can no longer be
 * cancelled (the rule is `now < departure - 1 hour`). A departure instant that cannot be read is
 * treated as inside the window, so an unreadable trip is never cancelled by accident.
 */
export function isWithinCancelCutoff(departureAt, now) {
    const remaining = msUntilDeparture(departureAt, now);
    if (remaining === null)
        return true;
    return remaining <= CANCEL_CUTOFF_MS;
}
/** The HTTP status each refusal answers with. */
export function httpStatusFor(code) {
    return code === 'NOT_FOUND' ? 404 : 409;
}
function notFound() {
    return { ok: false, code: 'NOT_FOUND', message: BOOKING_NOT_FOUND_MESSAGE };
}
function tooLate() {
    return { ok: false, code: 'TOO_LATE', message: MESSAGES.cancelNotAllowed };
}
export function createCancellationService(deps) {
    const clock = deps.now ?? (() => new Date());
    return {
        async cancel(bookingId, userId) {
            const now = clock();
            // Scoped to the signed-in traveller: another traveller's booking simply is not found.
            const booking = await deps.bookings.findByIdForUser(bookingId, userId, now);
            if (booking === null)
                return notFound();
            // Cancelled and Completed are terminal; only a live, upcoming booking can be cancelled.
            if (booking.status !== 'BOOKED')
                return tooLate();
            if (isWithinCancelCutoff(booking.departureAt, now))
                return tooLate();
            try {
                const cancelled = await deps.bookings.cancel(bookingId, userId);
                return { ok: true, booking: cancelled };
            }
            catch (error) {
                // The data layer re-checks the same rules inside its transaction; honour its verdict.
                if (error instanceof BookingNotFoundError)
                    return notFound();
                if (error instanceof BookingNotCancellableError)
                    return tooLate();
                throw error;
            }
        },
    };
}
