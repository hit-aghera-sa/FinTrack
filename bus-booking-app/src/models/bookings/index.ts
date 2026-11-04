/**
 * THE BOOKING DOMAIN BARREL — bookings, passengers and the rules read off them.
 *
 * Import the booking types from here (`src/models/bookings`) and nowhere else; the repository that
 * implements `BookingRepository` is `bookingRepository` in `src/db/bookings`.
 */
export type {
  BookingRecord,
  BookingRepository,
  BookingStatus,
  CreateBookingCommand,
  CreateBookingInput,
  CreateBookingResult,
  PassengerInput,
} from './types.js';
export { MAX_SEATS_PER_BOOKING, MIN_SEATS_PER_BOOKING } from './types.js';

export type { Gender } from './gender.js';
export { GENDER_LABELS, GENDERS, genderLabel, isGender, parseGender } from './gender.js';

export type { BookingTimeline } from './status.js';
export {
  CANCEL_CUTOFF_MINUTES,
  CANCEL_CUTOFF_MS,
  canCancelBooking,
  deriveBookingStatus,
  isCancelledText,
} from './status.js';

export type { BookingErrorCode } from './errors.js';
export {
  BookingError,
  BookingNotCancellableError,
  BookingNotFoundError,
  BookingTripNotFoundError,
} from './errors.js';
