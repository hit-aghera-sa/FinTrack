import {
  ApiError,
  UNEXPECTED_MESSAGE,
  apiFetch,
  isOfflineError,
  type ApiRequestInit,
} from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import type { AuthUser, SecurityQuestionId } from '../../models/accounts/index.js';

/**
 * THE TWO CALLS THE FORGOT-PASSWORD FLOW MAKES, and the one place their failures are turned into a
 * sentence a traveller can read.
 *
 *   POST /api/auth/password-reset/question { mobile }
 *        -> { securityQuestionId, label }   (answered for EVERY well-formed number)
 *   POST /api/auth/password-reset/verify   { mobile, answer, newPassword, confirmPassword }
 *        -> { user }                        (and the session cookie is set by the server)
 *
 * The transport is the app's shared `apiFetch`; it is a parameter of the factory so the flow's specs
 * can hand in a recording double without touching the network.
 */

/** The shape of the app's own API client, narrowed to what this flow uses. */
export type ApiCall = <T>(path: string, init?: ApiRequestInit) => Promise<T>;

export const QUESTION_PATH = '/auth/password-reset/question';
export const VERIFY_PATH = '/auth/password-reset/verify';

/** The security question the server reads back for the number that was entered. */
export interface SecurityQuestionPrompt {
  readonly securityQuestionId: SecurityQuestionId;
  readonly label: string;
}

/** Everything the verify call carries: the answer and the new password, checked together. */
export interface ResetVerifyInput {
  readonly mobile: string;
  readonly answer: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

/** The verify endpoint's success body. */
export interface ResetVerifyBody {
  readonly user: AuthUser;
}

export interface ResetApi {
  /** The question to read back for this number. */
  question(mobile: string): Promise<SecurityQuestionPrompt>;
  /** Sets the password when the answer is right, and returns the now signed-in traveller. */
  verify(input: ResetVerifyInput): Promise<AuthUser>;
}

export function createResetApi(call: ApiCall = apiFetch): ResetApi {
  return {
    async question(mobile: string): Promise<SecurityQuestionPrompt> {
      return call<SecurityQuestionPrompt>(QUESTION_PATH, { method: 'POST', body: { mobile } });
    },

    async verify(input: ResetVerifyInput): Promise<AuthUser> {
      const body = await call<ResetVerifyBody>(VERIFY_PATH, {
        method: 'POST',
        body: {
          mobile: input.mobile,
          answer: input.answer,
          newPassword: input.newPassword,
          confirmPassword: input.confirmPassword,
        },
      });
      return body.user;
    },
  };
}

/**
 * The sentence to show for a failed reset call. The server already answers with the shared
 * catalogue's wording, so its message is used as it stands; a request that never reached the backend
 * becomes the no-internet sentence, and anything unrecognisable becomes the generic one.
 */
export function describeResetError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return UNEXPECTED_MESSAGE;
}

/**
 * True when the refusal is about the ANSWER rather than the new password — the wrong-answer sentence
 * and the "blocked for 1 hour" sentence are the only two, and both send the traveller back to the
 * question step. Neither says anything about whether the number has an account.
 */
export function isAnswerRejected(message: string): boolean {
  return message === MESSAGES.wrongSecurityAnswer || message === MESSAGES.resetBlocked;
}
