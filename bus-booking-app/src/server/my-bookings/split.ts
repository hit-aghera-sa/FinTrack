import type { BookingRecord } from '../../models/bookings/index.js';

/**
 * THE MY BOOKINGS SPLIT — the two tabs, decided once, as pure functions.
 *
 * *Upcoming* is every booking whose bus has NOT departed yet and which has not been cancelled,
 * soonest departure first. *Past & cancelled* is everything else — departed buses (Booked that became
 * Completed) plus every cancelled booking, whatever its travel date — newest first.
 *
 * `status` and `canCancel` are already derived by the booking data layer against the moment of the
 * read, so nothing here re-derives them: this module only decides which list a booking belongs to and
 * in what order the two lists read.
 *
 * No Express, no Prisma, no clock of its own — the instant is always passed in.
 */

/** The body of `GET /api/bookings`: the two tabs, each already ordered. */
export interface MyBookingsList {
  readonly upcoming: BookingRecord[];
  readonly past: BookingRecord[];
}

/** An ISO-8601 instant as milliseconds, treating unreadable text as the epoch rather than NaN. */
export function instantMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * True when the booking belongs on the Upcoming tab: a live booking on a bus that has not left yet.
 * A cancelled booking is never upcoming, even when its bus is still ahead.
 */
export function isUpcoming(booking: BookingRecord, now: Date): boolean {
  if (booking.status === 'CANCELLED') return false;
  return instantMs(booking.departureAt) > now.getTime();
}

/** Soonest departure first; a shared departure is settled by the older booking first. */
export function compareSoonestFirst(a: BookingRecord, b: BookingRecord): number {
  const byDeparture = instantMs(a.departureAt) - instantMs(b.departureAt);
  if (byDeparture !== 0) return byDeparture;
  return instantMs(a.createdAt) - instantMs(b.createdAt);
}

/** Newest departure first; a shared departure is settled by the newer booking first. */
export function compareNewestFirst(a: BookingRecord, b: BookingRecord): number {
  const byDeparture = instantMs(b.departureAt) - instantMs(a.departureAt);
  if (byDeparture !== 0) return byDeparture;
  return instantMs(b.createdAt) - instantMs(a.createdAt);
}

/** One account's bookings as the two ordered tabs the My bookings screen draws. */
export function splitBookings(bookings: readonly BookingRecord[], now: Date): MyBookingsList {
  const upcoming = bookings.filter((booking: BookingRecord) => isUpcoming(booking, now));
  const past = bookings.filter((booking: BookingRecord) => !isUpcoming(booking, now));
  upcoming.sort(compareSoonestFirst);
  past.sort(compareNewestFirst);
  return { upcoming, past };
}
