import { describe, expect, it } from 'vitest';
import { buildSeatGrid } from '../../models/common/seat-map.js';
import { isBookingId } from '../../models/common/booking-id.js';
import {
  DEMO_TRAVELLER,
  OTHER_TRAVELLER,
  SEED_BOOKINGS,
  SEED_BOOKING_IDS,
  SEED_BUSES,
  SEED_CITY_NAMES,
  TRIP_IDS,
  buildTripSchedule,
  normaliseSecurityAnswer,
  type SeedTripRow,
} from './seed-data.js';

const NOW = new Date('2024-06-01T09:00:00.000Z');

function tripOf(trips: readonly SeedTripRow[], tripId: string): SeedTripRow {
  const trip = trips.find((candidate) => candidate.id === tripId);
  if (trip === undefined) throw new Error(`missing seed trip ${tripId}`);
  return trip;
}

describe('buildTripSchedule', () => {
  const trips = buildTripSchedule(NOW);

  it('creates one trip per sample route', () => {
    expect(trips.map((trip) => trip.id)).toEqual([
      TRIP_IDS.upcoming,
      TRIP_IDS.departingSoon,
      TRIP_IDS.departed,
      TRIP_IDS.soldOut,
      TRIP_IDS.later,
    ]);
  });

  it('puts one departure inside the next hour', () => {
    const soon = tripOf(trips, TRIP_IDS.departingSoon);
    const minutesAway = (soon.departureAt.getTime() - NOW.getTime()) / 60000;
    expect(minutesAway).toBeGreaterThan(0);
    expect(minutesAway).toBeLessThan(60);
  });

  it('puts one departure in the past and the rest in the future', () => {
    expect(tripOf(trips, TRIP_IDS.departed).departureAt.getTime()).toBeLessThan(NOW.getTime());
    for (const id of [TRIP_IDS.upcoming, TRIP_IDS.soldOut, TRIP_IDS.later]) {
      const departure = tripOf(trips, id).departureAt.getTime();
      expect(departure - NOW.getTime()).toBeGreaterThan(3600000);
    }
  });

  it('always arrives after it departs, on a known bus and known cities', () => {
    for (const trip of trips) {
      expect(trip.arrivalAt.getTime()).toBeGreaterThan(trip.departureAt.getTime());
      expect(SEED_BUSES.some((bus) => bus.id === trip.busId)).toBe(true);
      expect(SEED_CITY_NAMES).toContain(trip.fromCity);
      expect(SEED_CITY_NAMES).toContain(trip.toCity);
      expect(trip.fromCity).not.toBe(trip.toCity);
      expect(Number.isInteger(trip.farePerSeat)).toBe(true);
    }
  });
});

describe('seed bookings', () => {
  const trips = buildTripSchedule(NOW);

  it('uses BB-##### ids, all distinct', () => {
    expect(SEED_BOOKING_IDS).toHaveLength(SEED_BOOKINGS.length);
    expect(new Set(SEED_BOOKING_IDS).size).toBe(SEED_BOOKINGS.length);
    for (const id of SEED_BOOKING_IDS) {
      expect(isBookingId(id)).toBe(true);
    }
  });

  it('covers the Booked, Completed and Cancelled shapes for the demo traveller', () => {
    const demoStatuses = SEED_BOOKINGS.filter((booking) => booking.owner === 'demo').map((booking) => booking.status);
    expect(demoStatuses).toContain('Booked');
    expect(demoStatuses).toContain('Completed');
    expect(demoStatuses).toContain('Cancelled');
  });

  it('releases the seats of a cancelled booking but keeps its passengers', () => {
    const cancelled = SEED_BOOKINGS.filter((booking) => booking.status === 'Cancelled');
    expect(cancelled.length).toBeGreaterThan(0);
    for (const booking of cancelled) {
      expect(booking.holdsSeats).toBe(false);
      expect(booking.cancelledHoursAgo).toBeDefined();
      expect(booking.passengers.length).toBeGreaterThan(0);
    }
  });

  it('books one passenger per seat, 1 to 6 seats, on seats the trip really has', () => {
    for (const booking of SEED_BOOKINGS) {
      const trip = tripOf(trips, booking.tripId);
      const bus = SEED_BUSES.find((candidate) => candidate.id === trip.busId);
      if (bus === undefined) throw new Error(`missing seed bus ${trip.busId}`);
      const seatNumbers = buildSeatGrid(bus.seatRows, bus.seatColumns).map((seat) => seat.seatNumber);
      const booked = booking.passengers.map((passenger) => passenger.seatNumber);

      expect(booked.length).toBeGreaterThanOrEqual(1);
      expect(booked.length).toBeLessThanOrEqual(6);
      expect(new Set(booked).size).toBe(booked.length);
      for (const seatNumber of booked) {
        expect(seatNumbers).toContain(seatNumber);
      }
      expect(bus.boardingPoints.some((point) => point.id === booking.boardingPointId)).toBe(true);
    }
  });

  it('never gives the same seat on one trip to two bookings that hold it', () => {
    const held = new Map<string, number>();
    for (const booking of SEED_BOOKINGS) {
      if (!booking.holdsSeats) continue;
      for (const passenger of booking.passengers) {
        const key = `${booking.tripId}:${passenger.seatNumber}`;
        held.set(key, (held.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of held) {
      expect(count, `seat ${key} is held twice`).toBe(1);
    }
  });

  it('fills every seat of the sold-out trip', () => {
    const trip = tripOf(trips, TRIP_IDS.soldOut);
    const bus = SEED_BUSES.find((candidate) => candidate.id === trip.busId);
    if (bus === undefined) throw new Error('missing sold-out bus');
    const heldSeats = SEED_BOOKINGS.filter(
      (booking) => booking.tripId === TRIP_IDS.soldOut && booking.holdsSeats,
    ).reduce((total, booking) => total + booking.passengers.length, 0);
    expect(heldSeats).toBe(bus.seatRows * bus.seatColumns);
  });
});

describe('seed travellers', () => {
  it('use valid, distinct Indian mobile numbers', () => {
    for (const traveller of [DEMO_TRAVELLER, OTHER_TRAVELLER]) {
      expect(traveller.mobileNumber).toMatch(/^[6-9]\d{9}$/);
      expect(traveller.fullName.length).toBeGreaterThanOrEqual(2);
      expect(traveller.password).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/);
    }
    expect(DEMO_TRAVELLER.mobileNumber).not.toBe(OTHER_TRAVELLER.mobileNumber);
  });
});

describe('normaliseSecurityAnswer', () => {
  it('trims and lower-cases so the answer is compared case-insensitively', () => {
    expect(normaliseSecurityAnswer('  Meera ')).toBe('meera');
  });
});
