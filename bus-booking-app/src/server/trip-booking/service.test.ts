import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import type {
  BookingRecord,
  BookingRepository,
  CreateBookingCommand,
  CreateBookingResult,
} from '../../models/bookings/index.js';
import type { SeatInfo, TripDetail, TripRepository } from '../../models/catalogue/index.js';
import {
  BOARDING_POINT_NOT_ON_BUS_MESSAGE,
  TRIP_DEPARTED_MESSAGE,
  TRIP_NOT_FOUND_MESSAGE,
  createTripBookingService,
} from './service.js';
import { MAX_SEATS_MESSAGE } from './validation.js';

const TRIP_ID = 'trip-mumbai-pune-morning';
const BOARDING_POINT_ID = 'bp-dadar';
const NOW = new Date('2024-06-12T09:00:00.000Z');
const DEPARTURE = '2024-06-12T15:30:00.000Z';
const ARRIVAL = '2024-06-12T19:30:00.000Z';

function seat(number: string, row: number, column: number, isBooked = false): SeatInfo {
  return { number, row, column, isBooked };
}

function tripFixture(seats: readonly SeatInfo[], departureAt: string = DEPARTURE): TripDetail {
  const list = [...seats];
  return {
    id: TRIP_ID,
    busName: 'Sunrise Travels',
    busType: 'AC_SLEEPER',
    fromCity: { id: 'city-mumbai', name: 'Mumbai' },
    toCity: { id: 'city-pune', name: 'Pune' },
    departureAt,
    arrivalAt: ARRIVAL,
    farePerSeat: 900,
    seatsLeft: list.filter((item: SeatInfo) => !item.isBooked).length,
    totalSeats: list.length,
    seats: list,
    boardingPoints: [{ id: BOARDING_POINT_ID, name: 'Dadar', pickupAt: '2024-06-12T15:00:00.000Z' }],
  };
}

function defaultSeats(): SeatInfo[] {
  return [seat('A1', 1, 1), seat('A2', 1, 2), seat('B1', 2, 1), seat('B2', 2, 2), seat('C1', 3, 1), seat('C2', 3, 2), seat('D1', 4, 1), seat('D2', 4, 2)];
}

function fakeTrips(trip: TripDetail | null): Pick<TripRepository, 'findDetail'> {
  return {
    findDetail(tripId: string): Promise<TripDetail | null> {
      if (trip === null) return Promise.resolve(null);
      return Promise.resolve(tripId === trip.id ? trip : null);
    },
  };
}

function bookingFrom(command: CreateBookingCommand, trip: TripDetail, id: string): BookingRecord {
  const seatNumbers = command.passengers.map((passenger) => passenger.seatNumber);
  return {
    id,
    userId: command.userId,
    tripId: command.tripId,
    busName: trip.busName,
    busType: trip.busType,
    fromCityName: trip.fromCity.name,
    toCityName: trip.toCity.name,
    departureAt: trip.departureAt,
    arrivalAt: trip.arrivalAt,
    boardingPointName: 'Dadar',
    seatNumbers,
    passengers: [...command.passengers],
    farePerSeat: trip.farePerSeat,
    totalFare: trip.farePerSeat * seatNumbers.length,
    status: 'BOOKED',
    canCancel: true,
    createdAt: NOW.toISOString(),
    cancelledAt: null,
  };
}

interface FakeBookings extends Pick<BookingRepository, 'create'> {
  readonly calls: CreateBookingCommand[];
}

/**
 * A booking writer that behaves the way the real transaction does: the seat check and the seat claim
 * happen together, with no await between them, so two creates racing for one seat produce exactly
 * one booking and one named conflict.
 */
function fakeBookings(trip: TripDetail): FakeBookings {
  const taken = new Set<string>(
    trip.seats.filter((item: SeatInfo) => item.isBooked).map((item: SeatInfo) => item.number),
  );
  const calls: CreateBookingCommand[] = [];
  let serial = 10_450;

  return {
    calls,
    create(command: CreateBookingCommand): Promise<CreateBookingResult> {
      calls.push(command);
      for (const passenger of command.passengers) {
        if (taken.has(passenger.seatNumber)) {
          return Promise.resolve({ ok: false, conflictSeat: passenger.seatNumber });
        }
      }
      for (const passenger of command.passengers) taken.add(passenger.seatNumber);
      serial += 1;
      return Promise.resolve({ ok: true, booking: bookingFrom(command, trip, `BB-${serial}`) });
    },
  };
}

function requestBody(seats: readonly string[]): unknown {
  return {
    tripId: TRIP_ID,
    boardingPointId: BOARDING_POINT_ID,
    passengers: seats.map((seatNumber: string, index: number) => ({
      seatNumber,
      name: index === 0 ? 'Alex QA' : `Priya QA run-${seatNumber}`,
      age: 28 + index,
      gender: index % 2 === 0 ? 'MALE' : 'FEMALE',
    })),
  };
}

