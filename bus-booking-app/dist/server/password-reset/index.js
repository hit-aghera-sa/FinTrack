/**
 * THE PASSWORD-RESET LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `passwordResetRouter` under `/api`; everything else here exists so the
 * rules can be read and tested without an HTTP server.
 */
export { passwordResetRouter } from './router.js';
export { ANSWER_REQUIRED_MESSAGE, createPasswordResetService, INVALID_MOBILE_MESSAGE, } from './service.js';
export { afterSuccessfulReset, afterWrongAnswer, decoyQuestion, decoyQuestionIndex, isResetBlocked, isWellFormedMobile, MAX_FAILED_RESET_ANSWERS, normaliseResetMobile, questionForAccount, RESET_BLOCK_MINUTES, RESET_BLOCK_MS, resetBlockRemainingMs, } from './reset-policy.js';
