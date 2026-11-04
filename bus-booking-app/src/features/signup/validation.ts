import { isApiError, isOfflineError, UNEXPECTED_MESSAGE } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';

/**
 * THE SIGN-UP RULES, AS THE SCREEN REFLECTS THEM.
 *
 * The server re-validates every rule below (it is the authority); these pure functions exist so a
 * traveller is told what is wrong as they type, in the same words, without a round trip. Nothing here
 * touches React, the network or the datastore, so it is exercised directly by the lane's specs.
 */

/** The two endpoints this screen talks to, written down once. */
export const SIGN_UP_PATHS = {
  questions: '/auth/security-questions',
  signup: '/auth/signup',
} as const;

export type SignUpField =
  | 'fullName'
  | 'mobile'
  | 'password'
  | 'confirmPassword'
  | 'securityQuestionId'
  | 'securityAnswer';

/** Everything the form holds, always as strings — exactly what the inputs carry. */
export interface SignUpFormValues {
  readonly fullName: string;
  readonly mobile: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly securityQuestionId: string;
  readonly securityAnswer: string;
}

/** One sentence per field that is not yet acceptable. */
export type SignUpErrors = Partial<Record<SignUpField, string>>;

/** One entry of the security-question picker: the stored id and the sentence a traveller reads. */
export interface SignUpQuestionOption {
  readonly value: string;
  readonly label: string;
}

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 60;
export const MOBILE_LENGTH = 10;
export const PASSWORD_MIN_LENGTH = 8;
export const SECURITY_ANSWER_MIN_LENGTH = 2;
export const SECURITY_ANSWER_MAX_LENGTH = 50;

export const FULL_NAME_ERROR = 'Enter a full name of 2 to 60 characters.';
export const MOBILE_ERROR = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
export const PASSWORD_ERROR = 'Use at least 8 characters, including at least one letter and one digit.';
export const SECURITY_QUESTION_ERROR = 'Choose a security question.';
export const SECURITY_ANSWER_ERROR = 'Enter a security answer of 2 to 50 characters.';

const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const LETTER_PATTERN = /[A-Za-z]/;
const DIGIT_PATTERN = /\d/;

/** What a mobile-number input keeps: digits only, so spaces and dashes never reach the API. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateFullName(value: string): string | null {
  const name = value.trim();
  if (name.length < FULL_NAME_MIN_LENGTH || name.length > FULL_NAME_MAX_LENGTH) return FULL_NAME_ERROR;
  return null;
}

export function validateMobile(value: string): string | null {
  return MOBILE_PATTERN.test(value.trim()) ? null : MOBILE_ERROR;
}

export function validatePasswordRule(value: string): string | null {
  const long = value.length >= PASSWORD_MIN_LENGTH;
  if (long && LETTER_PATTERN.test(value) && DIGIT_PATTERN.test(value)) return null;
  return PASSWORD_ERROR;
}

/** The approved wording for the one mismatch case lives in the shared catalogue. */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  return password === confirmPassword ? null : MESSAGES.passwordMismatch;
}

/**
 * The chosen question must be one of the ones actually offered. `allowed` is empty while the list is
 * still loading, and then only emptiness is refused.
 */
export function validateSecurityQuestion(value: string, allowed: readonly string[]): string | null {
  const chosen = value.trim();
  if (chosen === '') return SECURITY_QUESTION_ERROR;
  if (allowed.length > 0 && !allowed.includes(chosen)) return SECURITY_QUESTION_ERROR;
  return null;
}

export function validateSecurityAnswer(value: string): string | null {
  const answer = value.trim();
  if (answer.length < SECURITY_ANSWER_MIN_LENGTH || answer.length > SECURITY_ANSWER_MAX_LENGTH) {
    return SECURITY_ANSWER_ERROR;
  }
  return null;
}

/** Every rule of the form at once; an empty result means the form may be submitted. */
export function validateSignUpForm(
  values: SignUpFormValues,
  allowedQuestionIds: readonly string[] = [],
): SignUpErrors {
  const errors: SignUpErrors = {};

  const fullName = validateFullName(values.fullName);
  if (fullName !== null) errors.fullName = fullName;

  const mobile = validateMobile(values.mobile);
  if (mobile !== null) errors.mobile = mobile;

  const password = validatePasswordRule(values.password);
  if (password !== null) errors.password = password;

  const confirmPassword = validateConfirmPassword(values.password, values.confirmPassword);
  if (confirmPassword !== null) errors.confirmPassword = confirmPassword;

  const question = validateSecurityQuestion(values.securityQuestionId, allowedQuestionIds);
  if (question !== null) errors.securityQuestionId = question;

  const answer = validateSecurityAnswer(values.securityAnswer);
  if (answer !== null) errors.securityAnswer = answer;

  return errors;
}

export function hasErrors(errors: SignUpErrors): boolean {
  return Object.keys(errors).length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
  }
  return null;
}

/**
 * The security-question list as the picker needs it, read defensively from whatever JSON arrived: a
 * bare array or an envelope, with the id under `id`/`value` and the sentence under `label`/`question`.
 * Anything unusable yields an empty list, which the screen replaces with the shared catalogue.
 */
export function parseSecurityQuestions(payload: unknown): SignUpQuestionOption[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.questions)
      ? payload.questions
      : [];

  const options: SignUpQuestionOption[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const value = readString(entry, ['id', 'value']);
    if (value === null) continue;
    const label = readString(entry, ['label', 'question', 'text']);
    options.push({ value, label: label ?? value });
  }
  return options;
}

/** True when the API refused the sign-up because the mobile number is already an account. */
export function isDuplicateMobileError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.status === 409) return true;
  if (/duplicate|already|exists|taken/i.test(error.code)) return true;
  return error.message === MESSAGES.duplicateMobile;
}

/**
 * The sentence to show for a failed sign-up. Only catalogue wording is ever rendered: the no-internet
 * message, the duplicate-number message, or the client's general "please try again".
 */
export function signUpErrorMessage(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (isDuplicateMobileError(error)) return MESSAGES.duplicateMobile;
  return UNEXPECTED_MESSAGE;
}
