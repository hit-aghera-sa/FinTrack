import { MESSAGES } from '../../messages/index.js';
import {
  SECURITY_QUESTIONS,
  type SecurityQuestionId,
  type SignupInput,
} from '../../models/accounts/index.js';

/**
 * THE SERVER-SIDE SIGN-UP RULES, as one pure function.
 *
 * The Sign up screen reflects these rules in the browser; this module re-checks every one of them on
 * the server, in the order the form shows the fields, and answers with the FIRST offending field and
 * the exact sentence the traveller should read. No database, no hashing, no Express — so it can be
 * exercised on its own.
 *
 * The password rule itself belongs to the auth lane (`validatePassword`): it is handed in as a
 * parameter so there is exactly one password rule in the product and this module stays free of bcrypt.
 */

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 60;
export const SECURITY_ANSWER_MIN_LENGTH = 2;
export const SECURITY_ANSWER_MAX_LENGTH = 50;

/** Exactly ten digits, the first of which is 6, 7, 8 or 9. */
export const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;

export const FULL_NAME_MESSAGE = `Please enter your full name (${FULL_NAME_MIN_LENGTH} to ${FULL_NAME_MAX_LENGTH} characters).`;
export const MOBILE_MESSAGE = 'Please enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
export const PASSWORD_REQUIRED_MESSAGE = 'Please enter a password.';
export const SECURITY_QUESTION_MESSAGE = 'Please choose one of the security questions.';
export const SECURITY_ANSWER_MESSAGE = `Please enter your security answer (${SECURITY_ANSWER_MIN_LENGTH} to ${SECURITY_ANSWER_MAX_LENGTH} characters).`;

/** The field a refusal belongs to, so a client can mark the right input. */
export type SignupField =
  | 'fullName'
  | 'mobile'
  | 'password'
  | 'confirmPassword'
  | 'securityQuestionId'
  | 'securityAnswer';

export interface SignupValidationSuccess {
  readonly ok: true;
  /** The cleaned values: names and answers trimmed, the password exactly as typed. */
  readonly value: SignupInput;
}

export interface SignupValidationFailure {
  readonly ok: false;
  readonly field: SignupField;
  readonly message: string;
}

export type SignupValidation = SignupValidationSuccess | SignupValidationFailure;

/** The password rule, as the auth lane states it: a sentence when the password is refused, else null. */
export type PasswordRule = (password: string) => string | null;

/** The raw request body, with every field still unknown. */
interface RawSignupBody {
  fullName?: unknown;
  mobile?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  securityQuestionId?: unknown;
  securityAnswer?: unknown;
}

function asRawBody(body: unknown): RawSignupBody {
  if (typeof body !== 'object' || body === null) return {};
  const raw: RawSignupBody = {};
  if ('fullName' in body) raw.fullName = body.fullName;
  if ('mobile' in body) raw.mobile = body.mobile;
  if ('password' in body) raw.password = body.password;
  if ('confirmPassword' in body) raw.confirmPassword = body.confirmPassword;
  if ('securityQuestionId' in body) raw.securityQuestionId = body.securityQuestionId;
  if ('securityAnswer' in body) raw.securityAnswer = body.securityAnswer;
  return raw;
}

/** A field that is absent, null or not a string is treated as empty — i.e. as "not filled in". */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function fail(field: SignupField, message: string): SignupValidationFailure {
  return { ok: false, field, message };
}

/**
 * The chosen question's id, taken from the fixed list of four, or null when it is not one of them.
 * Reading the id back off the list is what makes the returned value a `SecurityQuestionId`.
 */
export function resolveSecurityQuestionId(value: string): SecurityQuestionId | null {
  const match = SECURITY_QUESTIONS.find(
    (question: { id: SecurityQuestionId; label: string }) => question.id === value,
  );
  return match === undefined ? null : match.id;
}

/** True when a name/answer length is inside the inclusive range. */
function withinLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

export function validateSignup(body: unknown, passwordRule: PasswordRule): SignupValidation {
  const raw = asRawBody(body);

  const fullName = text(raw.fullName).trim();
  if (!withinLength(fullName, FULL_NAME_MIN_LENGTH, FULL_NAME_MAX_LENGTH)) {
    return fail('fullName', FULL_NAME_MESSAGE);
  }

  const mobile = text(raw.mobile).trim();
  if (!MOBILE_PATTERN.test(mobile)) {
    return fail('mobile', MOBILE_MESSAGE);
  }

  const password = text(raw.password);
  const passwordProblem = passwordRule(password);
  if (passwordProblem !== null) {
    return fail('password', passwordProblem);
  }
  if (password === '') {
    return fail('password', PASSWORD_REQUIRED_MESSAGE);
  }

  const confirmPassword = text(raw.confirmPassword);
  if (confirmPassword !== password) {
    return fail('confirmPassword', MESSAGES.passwordMismatch);
  }

  const securityQuestionId = resolveSecurityQuestionId(text(raw.securityQuestionId).trim());
  if (securityQuestionId === null) {
    return fail('securityQuestionId', SECURITY_QUESTION_MESSAGE);
  }

  const securityAnswer = text(raw.securityAnswer).trim();
  if (!withinLength(securityAnswer, SECURITY_ANSWER_MIN_LENGTH, SECURITY_ANSWER_MAX_LENGTH)) {
    return fail('securityAnswer', SECURITY_ANSWER_MESSAGE);
  }

  return {
    ok: true,
    value: { fullName, mobile, password, securityQuestionId, securityAnswer },
  };
}
