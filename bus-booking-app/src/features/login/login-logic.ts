import { ApiError, UNEXPECTED_MESSAGE, isOfflineError } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';

/**
 * THE RULES BEHIND /login, as pure functions.
 *
 * The screen itself only draws; everything that can be decided without a browser lives here so it can
 * be read and tested on its own:
 *
 *   • which of the catalogue's sentences a failed log-in deserves — the deliberately vague
 *     "Mobile number or password is incorrect." for a refused credential, the lockout sentence once
 *     the API reports five consecutive failures, the no-internet sentence when nothing was reached;
 *   • what a mobile number looks like as it is typed (digits only, ten of them);
 *   • whether this screen should even attempt a call — an account the API has just locked is not
 *     retried from here until the number typed changes.
 */

export type LoginFailureKind = 'invalid' | 'locked' | 'offline' | 'unexpected';

export interface LoginFailure {
  /** What went wrong, for the screen's own decisions (blocking further attempts, field marking). */
  readonly kind: LoginFailureKind;
  /** The exact sentence shown to the traveller. */
  readonly message: string;
}

/** How many digits an Indian mobile number has — the input never holds more. */
export const MOBILE_DIGITS = 10;

/**
 * Codes a lockout can arrive under. The message is checked too, so a server that only sends the
 * catalogue sentence is still understood.
 */
const LOCKED_CODE = /lock|too[_-]?many/i;

/** Statuses that mean "this credential was refused", never "the server broke". */
const REFUSED_STATUSES: readonly number[] = [400, 401, 403, 404, 422];

/** True when the API's answer means the account is temporarily locked. */
export function isLockedFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.message === MESSAGES.accountLocked) return true;
  return LOCKED_CODE.test(error.code);
}

/**
 * The one place a failed log-in becomes words. Offline is checked first (a request that never
 * arrived says nothing about the credential), then the lockout, then a plain refusal.
 */
export function classifyLoginFailure(error: unknown): LoginFailure {
  if (isOfflineError(error)) return { kind: 'offline', message: MESSAGES.offline };
  if (isLockedFailure(error)) return { kind: 'locked', message: MESSAGES.accountLocked };
  if (error instanceof ApiError) {
    if (REFUSED_STATUSES.includes(error.status)) {
      return { kind: 'invalid', message: MESSAGES.loginIncorrect };
    }
    return {
      kind: 'unexpected',
      message: error.message.trim() === '' ? UNEXPECTED_MESSAGE : error.message,
    };
  }
  return { kind: 'unexpected', message: UNEXPECTED_MESSAGE };
}

/** How long an identifier that is not a mobile number may be before the field stops holding it. */
export const IDENTIFIER_MAX = 160;

/**
 * What the identifier field holds. A number is kept as it always was — digits only, ten at most.
 * An address is kept as typed (trimmed): the operator account the server creates from
 * `APP_INITIAL_ADMIN_EMAIL` signs in at this same form with its e-mail address, which the backend
 * resolves to that account. Whether an identifier names an account is the backend's decision.
 */
export function normaliseMobileInput(raw: string): string {
  if (raw.includes('@')) return raw.trim().slice(0, IDENTIFIER_MAX);
  return raw.replace(/[^0-9]/g, '').slice(0, MOBILE_DIGITS);
}

/** Punctuation a mobile number may be typed with: anything else means "this is not a number". */
const PHONE_PUNCTUATION = /^[0-9()+\-.\s]*$/;

/** True when what was typed can only be a mobile number (digits, possibly punctuated). */
export function looksLikeMobileInput(raw: string): boolean {
  return PHONE_PUNCTUATION.test(raw);
}

/**
 * The identifier as the field holds it. A number is kept the way the field has always kept it —
 * digits only, ten at most. Anything else (an operator account addressed by e-mail, for instance)
 * is kept as typed, trimmed, so the backend is the one that decides whether it names an account.
 */
export function normaliseLoginIdentifier(raw: string): string {
  if (looksLikeMobileInput(raw)) return normaliseMobileInput(raw);
  return raw.trim().slice(0, IDENTIFIER_MAX);
}

/** True when there is nothing to send yet. Neither field is named in what the traveller is told. */
export function missingCredentials(mobile: string, password: string): boolean {
  return normaliseMobileInput(mobile) === '' || password === '';
}

/**
 * The same emptiness check for a form whose identifier need not be a mobile number: nothing is sent
 * while either field is blank. It decides nothing about the credential itself — the API does that.
 */
export function missingLoginFields(identifier: string, password: string): boolean {
  return normaliseLoginIdentifier(identifier) === '' || password === '';
}

/**
 * True when this screen must not attempt a log-in: the API has locked the account for the number
 * currently typed. Typing a different number lifts the block, as does the API accepting an attempt.
 */
export function isAttemptBlocked(mobile: string, lockedMobile: string | null): boolean {
  if (lockedMobile === null) return false;
  const locked = normaliseMobileInput(lockedMobile);
  if (locked === '') return false;
  return normaliseMobileInput(mobile) === locked;
}
