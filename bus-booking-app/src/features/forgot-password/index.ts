/**
 * THE FORGOT PASSWORD FEATURE — one screen at /forgot-password holding all three steps.
 *
 * `ForgotPasswordScreen` returns only its own content; the app shell draws whatever frame the route
 * table asks for. `ForgotPasswordPage` is the thin container the mockup route table mounts.
 */
export { ForgotPasswordScreen, SEARCH_PATH } from './ForgotPasswordScreen';
export { ForgotPasswordPage } from './ForgotPasswordPage';
export {
  QUESTION_PATH,
  VERIFY_PATH,
  createResetApi,
  describeResetError,
  isAnswerRejected,
  type ApiCall,
  type ResetApi,
  type ResetVerifyInput,
  type SecurityQuestionPrompt,
} from './reset-flow.js';
export {
  ANSWER_REQUIRED_MESSAGE,
  MOBILE_RULE_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  normaliseMobileInput,
  validateAnswer,
  validateMobile,
  validateNewPassword,
} from './validation.js';
