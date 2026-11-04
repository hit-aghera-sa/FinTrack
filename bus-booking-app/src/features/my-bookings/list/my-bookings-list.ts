import type { BookingRecord, BookingStatus, PassengerInput } from '../../../models/bookings/index.js';
import { formatDate, formatTime } from '../../../format/index.js';

/**
 * THE MY BOOKINGS LIST RULES — pure functions, no React, no fetching.
 *
 * The backend already splits `GET /api/bookings` into `upcoming` and `past`, but the SCREEN states the
 * same rule itself so the two tabs can never disagree with what is on them: a booking belongs to
 * **Upcoming** while its bus has not departed and it has not been cancelled; everything else —
 * departed buses and cancelled bookings — belongs to **Past & cancelled**. Upcoming reads soonest
 * departure first; Past & cancelled reads newest first.
 */

/** The endpoint this screen reads, as the shared API client addresses it (`/api/bookings`). */
export const MY_BOOKINGS_API_PATH = '/bookings';

/** Where the empty state's "Search buses" button leads. */
export const SEARCH_PATH = '/search';

/** This screen's own address. */
export const MY_BOOKINGS_PATH = '/bookings';

/** `/bookings?tab=past` opens the second tab on the same route. */
export const TAB_QUERY_KEY = 'tab';

export type MyBookingsTabId = 'upcoming' | 'past';

export interface MyBookingsTab {
  readonly id: MyBookingsTabId;
  readonly label: string;
}

/** The two tabs, in the approved order and with the approved words. */
export const MY_BOOKINGS_TABS: readonly MyBookingsTab[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past & cancelled' },
];

/** The bookings of one traveller, already in each tab's reading order. */
export interface MyBookingsSplit {
  readonly upcoming: BookingRecord[];
  readonly past: BookingRecord[];
}

/** The ticket view for one booking. */
export function ticketPathFor(bookingId: string): string {
  return `${MY_BOOKINGS_PATH}/${bookingId}`;
}

/** An ISO-8601 instant as milliseconds; unreadable text sorts as the epoch rather than throwing. */
export function instantMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** True while the bus has not left and the booking has not been cancelled. */
export function isUpcomingBooking(booking: BookingRecord, nowMs: number): boolean {
  if (booking.status === 'CANCELLED') return false;
  return instantMs(booking.departureAt) > nowMs;
}

/** Upcoming order: the bus that leaves soonest first. */
export function compareSoonestFirst(left: BookingRecord, right: BookingRecord): number {
  const difference = instantMs(left.departureAt) - instantMs(right.departureAt);
  return difference !== 0 ? difference : left.id.localeCompare(right.id);
}

/**
 * The moment a past entry last changed: the cancellation instant for a cancelled booking, otherwise
 * the departure it has already made.
 */
export function pastSortKeyMs(booking: BookingRecord): number {
  if (booking.cancelledAt !== null) return instantMs(booking.cancelledAt);
  return instantMs(booking.departureAt);
}

/** Past & cancelled order: newest first. */
export function compareNewestFirst(left: BookingRecord, right: BookingRecord): number {
  const difference = pastSortKeyMs(right) - pastSortKeyMs(left);
  return difference !== 0 ? difference : left.id.localeCompare(right.id);
}

/** The tab split, with each tab already in its reading order. */
export function partitionBookings(bookings: readonly BookingRecord[], nowMs: number): MyBookingsSplit {
  const upcoming: BookingRecord[] = [];
  const past: BookingRecord[] = [];
  for (const booking of bookings) {
    if (isUpcomingBooking(booking, nowMs)) upcoming.push(booking);
    else past.push(booking);
  }
  upcoming.sort(compareSoonestFirst);
  past.sort(compareNewestFirst);
  return { upcoming, past };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The smallest check that a value from the network is a booking this screen can draw. */
export function isBookingRecordLike(value: unknown): value is BookingRecord {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id === '') return false;
  if (typeof value.departureAt !== 'string') return false;
  if (typeof value.status !== 'string') return false;
  return Array.isArray(value.seatNumbers) && Array.isArray(value.passengers);
}

/** Whatever arrived, as the bookings in it. */
export function toBookingList(value: unknown): BookingRecord[] {
  if (!Array.isArray(value)) return [];
  const bookings: BookingRecord[] = [];
  for (const entry of value) {
    if (isBookingRecordLike(entry)) bookings.push(entry);
  }
  return bookings;
}

/**
 * The response of `GET /api/bookings` — `{ upcoming, past }`, or a flat list — as the two tabs.
 *
 * Both halves are re-partitioned against `nowMs`, so a bus that departed while the screen was open
 * moves to Past & cancelled on the next load rather than lingering under Upcoming.
 */
export function normaliseMyBookings(payload: unknown, nowMs: number): MyBookingsSplit {
  if (Array.isArray(payload)) return partitionBookings(toBookingList(payload), nowMs);
  if (isRecord(payload)) {
    const all = [...toBookingList(payload.upcoming), ...toBookingList(payload.past)];
    return partitionBookings(all, nowMs);
  }
  return { upcoming: [], past: [] };
}

/** Which tab the URL asks for. Anything unrecognised means Upcoming. */
export function tabFromSearch(search: string): MyBookingsTabId {
  const value = new URLSearchParams(search).get(TAB_QUERY_KEY);
  return value === 'past' ? 'past' : 'upcoming';
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const STATUS_MODIFIERS: Record<BookingStatus, string> = {
  BOOKED: 'is-booked',
  CANCELLED: 'is-cancelled',
  COMPLETED: 'is-completed',
};

/** The badge's words: Booked, Cancelled or Completed. */
export function statusLabel(status: BookingStatus): string {
  return STATUS_LABELS[status];
}

/** The badge's classes — the status is always written as text too, never colour alone. */
export function statusBadgeClass(status: BookingStatus): string {
  return `badge mybookings-badge ${STATUS_MODIFIERS[status]}`;
}

/** `Pune – Mumbai`. */
export function routeLabel(booking: BookingRecord): string {
  return `${booking.fromCityName} – ${booking.toCityName}`;
}

/** `BB-10452 · Pune – Mumbai` — the human booking reference and the route. */
export function bookingTitle(booking: BookingRecord): string {
  return `${booking.id} · ${routeLabel(booking)}`;
}

/** `Seat B3` / `Seats A1, A2`. */
export function seatListLabel(seatNumbers: readonly string[]): string {
  const seats = seatNumbers.filter((seat: string) => seat.trim() !== '');
  if (seats.length === 0) return 'No seats';
  if (seats.length === 1) return `Seat ${seats[0]}`;
  return `Seats ${seats.join(', ')}`;
}

/** `Ramesh Kulkarni, Sita Kulkarni`. */
export function passengerNamesLabel(passengers: readonly PassengerInput[]): string {
  return passengers
    .map((passenger: PassengerInput) => passenger.name.trim())
    .filter((name: string) => name !== '')
    .join(', ');
}

/** The row's second line: date, departure time, boarding point, seats and passengers. */
export function bookingSubline(booking: BookingRecord): string {
  const boarding = booking.boardingPointName.trim();
  const parts: string[] = [
    formatDate(booking.departureAt),
    `${formatTime(booking.departureAt)} departure`,
    boarding === '' ? '' : `${boarding} boarding`,
    seatListLabel(booking.seatNumbers),
    passengerNamesLabel(booking.passengers),
  ];
  return parts.filter((part: string) => part !== '').join(' · ');
}
