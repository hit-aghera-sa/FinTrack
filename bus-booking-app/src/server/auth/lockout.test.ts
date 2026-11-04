import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import {
  afterFailedAttempt,
  afterSuccessfulLogin,
  isLockActive,
  lockRemainingMs,
  LOCKOUT_MINUTES,
  LOCKOUT_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  needsCounterReset,
  type LoginCredentialState,
} from './lockout.js';

/** A fixed instant, so every expectation below is exact rather than "about now". */
const NOW = new Date('2024-06-12T18:00:00.000Z');

function state(failedLoginCount: number, lockedUntil: string | null = null): LoginCredentialState {
  return { failedLoginCount, lockedUntil };
}

describe('login failure counting', () => {
  it('counts the first failure as one and sets no lock', () => {
    expect(afterFailedAttempt(state(0), NOW)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it('advances the counter on each consecutive failure without locking before the fifth', () => {
    const counts = [0, 1, 2, 3].map((previous) => afterFailedAttempt(state(previous), NOW));
    expect(counts.map((patch) => patch.failedLoginCount)).toEqual([1, 2, 3, 4]);
    expect(counts.every((patch) => patch.lockedUntil === null)).toBe(true);
  });

  it('locks the account for fifteen minutes on the fifth consecutive failure', () => {
    const patch = afterFailedAttempt(state(MAX_FAILED_LOGIN_ATTEMPTS - 1), NOW);
    expect(patch.failedLoginCount).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    expect(patch.lockedUntil).toBe(new Date(NOW.getTime() + LOCKOUT_MS).toISOString());
    expect(LOCKOUT_MINUTES).toBe(15);
  });

  it('leaves the account untouched while a lock is still holding', () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000).toISOString();
    const locked = state(MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil);
    expect(afterFailedAttempt(locked, NOW)).toEqual({
      failedLoginCount: MAX_FAILED_LOGIN_ATTEMPTS,
      lockedUntil,
    });
  });

  it('starts counting again from one after the lock has expired', () => {
    const expired = state(MAX_FAILED_LOGIN_ATTEMPTS, new Date(NOW.getTime() - 1_000).toISOString());
    expect(afterFailedAttempt(expired, NOW)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });
});

describe('lock state', () => {
  it('is inactive for an account that has never failed', () => {
    expect(isLockActive(state(0), NOW)).toBe(false);
    expect(lockRemainingMs(state(0), NOW)).toBe(0);
  });

  it('is active until the lock instant and inactive from then on', () => {
    const lockedUntil = new Date(NOW.getTime() + LOCKOUT_MS).toISOString();
    const locked = state(MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil);

    expect(isLockActive(locked, NOW)).toBe(true);
    expect(lockRemainingMs(locked, NOW)).toBe(LOCKOUT_MS);

    const oneMinuteLeft = new Date(NOW.getTime() + LOCKOUT_MS - 60_000);
    expect(isLockActive(locked, oneMinuteLeft)).toBe(true);
    expect(lockRemainingMs(locked, oneMinuteLeft)).toBe(60_000);

    const afterExpiry = new Date(NOW.getTime() + LOCKOUT_MS + 1);
    expect(isLockActive(locked, afterExpiry)).toBe(false);
    expect(lockRemainingMs(locked, afterExpiry)).toBe(0);
  });

  it('treats an unreadable stored instant as no lock at all', () => {
    expect(isLockActive(state(5, 'not a date'), NOW)).toBe(false);
  });

  it('has a lockout sentence that quotes fifteen minutes', () => {
    expect(MESSAGES.accountLocked).toBe('Too many attempts. Please try again after 15 minutes.');
  });
});

describe('a successful log-in', () => {
  it('clears the counter and any lock', () => {
    expect(afterSuccessfulLogin()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });

  it('needs no write when the account was already clean', () => {
    expect(needsCounterReset(state(0))).toBe(false);
    expect(needsCounterReset(state(3))).toBe(true);
    expect(needsCounterReset(state(0, new Date(NOW.getTime() - 1).toISOString()))).toBe(true);
  });
});
