import type { UserRecord } from '../../models/accounts/index.js';

/**
 * THE LOGIN LOCKOUT RULE, as pure arithmetic over the two account columns that record it.
 *
 * Five consecutive failed log-ins lock the account for fifteen minutes; while the lock holds, every
 * attempt is refused with the lockout sentence, whatever password is typed. A successful log-in clears
 * the counter, and so does the first failure AFTER a lock has expired (the traveller starts again from
 * one, not from five).
 *
 * No clock, no database and no request lives in this file: the caller hands in the account state and
 * `now`, which is what makes the counting testable to the minute.
 */

/** Consecutive failures that lock the account. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** How long the lock holds, in minutes — the number quoted in the message a traveller sees. */
export const LOCKOUT_MINUTES = 15;

/** The same duration in milliseconds. */
export const LOCKOUT_MS = LOCKOUT_MINUTES * 60_000;

/** The part of an account this rule reads. */
export type LoginCredentialState = Pick<UserRecord, 'failedLoginCount' | 'lockedUntil'>;

/** The columns to write after an attempt. Assignable to the account repository's patch type. */
export interface LockoutPatch {
  failedLoginCount: number;
  lockedUntil: string | null;
}

/** Milliseconds left on the lock, or 0 when the account is not locked (or the lock has expired). */
export function lockRemainingMs(state: LoginCredentialState, now: Date = new Date()): number {
  if (state.lockedUntil === null) return 0;
  const until = new Date(state.lockedUntil).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, until - now.getTime());
}

/** Whether log-in must be refused with the lockout sentence right now. */
export function isLockActive(state: LoginCredentialState, now: Date = new Date()): boolean {
  return lockRemainingMs(state, now) > 0;
}

/**
 * The account state after one wrong password.
 *
 * While a lock is still holding, nothing changes — the attempt was refused before the password was
 * even checked. Otherwise the consecutive counter advances (restarting from zero when the previous
 * lock has run out) and the fifth failure sets a fresh fifteen-minute lock.
 */
export function afterFailedAttempt(state: LoginCredentialState, now: Date = new Date()): LockoutPatch {
  if (isLockActive(state, now)) {
    return { failedLoginCount: state.failedLoginCount, lockedUntil: state.lockedUntil };
  }

  const base = state.lockedUntil === null ? Math.max(0, state.failedLoginCount) : 0;
  const failedLoginCount = base + 1;

  if (failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return { failedLoginCount, lockedUntil: new Date(now.getTime() + LOCKOUT_MS).toISOString() };
  }

  return { failedLoginCount, lockedUntil: null };
}

/** The account state after a correct password: the counter and any expired lock are cleared. */
export function afterSuccessfulLogin(): LockoutPatch {
  return { failedLoginCount: 0, lockedUntil: null };
}

/** Whether a successful log-in actually needs a write, so a clean sign-in costs one query fewer. */
export function needsCounterReset(state: LoginCredentialState): boolean {
  return state.failedLoginCount !== 0 || state.lockedUntil !== null;
}
