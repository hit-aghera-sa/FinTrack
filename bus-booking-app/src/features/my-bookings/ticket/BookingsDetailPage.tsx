// src/features/my-bookings/ticket/BookingsDetailPage.tsx
//
// THE BEHAVIOUR OF /bookings/:bookingId.
//
// The approved look is reproduced by `BookingTicketScreen` beside this file, driven by the real
// booking read from `GET /api/bookings/:bookingId`: it shows a spinner while the ticket loads, one
// sentence when the booking does not exist or is not this traveller's, the no-internet sentence when
// the backend cannot be reached, and the full ticket otherwise — with the cancel action only while
// cancellation is still allowed.
import { BookingTicketScreen } from './BookingTicketScreen';

export function BookingsDetailPage(): JSX.Element {
  return <BookingTicketScreen />;
}

export default BookingsDetailPage;
