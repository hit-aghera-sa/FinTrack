/**
 * THE BOOKING CONFIRMED FEATURE.
 *
 * `BookingConfirmedScreen` is what the app shell's route table mounts at
 * `/bookings/:bookingId/confirmed`; it renders only its own content and loads the ticket itself from
 * `GET /api/bookings/:bookingId`, so the screen survives a reload and a shared link.
 *
 * `PayOnBoardingNotice` is the reusable sentence about the amount still to be handed over — import it
 * anywhere a traveller must be told what to pay the bus staff, rather than re-typing the wording.
 */
export { BookingConfirmedScreen } from './BookingConfirmedScreen';
export { PayOnBoardingNotice } from './PayOnBoardingNotice';
export type { PayOnBoardingNoticeProps } from './PayOnBoardingNotice';
export { BookingsDetailConfirmedPage } from './BookingsDetailConfirmedPage';
export {
  BOOKING_NOT_FOUND_MESSAGE,
  CONFIRMED_ROUTE,
  MY_BOOKINGS_PATH,
  SEARCH_PATH,
  bookingIdFromPath,
  bookingTicketRequestPath,
  confirmedPathFor,
  describeBookingError,
  passengerLabel,
  seatListLabel,
} from './booking-path.js';
