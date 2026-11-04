/**
 * THE FAILURES a booking read or write can report, as error classes carrying a stable `code`.
 *
 * A route handler maps the CODE to its own status and message catalogue sentence; it never matches on
 * the text of `message`.
 */
export class BookingError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'BookingError';
        this.code = code;
    }
}
/** No such booking for that account — an unknown reference and another traveller's booking alike. */
export class BookingNotFoundError extends BookingError {
    bookingId;
    constructor(bookingId) {
        super('BOOKING_NOT_FOUND', `No booking ${bookingId} belongs to this account.`);
        this.name = 'BookingNotFoundError';
        this.bookingId = bookingId;
    }
}
/** Inside the last hour before departure, or already cancelled or completed. */
export class BookingNotCancellableError extends BookingError {
    bookingId;
    constructor(bookingId) {
        super('BOOKING_NOT_CANCELLABLE', `Booking ${bookingId} can no longer be cancelled.`);
        this.name = 'BookingNotCancellableError';
        this.bookingId = bookingId;
    }
}
/** A booking was asked for against a trip the catalogue no longer has. */
export class BookingTripNotFoundError extends BookingError {
    tripId;
    constructor(tripId) {
        super('TRIP_NOT_FOUND', `No trip ${tripId} is on offer.`);
        this.name = 'BookingTripNotFoundError';
        this.tripId = tripId;
    }
}
