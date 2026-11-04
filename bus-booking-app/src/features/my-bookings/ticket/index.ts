/**
 * THE BOOKING TICKET VIEW FEATURE.
 *
 * `BookingTicketScreen` is what the app shell's route table mounts at `/bookings/:bookingId`
 * (`heading: false` — the screen draws the approved page header itself). It renders only its own
 * content and loads the booking from `GET /api/bookings/:bookingId`, so a reload or a shared link
 * still shows the ticket.
 */
export { BookingTicketScreen } from './BookingTicketScreen';
export { BookingTicketCard } from './BookingTicketCard';
export type { BookingTicketCardProps } from './BookingTicketCard';
export { BookingsDetailPage } from './BookingsDetailPage';

export { useBookingTicket } from './useBookingTicket.js';
export type { BookingTicketState, BookingTicketStatus } from './useBookingTicket.js';

export {
  BOOKING_NOT_FOUND_MESSAGE,
  EMPTY_VALUE,
  MY_BOOKINGS_PATH,
  TICKET_NOT_YOURS_MESSAGE,
  TICKET_ROUTE,
  TICKET_TEST_IDS,
  TICKET_UNAVAILABLE_MESSAGE,
  arrivalLabel,
  bookingIdFromPathname,
  busLabel,
  canCancelNow,
  cancelNoteFor,
  describeTicketError,
  farePerSeatLabel,
  isMissingTicket,
  passengerMetaLabel,
  routeLabel,
  seatListLabel,
  statusBadgeClass,
  statusLabel,
  ticketRequestPath,
} from './ticket-view.js';
