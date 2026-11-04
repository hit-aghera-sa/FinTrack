import { describe, expect, it } from 'vitest';
import { istClock, resolveBookingNames, textArrayLiteral, type BookingSchemaRow } from './prisma-source.js';

const PRISMA_SCHEMA: BookingSchemaRow[] = [
  { table: 'Booking', column: 'id', dataType: 'text' },
  { table: 'Booking', column: 'userId', dataType: 'text' },
  { table: 'Booking', column: 'tripId', dataType: 'text' },
  { table: 'Booking', column: 'boardingPointId', dataType: 'text' },
  { table: 'Booking', column: 'status', dataType: 'text' },
  { table: 'Booking', column: 'totalFare', dataType: 'integer' },
  { table: 'Booking', column: 'createdAt', dataType: 'timestamp with time zone' },
  { table: 'Booking', column: 'cancelledAt', dataType: 'timestamp with time zone' },
  { table: 'Passenger', column: 'id', dataType: 'text' },
  { table: 'Passenger', column: 'bookingId', dataType: 'text' },
  { table: 'Passenger', column: 'seatNumber', dataType: 'text' },
  { table: 'Passenger', column: 'name', dataType: 'text' },
  { table: 'Passenger', column: 'age', dataType: 'integer' },
  { table: 'Passenger', column: 'gender', dataType: 'text' },
  { table: 'Seat', column: 'id', dataType: 'text' },
  { table: 'Seat', column: 'tripId', dataType: 'text' },
  { table: 'Seat', column: 'seatNumber', dataType: 'text' },
  { table: 'Seat', column: 'isBooked', dataType: 'boolean' },
  { table: 'Trip', column: 'id', dataType: 'text' },
  { table: 'Trip', column: 'busId', dataType: 'text' },
  { table: 'Trip', column: 'departureAt', dataType: 'timestamp with time zone' },
];

const SNAKE_SCHEMA: BookingSchemaRow[] = [
  { table: 'bookings', column: 'id', dataType: 'uuid' },
  { table: 'bookings', column: 'booking_reference', dataType: 'character varying' },
  { table: 'bookings', column: 'user_id', dataType: 'uuid' },
  { table: 'bookings', column: 'trip_id', dataType: 'uuid' },
  { table: 'bookings', column: 'bus_id', dataType: 'uuid' },
  { table: 'bookings', column: 'travel_date', dataType: 'date' },
  { table: 'bookings', column: 'departure_time', dataType: 'time without time zone' },
  { table: 'bookings', column: 'seat_numbers', dataType: 'ARRAY' },
  { table: 'bookings', column: 'total_fare', dataType: 'integer' },
  { table: 'bookings', column: 'cancelled_at', dataType: 'timestamp with time zone' },
  { table: 'passengers', column: 'id', dataType: 'integer' },
  { table: 'passengers', column: 'booking_id', dataType: 'uuid' },
  { table: 'passengers', column: 'seat_number', dataType: 'character varying' },
  { table: 'passengers', column: 'full_name', dataType: 'character varying' },
  { table: 'passengers', column: 'age', dataType: 'integer' },
  { table: 'passengers', column: 'gender', dataType: 'character varying' },
  { table: 'seats', column: 'bus_id', dataType: 'uuid' },
  { table: 'seats', column: 'travel_date', dataType: 'date' },
  { table: 'seats', column: 'seat_number', dataType: 'character varying' },
  { table: 'seats', column: 'state', dataType: 'character varying' },
  { table: 'trips', column: 'id', dataType: 'uuid' },
  { table: 'trips', column: 'bus_id', dataType: 'uuid' },
  { table: 'trips', column: 'travel_date', dataType: 'date' },
  { table: 'trips', column: 'departure_time', dataType: 'time without time zone' },
];

