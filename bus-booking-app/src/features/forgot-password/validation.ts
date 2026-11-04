import { MESSAGES } from '../../messages/index.js';

/**
 * THE CLIENT-SIDE RULES OF THE FORGOT-PASSWORD FLOW.
 *
 * Pure functions only: no React, no fetching, no server code (the password rules are re-stated here
 * for the browser because the server's copy lives behind bcrypt and must never reach the bundle).
 *
 * Nothing here can reveal whether a mobile number has an account — the only thing checked locally is
 * the SHAPE of what the traveller typed. Every other refusal comes back from the API with the shared
 * catalogue's wording.
 */

/** An Indian mobile number as this product stores it: ten digits, first digit 6-9. */
export const MOBILE_DIGITS = 10;
export const MOBILE_PATTERN = /^[6-9]\d{9}$/u;

/** The signup password rules, applied unchanged to the new password. */
export const PASSWORD_MIN_LENGTH = 8;

export const MOBILE_RULE_MESSAGE = 'Enter the 10-digit mobile number of the account.';
export const ANSWER_REQUIRED_MESSAGE = 'Enter the answer to your security question.';
export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include a letter and a number.';

/** What the mobile field keeps as the traveller types: digits only, never more than ten. */
export function normaliseMobileInput(raw: string): string {
  return raw.replace(/\D/gu, '').slice(0, MOBILE_DIGITS);
}

/** The mobile step's refusal, or null when the number is well formed. */
export function validateMobile(raw: string): string | null {
  return MOBILE_PATTERN.test(normaliseMobileInput(raw)) ? null : MOBILE_RULE_MESSAGE;
}

/** The answer step's refusal, or null when something was typed. Case and spacing are the API's business. */
export function validateAnswer(raw: string): string | null {
  return raw.trim() === '' ? ANSWER_REQUIRED_MESSAGE : null;
}

/** The password rule on its own: length, at least one letter, at least one digit. */
export function validatePasswordRule(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/[a-z]/iu.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/\d/u.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}

/** The whole new-password step: the rule first, then the two fields agreeing. */
export function validateNewPassword(password: string, confirmPassword: string): string | null {
  const rule = validatePasswordRule(password);
  if (rule !== null) return rule;
  if (password !== confirmPassword) return MESSAGES.passwordMismatch;
  return null;
}
