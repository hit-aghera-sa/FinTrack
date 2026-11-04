import type { PassengerInput } from '../../models/bookings/index.js';
import type { TripDetail } from '../../models/catalogue/index.js';

/**
 * THE BOOKING LAYER'S TWO SEAMS.
 *
 * `BookingDataSource` is the rows: what is stored about a booking, with no rule applied. The Prisma /
 * PostgreSQL implementation is `createPrismaBookingSource`; the repository's own specs implement it
 * in memory, so the product rules are verified without a database.
 *
 * `TripReader` is the slice of the travel catalogue a booking needs for its denormalised fields —
 * the catalogue lane's `tripRepository` satisfies it as it stands.
 */

/** One passenger row, with the gender spelled however it is stored. */
export interface BookingPassengerRow {
  readonly seatNumber: string;
  readonly name: string;
  readonly age: number;
  readonly gender: string | null;
}

/** One booking row: its identity, its owner, its trip, and what is stored about cancellation. */
export interface BookingRow {
  /** The primary key as stored — used for passenger and seat links, never shown. */
  readonly rowId: string;
  /** The human reference (`BB-#####`) the traveller and every URL use. */
  readonly id: string;
  readonly userId: string;
  readonly tripId: string;
  readonly boardingPointId: string | null;
  /** The stored status word, when the datastore keeps one. */
  readonly statusText: string | null;
  readonly createdAt: Date;
  readonly cancelledAt: Date | null;
  readonly passengers: readonly BookingPassengerRow[];
}

/** Everything written when a booking is made. The totals are already derived by the repository. */
export interface NewBookingRow {
  readonly id: string;
  readonly userId: string;
  readonly tripId: string;
  readonly boardingPointId: string;
  readonly passengers: readonly PassengerInput[];
  readonly farePerSeat: number;
  readonly totalFare: number;
  readonly createdAt: Date;
}

/** Either the booking was written, or a chosen seat was already held and nothing was written. */
export type InsertBookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; conflictSeat: string };

export interface BookingDataSource {
  /** Whether a booking reference is already in use. */
  existsById(bookingId: string): Promise<boolean>;
  /** ONE transaction: lock the trip's seats, refuse a taken seat, write booking + passengers. */
  insert(row: NewBookingRow): Promise<InsertBookingResult>;
  listByUser(userId: string): Promise<BookingRow[]>;
  findByIdForUser(bookingId: string, userId: string): Promise<BookingRow | null>;
  /** Marks the booking cancelled and frees its seats. Null when it is not that user's booking. */
  markCancelled(bookingId: string, userId: string, cancelledAt: Date): Promise<BookingRow | null>;
}

/** The catalogue read a booking record is built from. `tripRepository` satisfies this. */
export interface TripReader {
  findDetail(tripId: string): Promise<TripDetail | null>;
}
