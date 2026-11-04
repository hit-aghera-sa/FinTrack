import { describe, expect, it } from 'vitest';
import { MAX_SEATS_PER_BOOKING } from '../../models/bookings/index.js';
import {
  BOARDING_POINT_REQUIRED_MESSAGE,
  DUPLICATE_SEAT_MESSAGE,
  MAX_SEATS_MESSAGE,
  PASSENGER_AGE_MESSAGE,
  PASSENGER_GENDER_MESSAGE,
  PASSENGER_NAME_MESSAGE,
  SEAT_REQUIRED_MESSAGE,
  parseCreateBooking,
} from './validation.js';

function passenger(seatNumber: string, name = 'Alex QA'): Record<string, unknown> {
  return { seatNumber, name, age: 34, gender: 'MALE' };
}

describe('parseCreateBooking', () => {
  it('reads the approved request shape', () => {
    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: [passenger('A1'), { seatNumber: 'A2', name: 'Priya Lunch', age: 29, gender: 'female' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tripId).toBe('trip-a');
      expect(result.value.boardingPointId).toBe('bp-1');
      expect(result.value.passengers).toHaveLength(2);
      expect(result.value.passengers[0].seatNumber).toBe('A1');
      expect(result.value.passengers[1].gender).toBe('FEMALE');
    }
  });

  it('accepts the busId + seatNumbers spelling of the same request', () => {
    const result = parseCreateBooking({
      busId: 'trip-b',
      boardingPointId: 'bp-2',
      seatNumbers: ['B1', 'B2'],
      passengers: [
        { name: 'Alex QA', age: 40, gender: 'MALE' },
        { name: 'Priya Lunch', age: 12, gender: 'OTHER' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tripId).toBe('trip-b');
      expect(result.value.passengers.map((item) => item.seatNumber)).toEqual(['B1', 'B2']);
    }
  });

  it('refuses more than the six-seat ceiling', () => {
    const seats = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1'];
    expect(seats.length).toBeGreaterThan(MAX_SEATS_PER_BOOKING);

    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: seats.map((seatNumber: string) => passenger(seatNumber)),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(MAX_SEATS_MESSAGE);
  });

  it('refuses an empty selection', () => {
    const result = parseCreateBooking({ tripId: 'trip-a', boardingPointId: 'bp-1', passengers: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(SEAT_REQUIRED_MESSAGE);
  });

  it('refuses two passengers on one seat', () => {
    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: [passenger('A1'), passenger('a1', 'Priya Lunch')],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(DUPLICATE_SEAT_MESSAGE);
  });

  it('refuses a missing boarding point', () => {
    const result = parseCreateBooking({ tripId: 'trip-a', passengers: [passenger('A1')] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(BOARDING_POINT_REQUIRED_MESSAGE);
  });

  it('refuses a blank passenger name', () => {
    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: [{ seatNumber: 'A1', name: ' ', age: 30, gender: 'MALE' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(PASSENGER_NAME_MESSAGE);
  });

  it('refuses an age outside the allowed range', () => {
    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: [{ seatNumber: 'A1', name: 'Alex QA', age: 0, gender: 'MALE' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(PASSENGER_AGE_MESSAGE);
  });

  it('refuses a gender it cannot read', () => {
    const result = parseCreateBooking({
      tripId: 'trip-a',
      boardingPointId: 'bp-1',
      passengers: [{ seatNumber: 'A1', name: 'Alex QA', age: 30, gender: 'not-a-gender' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(PASSENGER_GENDER_MESSAGE);
  });

  it('refuses a body that is not an object at all', () => {
    const result = parseCreateBooking('book me a seat');

    expect(result.ok).toBe(false);
  });
});
