/**
 * THE PROFILE LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `profileRouter` under `/api`; everything else here exists so the rules
 * can be reused and tested without a server:
 *
 *   app.use('/api', profileRouter);
 */
export { profileRouter } from './router.js';
export { createProfileService, } from './service.js';
export { changePasswordSchema, changeSecurityQuestionSchema, FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH, FULL_NAME_RULE_MESSAGE, INVALID_REQUEST_MESSAGE, normaliseFullName, normaliseSecurityAnswerInput, SECURITY_ANSWER_MAX_LENGTH, SECURITY_ANSWER_MIN_LENGTH, SECURITY_ANSWER_RULE_MESSAGE, SECURITY_QUESTION_RULE_MESSAGE, updateNameSchema, validateFullName, validateSecurityAnswer, } from './validation.js';
