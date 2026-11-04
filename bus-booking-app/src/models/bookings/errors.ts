/**
 * THE FAILURES a booking read or write can report, as error classes carrying a stable `code`.
 *
 * A route handler maps the CODE to its own status and message catalogue sentence; it never matches on
 * the text of `message`.
 */

export type BookingErrorCode = 'BOOKING_NOT_FOUND' | 'BOOKING_NOT_CANCELLABLE' | 'TRIP_NOT_FOUND';

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

/** No such booking for that account — an unknown reference and another traveller's booking alike. */
export class BookingNotFoundError extends BookingError {
  readonly bookingId: string;

  constructor(bookingId: string) {
    super('BOOKING_NOT_FOUND', `No booking ${bookingId} belongs to this account.`);
    this.name = 'BookingNotFoundError';
    this.bookingId = bookingId;
  }
}

/** Inside the last hour before departure, or already cancelled or completed. */
export class BookingNotCancellableError extends BookingError {
  readonly bookingId: string;

  constructor(bookingId: string) {
    super('BOOKING_NOT_CANCELLABLE', `Booking ${bookingId} can no longer be cancelled.`);
    this.name = 'BookingNotCancellableError';
    this.bookingId = bookingId;
  }
}

/** A booking was asked for against a trip the catalogue no longer has. */
export class BookingTripNotFoundError extends BookingError {
  readonly tripId: string;

  constructor(tripId: string) {
    super('TRIP_NOT_FOUND', `No trip ${tripId} is on offer.`);
    this.name = 'BookingTripNotFoundError';
    this.tripId = tripId;
  }
}
