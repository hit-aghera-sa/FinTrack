import { ApiError, UNEXPECTED_MESSAGE, isOfflineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { isSecurityQuestionId } from '../../../models/accounts/index.js';

/**
 * THE RULES BEHIND THE TWO CREDENTIAL FORMS of the profile screen.
 *
 * Pure functions and sentences only: no React, no fetching. The server is the authority on whether a
 * password is acceptable and whether the current password is right; these checks exist so a traveller
 * is told about an obvious mistake (an empty field, two different new passwords, a password that
 * cannot possibly pass the rule) without a round trip, and so the forms never post a request they
 * already know is refused.
 *
 * Every sentence that belongs to the whole product — the mismatch line, the no-internet line, the
 * password-changed line — comes from the shared MESSAGES catalogue and is never retyped here.
 */

/** The shortest password the product accepts. */
export const PASSWORD_MIN_LENGTH = 8;

/** The hint shown under the new-password field before anything is typed. */
export const PASSWORD_HINT = 'At least 8 characters, with a letter and a digit.';

/** What a traveller is told when the new password cannot satisfy the rule. */
export const PASSWORD_RULE_MESSAGE = 'Use at least 8 characters, including a letter and a digit.';

/** Both forms are guarded by the current password. */
export const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Enter your current password.';

/** No question chosen in the change-security-question form. */
export const SECURITY_QUESTION_REQUIRED_MESSAGE = 'Choose a security question.';

/** No answer typed in the change-security-question form. */
export const SECURITY_ANSWER_REQUIRED_MESSAGE = 'Enter the answer to your security question.';

/** Shown when the security question and answer have been replaced. */
export const SECURITY_QUESTION_CHANGED_MESSAGE = 'Your security question has been changed.';

export interface PasswordFormValues {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

export interface PasswordFormErrors {
  readonly currentPassword: string | null;
  readonly newPassword: string | null;
  readonly confirmPassword: string | null;
}

export interface SecurityQuestionFormValues {
  readonly currentPassword: string;
  readonly securityQuestionId: string;
  readonly securityAnswer: string;
}

export interface SecurityQuestionFormErrors {
  readonly currentPassword: string | null;
  readonly securityQuestionId: string | null;
  readonly securityAnswer: string | null;
}

/** The new password's own rule: long enough, and not only letters or only digits. */
export function validateNewPassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (!/[A-Za-z]/.test(value)) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(value)) return PASSWORD_RULE_MESSAGE;
  return null;
}

/** Every field of the change-password form, checked at once so one submit reports every problem. */
export function validatePasswordForm(values: PasswordFormValues): PasswordFormErrors {
  const mismatch = values.confirmPassword === '' || values.newPassword !== values.confirmPassword;
  return {
    currentPassword: values.currentPassword === '' ? CURRENT_PASSWORD_REQUIRED_MESSAGE : null,
    newPassword: validateNewPassword(values.newPassword),
    confirmPassword: mismatch ? MESSAGES.passwordMismatch : null,
  };
}

/** Every field of the change-security-question form, which is guarded by the current password. */
export function validateSecurityQuestionForm(values: SecurityQuestionFormValues): SecurityQuestionFormErrors {
  return {
    currentPassword: values.currentPassword === '' ? CURRENT_PASSWORD_REQUIRED_MESSAGE : null,
    securityQuestionId: isSecurityQuestionId(values.securityQuestionId)
      ? null
      : SECURITY_QUESTION_REQUIRED_MESSAGE,
    securityAnswer: values.securityAnswer.trim() === '' ? SECURITY_ANSWER_REQUIRED_MESSAGE : null,
  };
}

/** True when any field of a form reported a problem. */
export function hasAnyError(messages: ReadonlyArray<string | null>): boolean {
  return messages.some((message: string | null) => message !== null);
}

/**
 * The sentence to show for a failed credential change. A request that never reached the backend is the
 * no-internet line; a refusal carries the server's own catalogue wording; anything else falls back to
 * the client's unexpected-response line, so a raw error string is never rendered.
 */
export function messageForError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError && error.message.trim() !== '') return error.message;
  return UNEXPECTED_MESSAGE;
}
