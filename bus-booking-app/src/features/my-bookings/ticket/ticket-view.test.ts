import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/index.js';
import { formatDate, formatTime } from '../../../format/index.js';
import { MESSAGES } from '../../../messages/index.js';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  EMPTY_VALUE,
  TICKET_NOT_YOURS_MESSAGE,
  TICKET_UNAVAILABLE_MESSAGE,
  arrivalLabel,
  bookingIdFromPathname,
  canCancelNow,
  cancelNoteFor,
  describeTicketError,
  isMissingTicket,
  passengerMetaLabel,
  seatListLabel,
  statusLabel,
  ticketRequestPath,
} from './ticket-view.js';

describe('the ticket address', () => {
  it('reads the booking out of the address', () => {
    expect(bookingIdFromPathname('/bookings/BB-10452')).toBe('BB-10452');
  });

  it('has no booking for the list address', () => {
    expect(bookingIdFromPathname('/bookings')).toBeNull();
    expect(bookingIdFromPathname('/profile')).toBeNull();
  });

  it('asks the backend for that one booking', () => {
    expect(ticketRequestPath('BB-10452')).toBe('/bookings/BB-10452');
  });
});

describe('the ticket lines', () => {
  it('states the status in words', () => {
    expect(statusLabel('BOOKED')).toBe('Booked');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
    expect(statusLabel('COMPLETED')).toBe('Completed');
  });

  it('lists the seats on one line, and says so when there are none', () => {
    expect(seatListLabel(['A1', 'A2'])).toBe('A1, A2');
    expect(seatListLabel([])).toBe(EMPTY_VALUE);
  });

  it('puts the age and gender beside the passenger name', () => {
    expect(passengerMetaLabel({ age: 34, gender: 'MALE' })).toContain('34 years');
  });

  it('shows only the time when the bus arrives on the travel day', () => {
    const departureAt = '2024-06-12T06:00:00.000Z';
    const arrivalAt = '2024-06-12T11:30:00.000Z';
    expect(arrivalLabel({ departureAt, arrivalAt })).toBe(formatTime(arrivalAt));
  });

  it('adds the arrival day when the bus arrives later', () => {
    const departureAt = '2024-06-12T16:00:00.000Z';
    const arrivalAt = '2024-06-13T02:00:00.000Z';
    const label = arrivalLabel({ departureAt, arrivalAt });
    expect(label).toContain(formatTime(arrivalAt));
    expect(label).toContain(formatDate(arrivalAt));
  });
});

describe('the cancel affordance', () => {
  it('is offered only for a booked, still-cancellable booking', () => {
    expect(canCancelNow({ status: 'BOOKED', canCancel: true })).toBe(true);
    expect(canCancelNow({ status: 'BOOKED', canCancel: false })).toBe(false);
    expect(canCancelNow({ status: 'CANCELLED', canCancel: true })).toBe(false);
    expect(canCancelNow({ status: 'COMPLETED', canCancel: true })).toBe(false);
    expect(canCancelNow(null)).toBe(false);
  });

  it('explains itself when it is withheld', () => {
    expect(cancelNoteFor({ status: 'CANCELLED', id: 'BB-10452' })).toBe(MESSAGES.bookingCancelled('BB-10452'));
    expect(cancelNoteFor({ status: 'BOOKED', id: 'BB-10452' })).toBe(MESSAGES.cancelNotAllowed);
    expect(cancelNoteFor({ status: 'COMPLETED', id: 'BB-10452' })).toContain('complete');
  });
});

describe('describeTicketError', () => {
  it('treats an unknown or someone else\u2019s booking as not found', () => {
    expect(describeTicketError(new ApiError(404, 'not_found', 'nope'))).toBe(BOOKING_NOT_FOUND_MESSAGE);
    expect(describeTicketError(new ApiError(403, 'forbidden', 'nope'))).toBe(BOOKING_NOT_FOUND_MESSAGE);
    expect(isMissingTicket(new ApiError(404, 'not_found', 'nope'))).toBe(true);
    expect(isMissingTicket(new ApiError(500, 'oops', 'nope'))).toBe(false);
  });

  it('asks a signed-out traveller to log in again', () => {
    expect(describeTicketError(new ApiError(401, 'not_signed_in', 'nope'))).toBe(TICKET_NOT_YOURS_MESSAGE);
  });

  it('uses the no-internet sentence when the backend was never reached', () => {
    expect(describeTicketError(new ApiError(0, 'offline', MESSAGES.offline))).toBe(MESSAGES.offline);
  });

  it('passes the backend\u2019s own sentence through, and falls back otherwise', () => {
    expect(describeTicketError(new ApiError(500, 'unavailable', 'Please try again later.'))).toBe(
      'Please try again later.',
    );
    expect(describeTicketError(new Error('something odd'))).toBe(TICKET_UNAVAILABLE_MESSAGE);
  });
});
