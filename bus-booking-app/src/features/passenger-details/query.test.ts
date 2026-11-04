import { describe, expect, it } from 'vitest';
import { MAX_SEATS_PER_BOOKING } from '../../models/bookings/index.js';
import {
  bookingConfirmedPath,
  parsePassengerQuery,
  passengerDetailsPath,
  seatMapPath,
  tripDetailRequestPath,
} from './query.js';

describe('parsePassengerQuery', () => {
  it('reads a comma separated seat list and the boarding point', () => {
    const query = parsePassengerQuery('?seats=A1,A2&boarding=bp-shivaji');
    expect(query.seats).toEqual(['A1', 'A2']);
    expect(query.boardingPointId).toBe('bp-shivaji');
  });

  it('accepts repeated seat parameters and trims blanks', () => {
    const query = parsePassengerQuery('seats=A1&seats=%20A2%20&seats=');
    expect(query.seats).toEqual(['A1', 'A2']);
  });

  it('drops repeated seats whatever their casing', () => {
    expect(parsePassengerQuery('?seats=a1,A1,B2').seats).toEqual(['a1', 'B2']);
  });

  it('never keeps more seats than a booking may hold', () => {
    const query = parsePassengerQuery('?seats=S1,S2,S3,S4,S5,S6,S7,S8');
    expect(query.seats).toHaveLength(MAX_SEATS_PER_BOOKING);
  });

  it('reports no seats and no boarding point for an empty query', () => {
    const query = parsePassengerQuery('');
    expect(query.seats).toEqual([]);
    expect(query.boardingPointId).toBe('');
  });
});

describe('addresses', () => {
  it('asks the API for one trip', () => {
    expect(tripDetailRequestPath('trip-morning-star')).toBe('/trips/trip-morning-star');
  });

  it('sends a traveller back to that bus seat map', () => {
    expect(seatMapPath('trip-morning-star')).toBe('/trips/trip-morning-star/seats');
  });

  it('opens the confirmed ticket by its human reference', () => {
    expect(bookingConfirmedPath('BB-10452')).toBe('/bookings/BB-10452/confirmed');
  });

  it('builds its own address from a seat choice', () => {
    const path = passengerDetailsPath('trip-morning-star', {
      seats: ['A1', 'A2'],
      boardingPointId: 'bp-shivaji',
    });
    expect(path).toBe('/trips/trip-morning-star/passengers?seats=A1%2CA2&boarding=bp-shivaji');
    expect(parsePassengerQuery(path.slice(path.indexOf('?'))).seats).toEqual(['A1', 'A2']);
  });

  it('leaves the query off when nothing is chosen', () => {
    expect(passengerDetailsPath('trip-1', { seats: [], boardingPointId: '' })).toBe('/trips/trip-1/passengers');
  });
});
