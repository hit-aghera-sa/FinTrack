import type { BookingStatus } from '../../models/bookings/index.js';

/**
 * THE ACCOUNT DELETION LANE'S TYPES.
 *
 * The seams below are deliberately NARROW: this lane needs an account's id and password hash, the
 * timing of a booking, and the NUMBER of live sessions — nothing more. So it declares exactly that
 * much and lets the data layer's own records satisfy it structurally, instead of re-declaring
 * `UserRecord`, `BookingRecord` or a session summary (which belong to the data lane).
 *
 * Types only: no Express, no Prisma, no SQL.
 */

/** What a preview tells the traveller they are about to destroy. */
export interface AccountDeletionPreview {
  /** Bookings whose bus has not left yet — their seats go back to the pool on deletion. */
  upcomingBookings: number;
  /** Everything else: trips already travelled and bookings already cancelled. */
  pastBookings: number;
  /** Browsers and devices currently signed in to this account. */
  activeSessions: number;
}

/** The two booking counts, derived from the bookings themselves. */
export interface BookingCounts {
  upcomingBookings: number;
  pastBookings: number;
}

/** The slice of a booking the counting rules read. `BookingRecord` satisfies it. */
export interface BookingTimingRecord {
  readonly status: BookingStatus;
  /** ISO-8601 instant the bus leaves. */
  readonly departureAt: string;
}

/** What was actually destroyed, so the route (and a test) can state it exactly. */
export interface AccountPurgeSummary {
  /** Seats handed back to the available pool. */
  releasedSeats: number;
  deletedPassengers: number;
  deletedBookings: number;
  /** Session rows revoked — every device of that account. */
  revokedSessions: number;
  /** Whether the account row itself went (false only when it had already gone). */
  deletedUser: boolean;
}

/**
 * The irreversible write, as ONE call: in a single transaction it releases the seats, removes the
 * bookings and their passengers, revokes every session and deletes the account row (taking the
 * stored security question/answer and the lockout / reset counters with it).
 */
export interface AccountDeletionStore {
  purgeAccount(userId: string): Promise<AccountPurgeSummary>;
}

/** The account facts this lane needs: who it is, and what to check the password against. */
export interface DeletionAccount {
  readonly id: string;
  readonly passwordHash: string;
}

/** `userRepository` satisfies this. */
export interface DeletionUserStore {
  findById(id: string): Promise<DeletionAccount | null>;
}

/** `bookingRepository` satisfies this. */
export interface DeletionBookingReader {
  listByUser(userId: string, now: Date): Promise<readonly BookingTimingRecord[]>;
}

/**
 * `sessionRepository` satisfies this. Only the COUNT is used here, so the shape of a session summary
 * stays the data layer's business.
 */
export interface DeletionSessionReader {
  listActiveByUser(userId: string, currentToken?: string | null): Promise<readonly unknown[]>;
}

/** Why a deletion was refused. */
export type AccountDeletionFailureCode = 'invalid_request' | 'wrong_password' | 'not_found';

export interface AccountDeletionFailure {
  readonly ok: false;
  readonly code: AccountDeletionFailureCode;
  readonly message: string;
}

export interface AccountDeletionSuccess {
  readonly ok: true;
  readonly purge: AccountPurgeSummary;
}

export type AccountDeletionResult = AccountDeletionSuccess | AccountDeletionFailure;
