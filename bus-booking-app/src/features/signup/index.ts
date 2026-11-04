/**
 * THE SIGN UP FEATURE.
 *
 * `SignUpScreen` is what the app shell's route table mounts at `/signup` (public, panel frame). It
 * renders only its own content and reaches the backend over the app's `/api` surface:
 * `GET /api/auth/security-questions` for the picker and `POST /api/auth/signup` to create the
 * account, after which the session is stored and the traveller lands on Search.
 */
export { SignUpScreen, SignupPage } from './SignupPage';
export { SignupForm } from './SignupForm';
export {
  SIGN_UP_PATHS,
  digitsOnly,
  hasErrors,
  isDuplicateMobileError,
  parseSecurityQuestions,
  signUpErrorMessage,
  validateConfirmPassword,
  validateFullName,
  validateMobile,
  validatePasswordRule,
  validateSecurityAnswer,
  validateSecurityQuestion,
  validateSignUpForm,
  type SignUpErrors,
  type SignUpField,
  type SignUpFormValues,
  type SignUpQuestionOption,
} from './validation.js';
