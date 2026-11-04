/**
 * THE AUTH LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `authRouter` under `/api`. Every other server lane takes its credential
 * helpers from here — `hashPassword` / `verifyPassword` for sign-up, reset, profile changes and
 * account deletion; `validatePassword` for the password rule; `hashSecurityAnswer` /
 * `verifySecurityAnswer` for the reset question; `startSession` to sign a traveller in after sign-up
 * or a completed reset; `requireUser` and `AuthedRequest` to guard an authenticated route.
 */
export { authRouter } from './router.js';
export { requireUser } from './require-user.js';
export { clearSession, createSessionToken, currentUser, startSession } from './session.js';
export { parseCookieHeader, readSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME, } from './cookies.js';
export { hashPassword, hashSecurityAnswer, normaliseSecurityAnswer, PASSWORD_MIN_LENGTH, PASSWORD_RULE_MESSAGE, validatePassword, verifyPassword, verifySecurityAnswer, } from './passwords.js';
export { afterFailedAttempt, afterSuccessfulLogin, isLockActive, lockRemainingMs, LOCKOUT_MINUTES, LOCKOUT_MS, MAX_FAILED_LOGIN_ATTEMPTS, needsCounterReset, } from './lockout.js';
export { errorBody, NOT_SIGNED_IN_MESSAGE, respondError, respondUnavailable, SERVICE_UNAVAILABLE_MESSAGE, } from './responses.js';
export { isLoopbackAddress, isTrustedTestClient } from './trusted-client.js';