describe('trip booking service — seat map', () => {
  it('returns the bus with its seat map and boarding points', async () => {
    const trip = tripFixture(defaultSeats());
    const service = createTripBookingService({
      trips: fakeTrips(trip),
      bookings: fakeBookings(trip),
      now: () => NOW,
    });

    const outcome = await service.seatMap(TRIP_ID);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.trip.seats).toHaveLength(8);
      expect(outcome.trip.boardingPoints[0].id).toBe(BOARDING_POINT_ID);
      expect(outcome.trip.farePerSeat).toBe(900);
    }
  });

  it('refuses a bus that is not in the catalogue', async () => {
    const trip = tripFixture(defaultSeats());
    const service = createTripBookingService({
      trips: fakeTrips(trip),
      bookings: fakeBookings(trip),
      now: () => NOW,
    });

    const outcome = await service.seatMap('trip-that-never-existed');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(404);
      expect(outcome.code).toBe('TRIP_NOT_FOUND');
      expect(outcome.message).toBe(TRIP_NOT_FOUND_MESSAGE);
    }
  });
});

describe('trip booking service — booking creation', () => {
  it('creates a booking with its seat numbers, passengers and total fare', async () => {
    const trip = tripFixture(defaultSeats());
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking('user-anita', requestBody(['A1', 'A2']));

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.booking.seatNumbers).toEqual(['A1', 'A2']);
      expect(outcome.booking.passengers).toHaveLength(2);
      expect(outcome.booking.totalFare).toBe(1800);
      expect(outcome.booking.id.startsWith('BB-')).toBe(true);
    }
    expect(bookings.calls).toHaveLength(1);
  });

  it('refuses a seventh seat and never reaches the booking writer', async () => {
    const trip = tripFixture(defaultSeats());
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking(
      'user-anita',
      requestBody(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1']),
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.code).toBe('INVALID_REQUEST');
      expect(outcome.message).toBe(MAX_SEATS_MESSAGE);
    }
    expect(bookings.calls).toHaveLength(0);
  });

  it('refuses a seat that is already booked, naming it, and writes nothing', async () => {
    const seats = defaultSeats();
    seats[1] = seat('A2', 1, 2, true);
    const trip = tripFixture(seats);
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking('user-anita', requestBody(['A1', 'A2']));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(409);
      expect(outcome.code).toBe('SEAT_TAKEN');
      expect(outcome.conflictSeat).toBe('A2');
      expect(outcome.message).toBe(MESSAGES.seatJustBooked('A2'));
    }
    expect(bookings.calls).toHaveLength(0);
  });

  it('sells a contested seat exactly once when two travellers confirm together', async () => {
    const trip = tripFixture(defaultSeats());
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const [first, second] = await Promise.all([
      service.createBooking('user-anita', requestBody(['A1'])),
      service.createBooking('user-rahul', requestBody(['A1'])),
    ]);

    const succeeded = [first, second].filter((outcome) => outcome.ok);
    const refused = [first, second].filter((outcome) => !outcome.ok);

    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const conflict = refused[0];
    if (!conflict.ok) {
      expect(conflict.status).toBe(409);
      expect(conflict.code).toBe('SEAT_TAKEN');
      expect(conflict.conflictSeat).toBe('A1');
      expect(conflict.message).toBe(MESSAGES.seatJustBooked('A1'));
    }
  });

  it('refuses a bus that has already departed', async () => {
    const trip = tripFixture(defaultSeats(), '2024-06-12T08:00:00.000Z');
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking('user-anita', requestBody(['A1']));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(409);
      expect(outcome.code).toBe('TRIP_DEPARTED');
      expect(outcome.message).toBe(TRIP_DEPARTED_MESSAGE);
    }
    expect(bookings.calls).toHaveLength(0);
  });

  it('refuses a boarding point that belongs to another bus', async () => {
    const trip = tripFixture(defaultSeats());
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking('user-anita', {
      tripId: TRIP_ID,
      boardingPointId: 'bp-of-another-bus',
      passengers: [{ seatNumber: 'A1', name: 'Alex QA', age: 31, gender: 'MALE' }],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.code).toBe('INVALID_BOARDING_POINT');
      expect(outcome.message).toBe(BOARDING_POINT_NOT_ON_BUS_MESSAGE);
    }
    expect(bookings.calls).toHaveLength(0);
  });

  it('refuses a seat that is not on that bus', async () => {
    const trip = tripFixture(defaultSeats());
    const bookings = fakeBookings(trip);
    const service = createTripBookingService({ trips: fakeTrips(trip), bookings, now: () => NOW });

    const outcome = await service.createBooking('user-anita', requestBody(['Z9']));

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.code).toBe('INVALID_REQUEST');
      expect(outcome.message).toContain('Z9');
    }
    expect(bookings.calls).toHaveLength(0);
  });
});
