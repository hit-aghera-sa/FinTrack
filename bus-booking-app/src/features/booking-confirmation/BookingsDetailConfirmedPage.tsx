// src/features/booking-confirmation/BookingsDetailConfirmedPage.tsx
//
// THE BEHAVIOUR OF /bookings/:bookingId/confirmed.
//
// The approved preview beside this file states the look with one traveller's details written into the
// markup. The live screen keeps that look — the confirmation card, the success notice and the two
// actions — and fills it from the real booking, deciding what to show while the ticket loads, when the
// address names no booking, and when the call fails.
import { BookingConfirmedScreen } from './BookingConfirmedScreen';

export function BookingsDetailConfirmedPage(): JSX.Element {
  return <BookingConfirmedScreen />;
}

export default BookingsDetailConfirmedPage;
