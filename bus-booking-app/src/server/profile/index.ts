/**
 * THE PROFILE LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `profileRouter` under `/api`; everything else here exists so the rules
 * can be reused and tested without a server:
 *
 *   app.use('/api', profileRouter);
 */
export { profileRouter } from './router.js';

export {
  createProfileService,
  type ProfileFailure,
  type ProfileFailureCode,
  type ProfileResult,
  type ProfileService,
  type ProfileServiceDeps,
  type ProfileSuccess,
  type ProfileUserStore,
} from './service.js';

export {
  changePasswordSchema,
  changeSecurityQuestionSchema,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  FULL_NAME_RULE_MESSAGE,
  INVALID_REQUEST_MESSAGE,
  normaliseFullName,
  normaliseSecurityAnswerInput,
  SECURITY_ANSWER_MAX_LENGTH,
  SECURITY_ANSWER_MIN_LENGTH,
  SECURITY_ANSWER_RULE_MESSAGE,
  SECURITY_QUESTION_RULE_MESSAGE,
  updateNameSchema,
  validateFullName,
  validateSecurityAnswer,
  type ChangePasswordInput,
  type ChangeSecurityQuestionInput,
  type UpdateNameInput,
} from './validation.js';
