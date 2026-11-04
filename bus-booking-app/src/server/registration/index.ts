/**
 * THE ACCOUNT SIGNUP LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `signupRouter` under `/api`, which gives the app
 * `GET /api/auth/security-questions` and `POST /api/auth/signup`.
 *
 * The validation rules and the sign-up service are exported too, so the messages a client shows and
 * the rules the server enforces can never drift into two different sets of words.
 */
export { signupRouter } from './router.js';

export {
  createSignupService,
  DUPLICATE_MOBILE_PRISMA_CODE,
  type SignupDeps,
  type SignupOutcome,
  type SignupRefusal,
  type SignupService,
  type SignupSuccess,
} from './signup-service.js';

export {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MESSAGE,
  FULL_NAME_MIN_LENGTH,
  MOBILE_MESSAGE,
  MOBILE_PATTERN,
  PASSWORD_REQUIRED_MESSAGE,
  resolveSecurityQuestionId,
  SECURITY_ANSWER_MAX_LENGTH,
  SECURITY_ANSWER_MESSAGE,
  SECURITY_ANSWER_MIN_LENGTH,
  SECURITY_QUESTION_MESSAGE,
  validateSignup,
  type PasswordRule,
  type SignupField,
  type SignupValidation,
  type SignupValidationFailure,
  type SignupValidationSuccess,
} from './validation.js';
