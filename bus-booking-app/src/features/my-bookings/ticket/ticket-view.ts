import { ApiError, isOfflineError } from '../../../api/index.js';
import { formatDate, formatINR, formatTime } from '../../../format/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { busTypeLabel } from '../../../models/catalogue/index.js';
import { genderLabel } from '../../../models/bookings/index.js';
import type { BookingRecord, BookingStatus, PassengerInput } from '../../../models/bookings/index.js';

/**
 * THE BOOKING TICKET VIEW'S PURE RULES.
 *
 * Everything this screen needs that is not React: the address of the ticket endpoint, how a booking id
 * is read off the URL, how each line of the ticket reads, and which sentence a failure becomes. No
 * fetching and no state, so the whole of it can be tested without rendering anything.
 */

/** The route this feature is mounted at by the app's page list. */
export const TICKET_ROUTE = '/bookings/:bookingId';

/** Where the "Back" action goes: the two-tab My bookings list. */
export const MY_BOOKINGS_PATH = '/bookings';

/** No such booking, or a booking belonging to another traveller — deliberately one sentence. */
export const BOOKING_NOT_FOUND_MESSAGE = 'We could not find that booking.';

/** The session has gone, so the ticket cannot be read. */
export const TICKET_NOT_YOURS_MESSAGE = 'Please log in again to see this ticket.';

/** Anything else that stopped the ticket loading. */
export const TICKET_UNAVAILABLE_MESSAGE = 'We could not load this ticket. Please try again.';

/** What a ticket line shows before its value has arrived. */
export const EMPTY_VALUE = '—';

/** Every test hook this feature renders, named after the feature slug. */
export const TICKET_TEST_IDS = {
  page: 'my-bookings-screens-booking-ticket-view-page',
  card: 'my-bookings-screens-booking-ticket-view-card',
  bookingId: 'my-bookings-screens-booking-ticket-view-booking-id',
  amount: 'my-bookings-screens-booking-ticket-view-amount',
  passengers: 'my-bookings-screens-booking-ticket-view-passengers',
  cancel: 'my-bookings-screens-booking-ticket-view-cancel',
  cancelNote: 'my-bookings-screens-booking-ticket-view-cancel-note',
  loading: 'my-bookings-screens-booking-ticket-view-loading',
  message: 'my-bookings-screens-booking-ticket-view-message',
  cancelled: 'my-bookings-screens-booking-ticket-view-cancelled',
} as const;

/** `GET /api/bookings/:bookingId` — one booking in full, for the signed-in traveller only. */
export function ticketRequestPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

const TICKET_PATH_PATTERN = /^\/bookings\/([^/?#]+)/;

/** The booking the current address is about, or null when the address names none. */
export function bookingIdFromPathname(pathname: string): string | null {
  const match = TICKET_PATH_PATTERN.exec(pathname);
  if (match === null) return null;
  const raw = match[1];
  if (raw.length === 0) return null;
  return decodeURIComponent(raw);
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const STATUS_MODIFIERS: Record<BookingStatus, string> = {
  BOOKED: 'ticket-status-booked',
  CANCELLED: 'ticket-status-cancelled',
  COMPLETED: 'ticket-status-completed',
};

/** The status in words — never colour alone. */
export function statusLabel(status: BookingStatus): string {
  return STATUS_LABELS[status];
}

/** The badge's classes: the approved badge, plus this lane's own state modifier. */
export function statusBadgeClass(status: BookingStatus): string {
  return `badge badge-info ticket-status ${STATUS_MODIFIERS[status]}`;
}

/** "Shree Travels · AC Sleeper". */
export function busLabel(booking: Pick<BookingRecord, 'busName' | 'busType'>): string {
  return `${booking.busName} · ${busTypeLabel(booking.busType)}`;
}

/** "Pune – Mumbai". */
export function routeLabel(booking: Pick<BookingRecord, 'fromCityName' | 'toCityName'>): string {
  return `${booking.fromCityName} – ${booking.toCityName}`;
}

/** The arrival time, with the travel day added when the bus arrives on a later day. */
export function arrivalLabel(booking: Pick<BookingRecord, 'departureAt' | 'arrivalAt'>): string {
  const time = formatTime(booking.arrivalAt);
  const arrivalDay = formatDate(booking.arrivalAt);
  if (arrivalDay === formatDate(booking.departureAt)) return time;
  return `${time} · ${arrivalDay}`;
}

/** The seats on one line, for the bus staff to read at a glance. */
export function seatListLabel(seatNumbers: readonly string[]): string {
  return seatNumbers.length === 0 ? EMPTY_VALUE : seatNumbers.join(', ');
}

/** "34 years · Male" — the passenger facts beside the name. */
export function passengerMetaLabel(passenger: Pick<PassengerInput, 'age' | 'gender'>): string {
  return `${passenger.age} years · ${genderLabel(passenger.gender)}`;
}

/** The fare one seat cost, in whole rupees. */
export function farePerSeatLabel(booking: Pick<BookingRecord, 'farePerSeat'>): string {
  return formatINR(booking.farePerSeat);
}

/** Whether the cancel affordance may be offered for this booking at all. */
export function canCancelNow(booking: Pick<BookingRecord, 'status' | 'canCancel'> | null): boolean {
  if (booking === null) return false;
  return booking.status === 'BOOKED' && booking.canCancel;
}

/** What stands where the cancel action would be when cancellation is no longer possible. */
export function cancelNoteFor(booking: Pick<BookingRecord, 'status' | 'id'>): string {
  if (booking.status === 'CANCELLED') return MESSAGES.bookingCancelled(booking.id);
  if (booking.status === 'COMPLETED') return 'This trip is complete, so it can no longer be cancelled.';
  return MESSAGES.cancelNotAllowed;
}

/** True when the failure means "there is no such ticket for this traveller". */
export function isMissingTicket(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

/** The one sentence a traveller reads for any failure to load this ticket. */
export function describeTicketError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 403) return BOOKING_NOT_FOUND_MESSAGE;
    if (error.status === 401) return TICKET_NOT_YOURS_MESSAGE;
    if (error.message.trim() !== '') return error.message;
  }
  return TICKET_UNAVAILABLE_MESSAGE;
}
