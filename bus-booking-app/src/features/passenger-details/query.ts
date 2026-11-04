import { MAX_SEATS_PER_BOOKING } from '../../models/bookings/index.js';

/**
 * THE ADDRESSES AND THE QUERY STRING of the passenger details screen.
 *
 * The screen is opened as `/trips/:tripId/passengers?seats=A1,A2&boarding=bp-shivaji`: the seats the
 * traveller picked and the boarding point they chose travel in the URL, so a reload keeps the choice
 * and a shared link is still meaningful. Everything here is pure — no React, no fetching — except
 * `currentSearch`, which reads the browser's own address bar.
 */

/** The client route this screen is mounted at. */
export const PASSENGER_DETAILS_ROUTE = '/trips/:tripId/passengers';

/** The seat map a traveller is sent back to when a seat was taken a moment earlier. */
export const SEAT_MAP_ROUTE = '/trips/:tripId/seats';

/** Where "start again" goes. */
export const SEARCH_PATH = '/search';

/** The API address a booking is created at (`POST /api/bookings`). */
export const BOOKINGS_REQUEST_PATH = '/bookings';

/** The chosen seats and boarding point, exactly as the URL states them. */
export interface PassengerDetailsQuery {
  readonly seats: readonly string[];
  readonly boardingPointId: string;
}

function sameSeat(left: string, right: string): boolean {
  return left.toUpperCase() === right.toUpperCase();
}

/**
 * The seats and boarding point read off a query string.
 *
 * `?seats=A1,A2` and `?seats=A1&seats=A2` both mean the same two seats; blanks and repeats are
 * dropped and no more seats than a booking may hold are kept.
 */
export function parsePassengerQuery(search: string): PassengerDetailsQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const seats: string[] = [];

  for (const raw of params.getAll('seats')) {
    for (const part of raw.split(',')) {
      const seat = part.trim();
      if (seat === '') continue;
      if (seats.length >= MAX_SEATS_PER_BOOKING) continue;
      if (seats.some((kept) => sameSeat(kept, seat))) continue;
      seats.push(seat);
    }
  }

  return { seats, boardingPointId: (params.get('boarding') ?? '').trim() };
}

/** The query string of the page currently open, or an empty string outside a browser. */
export function currentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

/** `GET /api/trips/:tripId` — the seat map, fares and boarding points of one bus. */
export function tripDetailRequestPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}`;
}

/** The seat map of this bus, which refetches server state when it opens. */
export function seatMapPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}/seats`;
}

/** The ticket shown immediately after a booking is created. */
export function bookingConfirmedPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/confirmed`;
}

/** The address of this screen for a chosen set of seats — what the seat map links to. */
export function passengerDetailsPath(tripId: string, query: PassengerDetailsQuery): string {
  const params = new URLSearchParams();
  if (query.seats.length > 0) params.set('seats', query.seats.join(','));
  if (query.boardingPointId !== '') params.set('boarding', query.boardingPointId);
  const suffix = params.toString();
  return `/trips/${encodeURIComponent(tripId)}/passengers${suffix === '' ? '' : `?${suffix}`}`;
}
