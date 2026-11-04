/**
 * THE PROFILE CREDENTIAL FORMS.
 *
 * Two self-contained forms — change password, change security question — each of which validates what
 * was typed, posts to the profile credential endpoints through the shared API client, and resets
 * cleanly after a success. They take no props, so the profile screen (or the change-password page)
 * composes them wherever the product wants them.
 */
export { ChangePasswordForm } from './ChangePasswordForm';
export { ChangeSecurityQuestionForm } from './ChangeSecurityQuestionForm';
export { ProfileChangePasswordScreen } from './ProfileChangePasswordScreen';
export { ProfileChangePasswordPage } from './ProfileChangePasswordPage';
export {
  CURRENT_PASSWORD_REQUIRED_MESSAGE,
  PASSWORD_HINT,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
  SECURITY_ANSWER_REQUIRED_MESSAGE,
  SECURITY_QUESTION_CHANGED_MESSAGE,
  SECURITY_QUESTION_REQUIRED_MESSAGE,
  hasAnyError,
  messageForError,
  validateNewPassword,
  validatePasswordForm,
  validateSecurityQuestionForm,
  type PasswordFormErrors,
  type PasswordFormValues,
  type SecurityQuestionFormErrors,
  type SecurityQuestionFormValues,
} from './validation.js';
