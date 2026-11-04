import { describe, expect, it } from 'vitest';
import { ApiError, offlineError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  MY_BOOKINGS_PATH,
  SEARCH_PATH,
  bookingIdFromPath,
  bookingTicketRequestPath,
  confirmedPathFor,
  describeBookingError,
  passengerLabel,
  seatListLabel,
} from './booking-path.js';

describe('bookingIdFromPath', () => {
  it('reads the booking reference off the confirmed address', () => {
    expect(bookingIdFromPath('/bookings/BB-10452/confirmed')).toBe('BB-10452');
  });

  it('tolerates a trailing slash and a query string', () => {
    expect(bookingIdFromPath('/bookings/BB-10452/confirmed/?from=review')).toBe('BB-10452');
  });

  it('also reads the shorter preview address', () => {
    expect(bookingIdFromPath('/booking-confirmed/BB-10452')).toBe('BB-10452');
  });

  it('is null for any other path', () => {
    expect(bookingIdFromPath('/bookings')).toBeNull();
    expect(bookingIdFromPath('/bookings/BB-10452')).toBeNull();
    expect(bookingIdFromPath('/search')).toBeNull();
  });
});

describe('addresses', () => {
  it('builds the screen address for a booking', () => {
    expect(confirmedPathFor('BB-10452')).toBe('/bookings/BB-10452/confirmed');
  });

  it('builds the ticket request path', () => {
    expect(bookingTicketRequestPath('BB-10452')).toBe('/bookings/BB-10452');
  });

  it('points its two actions at the app\'s own pages', () => {
    expect(MY_BOOKINGS_PATH).toBe('/bookings');
    expect(SEARCH_PATH).toBe('/search');
  });
});

describe('labels', () => {
  it('lists the seats on one line', () => {
    expect(seatListLabel(['A1', 'A2'])).toBe('A1, A2');
  });

  it('says so when no seat is assigned', () => {
    expect(seatListLabel([])).toBe('Not assigned');
  });

  it('names the passenger with their seat, age and gender', () => {
    expect(passengerLabel({ seatNumber: 'A1', name: 'Ramesh Kulkarni', age: 34, gender: 'MALE' })).toBe(
      'A1 · Ramesh Kulkarni (34, Male)',
    );
  });
});

describe('describeBookingError', () => {
  it('uses the catalogue sentence when the backend was unreachable', () => {
    expect(describeBookingError(offlineError())).toBe(MESSAGES.offline);
  });

  it('explains a missing booking', () => {
    expect(describeBookingError(new ApiError(404, 'not_found', 'Booking not found.'))).toBe(
      BOOKING_NOT_FOUND_MESSAGE,
    );
  });

  it('passes any other API sentence through', () => {
    expect(describeBookingError(new ApiError(401, 'unauthorised', 'Please log in to continue.'))).toBe(
      'Please log in to continue.',
    );
  });
});
