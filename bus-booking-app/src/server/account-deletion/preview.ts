import type { BookingCounts, BookingTimingRecord } from './types.js';

/**
 * THE HONEST WARNING, as pure arithmetic.
 *
 * A booking is UPCOMING when it has not been cancelled and its bus has not left yet — those are the
 * ones whose seats go straight back to the available pool when the account is deleted. Everything
 * else (travelled, or already cancelled) is PAST.
 *
 * Nothing here touches a database or a clock of its own: the instant of the read is passed in.
 */
export function isUpcomingBooking(booking: BookingTimingRecord, now: Date): boolean {
  if (booking.status === 'CANCELLED') return false;
  const departure = Date.parse(booking.departureAt);
  // An unparseable departure can still be judged by the status the data layer derived.
  if (Number.isNaN(departure)) return booking.status === 'BOOKED';
  return departure > now.getTime();
}

export function summariseBookings(bookings: readonly BookingTimingRecord[], now: Date): BookingCounts {
  let upcomingBookings = 0;
  let pastBookings = 0;
  for (const booking of bookings) {
    if (isUpcomingBooking(booking, now)) {
      upcomingBookings += 1;
    } else {
      pastBookings += 1;
    }
  }
  return { upcomingBookings, pastBookings };
}
