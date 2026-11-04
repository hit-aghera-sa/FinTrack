import { describe, expect, it } from 'vitest';
import { isUpcomingBooking, summariseBookings } from './preview.js';
import type { BookingTimingRecord } from './types.js';

const NOW = new Date('2024-06-12T06:00:00.000Z');

function booking(status: BookingTimingRecord['status'], departureAt: string): BookingTimingRecord {
  return { status, departureAt };
}

describe('the deletion preview counts', () => {
  it('counts a booked trip that has not left yet as upcoming', () => {
    expect(isUpcomingBooking(booking('BOOKED', '2024-06-14T10:00:00.000Z'), NOW)).toBe(true);
  });

  it('counts a booked trip that has already left as past', () => {
    expect(isUpcomingBooking(booking('BOOKED', '2024-06-01T10:00:00.000Z'), NOW)).toBe(false);
  });

  it('never counts a cancelled booking as upcoming, even for a future bus', () => {
    expect(isUpcomingBooking(booking('CANCELLED', '2024-07-01T10:00:00.000Z'), NOW)).toBe(false);
  });

  it('falls back to the derived status when the departure is not a real instant', () => {
    expect(isUpcomingBooking(booking('BOOKED', 'not-an-instant'), NOW)).toBe(true);
    expect(isUpcomingBooking(booking('COMPLETED', 'not-an-instant'), NOW)).toBe(false);
  });

  it('splits a traveller history into upcoming and past', () => {
    const counts = summariseBookings(
      [
        booking('BOOKED', '2024-06-14T10:00:00.000Z'),
        booking('BOOKED', '2024-06-20T10:00:00.000Z'),
        booking('COMPLETED', '2024-05-01T10:00:00.000Z'),
        booking('CANCELLED', '2024-07-01T10:00:00.000Z'),
      ],
      NOW,
    );
    expect(counts).toEqual({ upcomingBookings: 2, pastBookings: 2 });
  });

  it('counts nothing for an account with no bookings', () => {
    expect(summariseBookings([], NOW)).toEqual({ upcomingBookings: 0, pastBookings: 0 });
  });
});
