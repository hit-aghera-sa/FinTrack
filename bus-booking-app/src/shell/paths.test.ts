import { describe, it, expect } from 'vitest';
import {
  APP_PATHS,
  bookingConfirmedPath,
  bookingTicketPath,
  passengerDetailsPath,
  seatSelectionPath,
} from './paths.js';

describe('the app route table', () => {
  it('starts at the front door', () => {
    expect(APP_PATHS.home).toBe('/');
  });

  it('declares every address exactly once, rooted', () => {
    const paths = Object.values(APP_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith('/')).toBe(true);
  });

  it('builds the record addresses the registered patterns match', () => {
    expect(seatSelectionPath('trip-pune-mumbai')).toBe('/trips/trip-pune-mumbai/seats');
    expect(passengerDetailsPath('trip-pune-mumbai')).toBe('/trips/trip-pune-mumbai/passengers');
    expect(bookingTicketPath('BB-10042')).toBe('/bookings/BB-10042');
    expect(bookingConfirmedPath('BB-10042')).toBe('/bookings/BB-10042/confirmed');
  });

  it('escapes a value that would otherwise change the address', () => {
    expect(seatSelectionPath('a/b')).toBe('/trips/a%2Fb/seats');
  });
});
