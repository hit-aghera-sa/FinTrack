import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import type { TripDetail } from '../../models/catalogue/index.js';
import {
  boardingPointFor,
  boardingPointLabel,
  conflictSeatFrom,
  describeBookingError,
  isSeatTakenError,
  seatTakenMessage,
  summaryRows,
  totalFare,
} from './summary.js';

const TRIP: TripDetail = {
  id: 'trip-morning-star',
  busName: 'Morning Star Travels',
  busType: 'AC_SEATER',
  fromCity: { id: 'city-pune', name: 'Pune' },
  toCity: { id: 'city-mumbai', name: 'Mumbai' },
  departureAt: '2031-03-04T03:30:00.000Z',
  arrivalAt: '2031-03-04T08:00:00.000Z',
  farePerSeat: 650,
  seatsLeft: 12,
  totalSeats: 30,
  seats: [
    { number: 'A1', row: 1, column: 1, isBooked: false },
    { number: 'A2', row: 1, column: 2, isBooked: false },
  ],
  boardingPoints: [
    { id: 'bp-shivaji', name: 'Shivajinagar', pickupAt: '2031-03-04T03:10:00.000Z' },
    { id: 'bp-wakad', name: 'Wakad', pickupAt: 'Opposite the toll plaza' },
  ],
};

describe('totalFare', () => {
  it('is one fare per chosen seat', () => {
    expect(totalFare(650, 2)).toBe(1300);
    expect(totalFare(650, 0)).toBe(0);
  });
});

describe('boarding point', () => {
  it('resolves the chosen point', () => {
    expect(boardingPointFor(TRIP, 'bp-wakad')?.name).toBe('Wakad');
  });

  it('falls back to the first point of the bus', () => {
    expect(boardingPointFor(TRIP, 'bp-unknown')?.name).toBe('Shivajinagar');
  });

  it('shows the pickup time when the stored value is an instant', () => {
    const label = boardingPointLabel(boardingPointFor(TRIP, 'bp-shivaji'));
    expect(label.startsWith('Shivajinagar · ')).toBe(true);
    expect(label).toContain('AM');
  });

  it('passes stored pickup text through unchanged', () => {
    expect(boardingPointLabel(boardingPointFor(TRIP, 'bp-wakad'))).toBe('Wakad · Opposite the toll plaza');
  });

  it('says so when the bus has none', () => {
    expect(boardingPointLabel(null)).toBe('Not selected');
  });
});

describe('summaryRows', () => {
  it('states bus, date, departure time, boarding point, seats and fares', () => {
    const rows = summaryRows(TRIP, ['A1', 'A2'], 'Shivajinagar');
    const value = (key: string): string => rows.find((row) => row.key === key)?.value ?? '';

    expect(rows.map((row) => row.label)).toEqual([
      'Bus',
      'Route',
      'Travel date',
      'Departure time',
      'Boarding point',
      'Seat numbers',
      'Fare per seat',
      'Total fare',
    ]);
    expect(value('bus')).toContain('Morning Star Travels');
    expect(value('route')).toBe('Pune to Mumbai');
    expect(value('date')).toBe('04/03/2031');
    expect(value('departure')).toContain('AM');
    expect(value('boarding')).toBe('Shivajinagar');
    expect(value('seats')).toBe('A1, A2');
    expect(value('fare')).toBe('₹650');
    expect(value('total')).toBe('₹1,300');
    expect(rows.find((row) => row.key === 'total')?.emphasis).toBe(true);
  });
});

describe('a seat taken a moment earlier', () => {
  it('recognises the booking API refusal', () => {
    expect(isSeatTakenError(new ApiError(409, 'SEAT_TAKEN', 'taken'))).toBe(true);
    expect(isSeatTakenError(new ApiError(400, 'seat_taken', 'taken'))).toBe(true);
    expect(isSeatTakenError(new ApiError(500, 'server_error', 'boom'))).toBe(false);
    expect(isSeatTakenError(new Error('boom'))).toBe(false);
  });

  it('names the seat the server reported', () => {
    const error = new ApiError(409, 'SEAT_TAKEN', 'Sorry, seat A2 was just booked. Please choose another seat.');
    expect(conflictSeatFrom(error, ['A1', 'A2'])).toBe('A2');
    expect(seatTakenMessage(error, ['A1', 'A2'])).toBe(MESSAGES.seatJustBooked('A2'));
  });

  it('falls back to the first chosen seat when the message names none of them', () => {
    const error = new ApiError(409, 'SEAT_TAKEN', 'A seat you chose is no longer available.');
    expect(conflictSeatFrom(error, ['A1', 'A2'])).toBe('A1');
  });
});

describe('describeBookingError', () => {
  it('uses the no-internet sentence when the backend was unreachable', () => {
    expect(describeBookingError(new ApiError(0, 'offline', MESSAGES.offline))).toBe(MESSAGES.offline);
  });

  it('repeats what the server said', () => {
    expect(describeBookingError(new ApiError(404, 'not_found', 'That bus is no longer available.'))).toBe(
      'That bus is no longer available.',
    );
  });

  it('has a sentence for anything else', () => {
    expect(describeBookingError('boom')).toBe('Something went wrong. Please try again.');
  });
});
