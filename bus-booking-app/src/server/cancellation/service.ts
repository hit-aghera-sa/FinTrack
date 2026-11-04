import { MESSAGES } from '../../messages/index.js';
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  CANCEL_CUTOFF_MS,
  type BookingRecord,
} from '../../models/bookings/index.js';

/**
 * THE CANCELLATION RULES of Bus Booking App.
 *
 * One promise, decided here and nowhere else: a traveller may cancel their OWN upcoming booking
 * while more than one hour remains before the scheduled departure. Inside that last hour — or for a
 * booking that is already cancelled, or whose bus has gone — the request is refused with the
 * catalogue's wording. Nothing was ever paid, so there is no refund step of any kind.
 *
 * Cancelling itself is the data layer's single transaction (`BookingRepository.cancel`): it marks the
 * booking Cancelled AND releases every one of its seats, so the seats reappear in other travellers'
 * seat maps and seats-left counts straight away.
 *
 * The store and the clock are parameters, so these rules are verified with no database and no HTTP.
 */

/** Why a cancellation was refused. `TOO_LATE` is the 409 the client maps to its message. */
export type CancellationFailureCode = 'NOT_FOUND' | 'TOO_LATE';

export interface CancellationFailure {
  readonly ok: false;
  readonly code: CancellationFailureCode;
  readonly message: string;
}

export interface CancellationSuccess {
  readonly ok: true;
  /** The booking as it now stands: status `CANCELLED`, seats already released. */
  readonly booking: BookingRecord;
}

export type CancellationResult = CancellationSuccess | CancellationFailure;

/**
 * The slice of the booking data layer cancellation needs — `bookingRepository` satisfies it as it
 * stands, and a spec implements it in memory.
 */
export interface CancellationBookingStore {
  findByIdForUser(bookingId: string, userId: string, now: Date): Promise<BookingRecord | null>;
  cancel(bookingId: string, userId: string): Promise<BookingRecord>;
}

export interface CancellationDeps {
  readonly bookings: CancellationBookingStore;
  /** The moment the request is judged against. Defaults to the real clock. */
  readonly now?: () => Date;
}

export interface CancellationService {
  cancel(bookingId: string, userId: string): Promise<CancellationResult>;
}

/**
 * What a caller is told for a booking reference that is not theirs, or does not exist. Deliberately
 * the same sentence for both, so a booking id cannot be probed for existence.
 */
export const BOOKING_NOT_FOUND_MESSAGE = 'That booking could not be found.';

/** Milliseconds from `now` to the scheduled departure, or null when the stored instant is unusable. */
export function msUntilDeparture(departureAt: string, now: Date): number | null {
  const departureMs = Date.parse(departureAt);
  if (Number.isNaN(departureMs)) return null;
  return departureMs - now.getTime();
}

/**
 * True when the bus leaves in one hour or less — the window in which cancellation is refused.
 *
 * The boundary is exact: at precisely one hour before departure the booking can no longer be
 * cancelled (the rule is `now < departure - 1 hour`). A departure instant that cannot be read is
 * treated as inside the window, so an unreadable trip is never cancelled by accident.
 */
export function isWithinCancelCutoff(departureAt: string, now: Date): boolean {
  const remaining = msUntilDeparture(departureAt, now);
  if (remaining === null) return true;
  return remaining <= CANCEL_CUTOFF_MS;
}

/** The HTTP status each refusal answers with. */
export function httpStatusFor(code: CancellationFailureCode): number {
  return code === 'NOT_FOUND' ? 404 : 409;
}

function notFound(): CancellationFailure {
  return { ok: false, code: 'NOT_FOUND', message: BOOKING_NOT_FOUND_MESSAGE };
}

function tooLate(): CancellationFailure {
  return { ok: false, code: 'TOO_LATE', message: MESSAGES.cancelNotAllowed };
}

export function createCancellationService(deps: CancellationDeps): CancellationService {
  const clock: () => Date = deps.now ?? ((): Date => new Date());

  return {
    async cancel(bookingId: string, userId: string): Promise<CancellationResult> {
      const now = clock();

      // Scoped to the signed-in traveller: another traveller's booking simply is not found.
      const booking = await deps.bookings.findByIdForUser(bookingId, userId, now);
      if (booking === null) return notFound();

      // Cancelled and Completed are terminal; only a live, upcoming booking can be cancelled.
      if (booking.status !== 'BOOKED') return tooLate();
      if (isWithinCancelCutoff(booking.departureAt, now)) return tooLate();

      try {
        const cancelled = await deps.bookings.cancel(bookingId, userId);
        return { ok: true, booking: cancelled };
      } catch (error: unknown) {
        // The data layer re-checks the same rules inside its transaction; honour its verdict.
        if (error instanceof BookingNotFoundError) return notFound();
        if (error instanceof BookingNotCancellableError) return tooLate();
        throw error;
      }
    },
  };
}
