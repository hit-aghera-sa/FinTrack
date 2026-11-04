import type { BookingStatus } from './types.js';

/**
 * THE DERIVED-READ RULES of a booking — the one place the product decides what a booking IS and
 * whether it can still be cancelled.
 *
 * Pure functions over ISO-8601 instants and the moment of the read, so the repository, the APIs and
 * the specs all agree without a database.
 */

/** A booking may be cancelled up to one hour before the bus leaves. */
export const CANCEL_CUTOFF_MINUTES = 60;
export const CANCEL_CUTOFF_MS = CANCEL_CUTOFF_MINUTES * 60_000;

/** The three instants the rules read. */
export interface BookingTimeline {
  readonly cancelledAt: string | null;
  readonly departureAt: string;
  readonly arrivalAt: string;
}

/** True for a stored status word that means "cancelled", whatever its capitalisation. */
export function isCancelledText(value: string | null): boolean {
  return value !== null && value.trim().toLowerCase().startsWith('cancel');
}

/**
 * CANCELLED once cancelled, COMPLETED once the bus has arrived, otherwise BOOKED.
 */
export function deriveBookingStatus(timeline: BookingTimeline, now: Date): BookingStatus {
  if (timeline.cancelledAt !== null) return 'CANCELLED';
  const arrival = Date.parse(timeline.arrivalAt);
  if (!Number.isNaN(arrival) && arrival <= now.getTime()) return 'COMPLETED';
  return 'BOOKED';
}

/**
 * Cancellable only while the booking is BOOKED and there is MORE than one hour to departure — at
 * exactly one hour it is already too late.
 */
export function canCancelBooking(status: BookingStatus, departureAt: string, now: Date): boolean {
  if (status !== 'BOOKED') return false;
  const departure = Date.parse(departureAt);
  if (Number.isNaN(departure)) return false;
  return departure - now.getTime() > CANCEL_CUTOFF_MS;
}
