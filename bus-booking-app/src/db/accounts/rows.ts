import {
  coerceSecurityQuestionId,
  type ActiveSessionSummary,
  type SecurityQuestionId,
  type UserPatch,
  type UserRecord,
} from '../../models/accounts/index.js';

/**
 * THE BOUNDARY between the User / Session tables and the account domain types.
 *
 * Everything here is pure: a row in, a domain record out. The database keeps instants as timestamps
 * and the mobile number in its own column name; the domain keeps ISO-8601 strings and calls the
 * number `mobile`. Those two translations live in exactly one place — this file — so every repository
 * method returns the same shapes and the mapping can be tested with no database at all.
 */

/** A timestamp as the client hands it back (a Date), tolerating a string from a raw query. */
export type RowTimestamp = Date | string;

/** One row of the User table. */
export interface UserRow {
  readonly id: string;
  readonly fullName: string;
  readonly mobileNumber: string;
  readonly passwordHash: string;
  /** Stored as text, read through `coerceSecurityQuestionId`. */
  readonly securityQuestionId: string;
  readonly securityAnswerHash: string;
  readonly failedLoginCount: number;
  readonly lockedUntil: RowTimestamp | null;
  readonly failedResetCount: number;
  readonly resetBlockedUntil: RowTimestamp | null;
  readonly createdAt: RowTimestamp;
}

/** One row of the Session table. */
export interface SessionRow {
  readonly id: string;
  readonly token: string;
  readonly userId: string;
  readonly userAgent: string | null;
  readonly createdAt: RowTimestamp;
}

/** The columns written when an account is created. Counters and dates take their defaults. */
export interface NewUserRow {
  readonly fullName: string;
  readonly mobileNumber: string;
  readonly passwordHash: string;
  readonly securityQuestionId: SecurityQuestionId;
  readonly securityAnswerHash: string;
}

/** The columns an account update may rewrite, in database-shaped values. */
export interface UserRowPatch {
  fullName?: string;
  passwordHash?: string;
  securityQuestionId?: SecurityQuestionId;
  securityAnswerHash?: string;
  failedLoginCount?: number;
  lockedUntil?: Date | null;
  failedResetCount?: number;
  resetBlockedUntil?: Date | null;
}

function timestampMs(value: RowTimestamp): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** A stored instant as the ISO-8601 string the domain and the API use. */
export function rowTimestampToIso(value: RowTimestamp): string {
  return new Date(timestampMs(value)).toISOString();
}

/** The same, keeping "no instant" as null (an account that is not locked, not blocked). */
export function rowTimestampToIsoOrNull(value: RowTimestamp | null): string | null {
  return value === null ? null : rowTimestampToIso(value);
}

/** The reverse direction: an ISO-8601 string (or null) as the value the column takes. */
export function isoToDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/** One User row as the account record every lane above the data layer works with. */
export function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    fullName: row.fullName,
    mobile: row.mobileNumber,
    securityQuestionId: coerceSecurityQuestionId(row.securityQuestionId),
    passwordHash: row.passwordHash,
    securityAnswerHash: row.securityAnswerHash,
    failedLoginCount: row.failedLoginCount,
    lockedUntil: rowTimestampToIsoOrNull(row.lockedUntil),
    failedResetCount: row.failedResetCount,
    resetBlockedUntil: rowTimestampToIsoOrNull(row.resetBlockedUntil),
    createdAt: rowTimestampToIso(row.createdAt),
  };
}

/**
 * A domain patch as the columns to write. Only the keys actually present are carried over, so an
 * update of `failedLoginCount` alone never blanks the lock instant, and a key set to null clears its
 * column.
 */
export function toUserRowPatch(patch: UserPatch): UserRowPatch {
  const row: UserRowPatch = {};
  if (patch.fullName !== undefined) row.fullName = patch.fullName.trim();
  if (patch.passwordHash !== undefined) row.passwordHash = patch.passwordHash;
  if (patch.securityQuestionId !== undefined) row.securityQuestionId = patch.securityQuestionId;
  if (patch.securityAnswerHash !== undefined) row.securityAnswerHash = patch.securityAnswerHash;
  if (patch.failedLoginCount !== undefined) row.failedLoginCount = patch.failedLoginCount;
  if (patch.lockedUntil !== undefined) row.lockedUntil = isoToDateOrNull(patch.lockedUntil);
  if (patch.failedResetCount !== undefined) row.failedResetCount = patch.failedResetCount;
  if (patch.resetBlockedUntil !== undefined) row.resetBlockedUntil = isoToDateOrNull(patch.resetBlockedUntil);
  return row;
}

/** One Session row as a row of the "Active devices" list. The token never leaves the data layer. */
export function toActiveSession(row: SessionRow, currentToken: string | null): ActiveSessionSummary {
  return {
    id: row.id,
    userAgent: row.userAgent,
    createdAt: rowTimestampToIso(row.createdAt),
    current: currentToken !== null && currentToken === row.token,
  };
}

/** Newest session first, with the id as a stable tie-break so the order never wobbles. */
export function compareSessionsNewestFirst(left: SessionRow, right: SessionRow): number {
  const byTime = timestampMs(right.createdAt) - timestampMs(left.createdAt);
  if (byTime !== 0) return byTime;
  return right.id.localeCompare(left.id);
}
