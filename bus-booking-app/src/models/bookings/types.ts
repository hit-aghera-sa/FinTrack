import type { BusType } from '../catalogue/index.js';
import type { Gender } from './gender.js';

/**
 * THE BOOKING DOMAIN — declared ONCE for the whole app.
 *
 * Every lane (booking creation, my bookings, the ticket view, cancellation and the screens behind
 * them) imports these types from `src/models/bookings` instead of re-declaring them.
 *
 * Types only: no Prisma, no React, no fetching. The implementation of `BookingRepository` is
 * `bookingRepository` in `src/db/bookings`.
 */

/** One traveller on one seat, exactly as the passenger-details form collects them. */
export interface PassengerInput {
  seatNumber: string;
  name: string;
  age: number;
  gender: Gender;
}

/**
 * What a booking IS at the moment it is read: Cancelled once cancelled, Completed once the bus has
 * arrived, Booked while it is still ahead. Cancelled and Completed are terminal.
 */
export type BookingStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';

/**
 * A booking as every screen and API response states it.
 *
 * The trip's details are DENORMALISED onto the record (bus, route, times, boarding point, fare) so a
 * ticket keeps reading correctly without a second lookup. `status` and `canCancel` are derived at
 * read time against the moment of the read — they are never stored.
 *
 * `departureAt` / `arrivalAt` / `createdAt` / `cancelledAt` are ISO-8601 instants; fares are whole
 * rupees.
 */
export interface BookingRecord {
  id: string;
  userId: string;
  tripId: string;
  busName: string;
  busType: BusType;
  fromCityName: string;
  toCityName: string;
  departureAt: string;
  arrivalAt: string;
  boardingPointName: string;
  seatNumbers: string[];
  passengers: PassengerInput[];
  farePerSeat: number;
  totalFare: number;
  status: BookingStatus;
  canCancel: boolean;
  createdAt: string;
  cancelledAt: string | null;
}

/** What the booking screens send: the trip, the pickup point and one passenger per chosen seat. */
export interface CreateBookingInput {
  tripId: string;
  boardingPointId: string;
  passengers: PassengerInput[];
}

/** The same, with the owning account the API resolved from the session. */
export interface CreateBookingCommand extends CreateBookingInput {
  userId: string;
}

/**
 * Either the booking was made, or one of the chosen seats had just been taken — and then NOTHING is
 * booked and `conflictSeat` names the seat to tell the traveller about.
 */
export type CreateBookingResult =
  | { ok: true; booking: BookingRecord }
  | { ok: false; conflictSeat: string };

/** The booking data layer's whole surface. Implemented by `bookingRepository` in `src/db/bookings`. */
export interface BookingRepository {
  /** One transaction across every requested seat: on conflict nothing is written. */
  create(input: CreateBookingCommand): Promise<CreateBookingResult>;
  /** The bookings of THAT account only, with status and canCancel derived against `now`. */
  listByUser(userId: string, now: Date): Promise<BookingRecord[]>;
  /** One booking of THAT account only, or null — never another traveller's booking. */
  findByIdForUser(bookingId: string, userId: string, now: Date): Promise<BookingRecord | null>;
  /** Cancels and releases the seats. Throws when the booking is not the user's or not cancellable. */
  cancel(bookingId: string, userId: string): Promise<BookingRecord>;
}

/** A booking carries at least one and at most six seats. */
export const MIN_SEATS_PER_BOOKING = 1;
export const MAX_SEATS_PER_BOOKING = 6;
