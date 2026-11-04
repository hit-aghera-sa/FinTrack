import { ApiError, UNEXPECTED_MESSAGE, isOfflineError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import { genderLabel, type PassengerInput } from '../../models/bookings/index.js';

/**
 * THE PURE RULES OF THE BOOKING CONFIRMED SCREEN.
 *
 * Addresses, the booking reference read off the URL, and the sentences shown when the ticket cannot
 * be loaded. No React and no fetching here, so every rule below is exercised without rendering.
 */

/** The address of this screen, as the app's route table spells it. */
export const CONFIRMED_ROUTE = '/bookings/:bookingId/confirmed';

/** Where "View my bookings" goes. */
export const MY_BOOKINGS_PATH = '/bookings';

/** Where "Search buses" goes. */
export const SEARCH_PATH = '/search';

/** Shown when the address carries no booking, or the backend has no such booking for this account. */
export const BOOKING_NOT_FOUND_MESSAGE =
  'We could not find that booking. Open My bookings to see your tickets.';

/** The address of the confirmed screen for one booking reference. */
export function confirmedPathFor(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/confirmed`;
}

/** The API path the ticket is read from: `GET /api/bookings/:bookingId`. */
export function bookingTicketRequestPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

/**
 * The two addresses that open this screen: the app's own
 * `/bookings/:bookingId/confirmed`, and the shorter `/booking-confirmed/:bookingId` the approved
 * preview used.
 */
const CONFIRMED_PATTERNS: readonly RegExp[] = [
  /^\/bookings\/([^/]+)\/confirmed\/?$/,
  /^\/booking-confirmed\/([^/]+)\/?$/,
];

/** The booking reference in a path, or null when the path is not this screen's. */
export function bookingIdFromPath(pathname: string): string | null {
  const withoutQuery = pathname.split('?')[0] ?? '';
  const path = withoutQuery.split('#')[0] ?? '';
  for (const pattern of CONFIRMED_PATTERNS) {
    const match = pattern.exec(path);
    const raw = match?.[1];
    if (raw !== undefined && raw !== '') {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

/** The seat numbers as one line: `A1, A2`. */
export function seatListLabel(seatNumbers: readonly string[]): string {
  return seatNumbers.length === 0 ? 'Not assigned' : seatNumbers.join(', ');
}

/** One passenger as one line: `A1 · Ramesh Kulkarni (34, Male)`. */
export function passengerLabel(passenger: PassengerInput): string {
  return `${passenger.seatNumber} · ${passenger.name} (${passenger.age}, ${genderLabel(passenger.gender)})`;
}

/** The sentence to show when the ticket could not be loaded. */
export function describeBookingError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError) {
    if (error.status === 404) return BOOKING_NOT_FOUND_MESSAGE;
    return error.message === '' ? UNEXPECTED_MESSAGE : error.message;
  }
  if (error instanceof Error && error.message !== '') return error.message;
  return UNEXPECTED_MESSAGE;
}
