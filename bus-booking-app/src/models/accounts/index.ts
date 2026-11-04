/**
 * THE ACCOUNT & SESSION DOMAIN BARREL — the one import path for identity types in this app.
 *
 * Types and pure helpers only: nothing here touches the database, the network or React, so a screen,
 * a route handler and a repository can all import it.
 */
export type { SecurityQuestion, SecurityQuestionId } from './security-questions.js';
export {
  coerceSecurityQuestionId,
  DEFAULT_SECURITY_QUESTION_ID,
  isSecurityQuestionId,
  SECURITY_QUESTION_IDS,
  SECURITY_QUESTION_LABELS,
  SECURITY_QUESTIONS,
  securityQuestionLabel,
} from './security-questions.js';

export type {
  AuthUser,
  CreateUserInput,
  SignupInput,
  UserPatch,
  UserRecord,
  UserRepository,
} from './user.js';
export { toAuthUser } from './user.js';

export type {
  ActiveSessionSummary,
  CreateSessionInput,
  SessionRepository,
} from './session.js';
