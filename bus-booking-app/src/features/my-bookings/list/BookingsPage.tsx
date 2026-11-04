// src/features/my-bookings/list/BookingsPage.tsx
//
// THE BEHAVIOUR OF /bookings.
//
// The approved preview beside this file (`BookingsScreen`) is static markup with example rows; the
// live screen is `MyBookingsScreen`, which keeps that look — the same page header, the same tab strip
// with its counts, the same row shape — and fills it from `GET /api/bookings`, with the project's own
// loading, error and empty states for the cases a preview cannot show.
import { MyBookingsScreen } from './MyBookingsScreen';

export function BookingsPage(): JSX.Element {
  return <MyBookingsScreen />;
}

export default BookingsPage;
