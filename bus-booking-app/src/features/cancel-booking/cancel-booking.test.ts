import { describe, expect, it } from 'vitest';
import { ApiError, UNEXPECTED_MESSAGE, offlineError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord } from '../../models/bookings/index.js';
import {
  CANCEL_BOOKING_API_PATH,
  cancelBookingRequestPath,
  cancellationMessageFor,
  cancelledLocally,
  describeCancelError,
  isCancellable,
} from './cancel-booking.js';

function bookingFixture(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: 'BB-10452',
    userId: 'traveller-ananya',
    tripId: 'trip-blue-line',
    busName: 'Sharma Travels',
    busType: 'AC_SLEEPER',
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: '2025-03-14T15:30:00.000Z',
    arrivalAt: '2025-03-14T20:00:00.000Z',
    boardingPointName: 'Shivajinagar',
    seatNumbers: ['A1', 'A2'],
    passengers: [
      { seatNumber: 'A1', name: 'Ananya Rao', age: 29, gender: 'FEMALE' },
      { seatNumber: 'A2', name: 'Vikram Rao', age: 34, gender: 'MALE' },
    ],
    farePerSeat: 650,
    totalFare: 1300,
    status: 'BOOKED',
    canCancel: true,
    createdAt: '2025-03-10T09:00:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

describe('isCancellable', () => {
  it('offers the control for an upcoming booking the backend still allows cancelling', () => {
    expect(isCancellable(bookingFixture())).toBe(true);
  });

  it('hides the control inside the last hour before departure', () => {
    expect(isCancellable(bookingFixture({ canCancel: false }))).toBe(false);
  });

  it('hides the control for a booking that is already cancelled', () => {
    const cancelled = bookingFixture({
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2025-03-12T06:00:00.000Z',
    });
    expect(isCancellable(cancelled)).toBe(false);
  });

  it('hides the control for a completed journey', () => {
    expect(isCancellable(bookingFixture({ status: 'COMPLETED', canCancel: false }))).toBe(false);
  });

  it('hides the control even if a stale record claims canCancel on a terminal booking', () => {
    expect(isCancellable(bookingFixture({ status: 'COMPLETED', canCancel: true }))).toBe(false);
  });
});

describe('cancelBookingRequestPath', () => {
  it('addresses the cancellation endpoint for one booking', () => {
    expect(cancelBookingRequestPath('BB-10452')).toBe('/bookings/BB-10452/cancel');
  });

  it('escapes the reference so it is always one path segment', () => {
    expect(cancelBookingRequestPath('BB 1/2')).toBe('/bookings/BB%201%2F2/cancel');
  });

  it('documents the endpoint shape', () => {
    expect(CANCEL_BOOKING_API_PATH).toBe('/bookings/:bookingId/cancel');
  });
});

describe('cancellationMessageFor', () => {
  it('names the booking reference, in the catalogue wording', () => {
    expect(cancellationMessageFor(bookingFixture())).toBe(MESSAGES.bookingCancelled('BB-10452'));
  });

  it('reads as the approved sentence', () => {
    expect(cancellationMessageFor(bookingFixture())).toBe('Your booking BB-10452 has been cancelled.');
  });
});

describe('cancelledLocally', () => {
  it('marks the booking cancelled and no longer cancellable', () => {
    const result = cancelledLocally(bookingFixture(), '2025-03-12T06:00:00.000Z');
    expect(result.status).toBe('CANCELLED');
    expect(result.canCancel).toBe(false);
    expect(result.cancelledAt).toBe('2025-03-12T06:00:00.000Z');
  });

  it('keeps the rest of the booking untouched', () => {
    const booking = bookingFixture();
    const result = cancelledLocally(booking, '2025-03-12T06:00:00.000Z');
    expect(result.id).toBe(booking.id);
    expect(result.seatNumbers).toEqual(booking.seatNumbers);
    expect(result.totalFare).toBe(booking.totalFare);
    expect(booking.status).toBe('BOOKED');
  });
});

describe('describeCancelError', () => {
  it('shows the server refusal when the cut-off has passed', () => {
    const refusal = new ApiError(409, 'TOO_LATE', MESSAGES.cancelNotAllowed);
    expect(describeCancelError(refusal)).toBe(MESSAGES.cancelNotAllowed);
  });

  it('shows the no-internet sentence when the backend was unreachable', () => {
    expect(describeCancelError(offlineError())).toBe(MESSAGES.offline);
  });

  it('falls back to the generic sentence for anything else', () => {
    expect(describeCancelError(new Error('surprise'))).toBe(UNEXPECTED_MESSAGE);
    expect(describeCancelError('not an error at all')).toBe(UNEXPECTED_MESSAGE);
  });
});
