import type { BookingRecord } from '../../models/bookings/index.js';
import { splitBookings, type MyBookingsList } from './split.js';

/**
 * THE MY BOOKINGS SERVICE — the two reads behind `/api/bookings`, with no HTTP in sight.
 *
 * Both reads are scoped to ONE account: the list asks the booking data layer for that traveller's
 * bookings, and the ticket read asks for one booking *of that traveller*, so another traveller's
 * booking id simply is not found — which the router turns into a 404, never a 403 that would reveal
 * the booking exists.
 *
 * The data layer is injected (`bookings`), so these rules are exercised with an in-memory double and
 * no database; the clock is a constructor parameter with a working default, never a setter.
 */

/** The slice of the booking data layer this lane reads. `bookingRepository` satisfies it as it is. */
export interface MyBookingsStore {
  listByUser(userId: string, now: Date): Promise<BookingRecord[]>;
  findByIdForUser(bookingId: string, userId: string, now: Date): Promise<BookingRecord | null>;
}

export interface MyBookingsDeps {
  readonly bookings: MyBookingsStore;
  /** The instant the read happens. Defaults to the real clock. */
  readonly now?: () => Date;
}

/** Either the traveller's own booking, or nothing of theirs under that id. */
export type TicketOutcome =
  | { ok: true; booking: BookingRecord }
  | { ok: false; code: 'not_found' };

export interface MyBookingsService {
  /** That account's bookings as the Upcoming and Past & cancelled tabs, each ordered. */
  list(userId: string): Promise<MyBookingsList>;
  /** One booking of that account as the ticket, or `not_found`. */
  ticket(bookingId: string, userId: string): Promise<TicketOutcome>;
}

export function createMyBookingsService(deps: MyBookingsDeps): MyBookingsService {
  const clock: () => Date = deps.now ?? ((): Date => new Date());

  return {
    async list(userId: string): Promise<MyBookingsList> {
      const now = clock();
      const bookings = await deps.bookings.listByUser(userId, now);
      return splitBookings(bookings, now);
    },

    async ticket(bookingId: string, userId: string): Promise<TicketOutcome> {
      const now = clock();
      const booking = await deps.bookings.findByIdForUser(bookingId, userId, now);
      if (booking === null) return { ok: false, code: 'not_found' };
      return { ok: true, booking };
    },
  };
}