describe('resolveBookingNames', () => {
  it('reads the Prisma-style camelCase schema', () => {
    const names = resolveBookingNames(PRISMA_SCHEMA);

    expect(names.bookings.table).toBe('Booking');
    expect(names.bookings.id).toBe('id');
    expect(names.bookings.idIsUuid).toBe(false);
    expect(names.bookings.reference).toBeNull();
    expect(names.bookings.userId).toBe('userId');
    expect(names.bookings.tripId).toBe('tripId');
    expect(names.bookings.boardingPointId).toBe('boardingPointId');
    expect(names.bookings.status).toBe('status');
    expect(names.bookings.totalFare).toBe('totalFare');
    expect(names.bookings.createdAt).toBe('createdAt');
    expect(names.bookings.cancelledAt).toBe('cancelledAt');
    expect(names.bookings.seatNumbers).toBeNull();

    expect(names.passengers.table).toBe('Passenger');
    expect(names.passengers.bookingId).toBe('bookingId');
    expect(names.passengers.seatNumber).toBe('seatNumber');
    expect(names.passengers.name).toBe('name');
    expect(names.passengers.age).toBe('age');
    expect(names.passengers.gender).toBe('gender');

    expect(names.seats?.table).toBe('Seat');
    expect(names.seats?.tripId).toBe('tripId');
    expect(names.seats?.isBooked).toBe('isBooked');
    expect(names.seats?.state).toBeNull();

    expect(names.trips?.table).toBe('Trip');
    expect(names.trips?.departure).toBe('departureAt');
  });

  it('reads a snake_case schema, its reference column and its column types', () => {
    const names = resolveBookingNames(SNAKE_SCHEMA);

    expect(names.bookings.table).toBe('bookings');
    expect(names.bookings.id).toBe('id');
    expect(names.bookings.idIsUuid).toBe(true);
    expect(names.bookings.reference).toBe('booking_reference');
    expect(names.bookings.userId).toBe('user_id');
    expect(names.bookings.tripId).toBe('trip_id');
    expect(names.bookings.busId).toBe('bus_id');
    expect(names.bookings.travelDate).toBe('travel_date');
    expect(names.bookings.travelDateType).toBe('date');
    expect(names.bookings.departureTime).toBe('departure_time');
    expect(names.bookings.departureTimeType).toBe('time without time zone');
    expect(names.bookings.seatNumbers).toBe('seat_numbers');
    expect(names.bookings.seatNumbersType).toBe('array');
    expect(names.bookings.boardingPointId).toBeNull();

    expect(names.passengers.name).toBe('full_name');
    expect(names.passengers.idType).toBe('integer');

    expect(names.seats?.tripId).toBeNull();
    expect(names.seats?.busId).toBe('bus_id');
    expect(names.seats?.travelDate).toBe('travel_date');
    expect(names.seats?.state).toBe('state');

    expect(names.trips?.departure).toBe('departure_time');
  });

  it('says so plainly when the booking tables are absent', () => {
    expect(() => resolveBookingNames([{ table: 'City', column: 'id', dataType: 'text' }])).toThrow(
      /no Booking table/,
    );
    expect(() =>
      resolveBookingNames([
        { table: 'Booking', column: 'id', dataType: 'text' },
        { table: 'Booking', column: 'userId', dataType: 'text' },
        { table: 'Booking', column: 'tripId', dataType: 'text' },
      ]),
    ).toThrow(/no Passenger table/);
  });

  it('leaves the seat table out when it carries no seat number', () => {
    const names = resolveBookingNames([
      ...PRISMA_SCHEMA.filter((row) => row.table !== 'Seat'),
      { table: 'Seat', column: 'id', dataType: 'text' },
    ]);
    expect(names.seats).toBeNull();
  });
});

describe('SQL value helpers', () => {
  it('writes a Postgres text array literal', () => {
    expect(textArrayLiteral(['A1', 'A2'])).toBe('{"A1","A2"}');
    expect(textArrayLiteral([])).toBe('{}');
  });

  it('reads an instant as its India-time clock', () => {
    expect(istClock(new Date('2024-06-12T16:00:00.000Z'))).toBe('21:30:00');
    expect(istClock(new Date('2024-06-12T18:30:00.000Z'))).toBe('00:00:00');
  });
});
