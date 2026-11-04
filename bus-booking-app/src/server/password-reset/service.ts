import { MESSAGES } from '../../messages/index.js';
import type { AuthUser, UserRecord, UserRepository } from '../../models/accounts/index.js';
import {
  afterSuccessfulReset,
  afterWrongAnswer,
  isResetBlocked,
  isWellFormedMobile,
  normaliseResetMobile,
  questionForAccount,
  type ResetAnswerState,
  type ResetQuestion,
} from './reset-policy.js';

/**
 * FORGOT PASSWORD, as a service the router is a thin shell over.
 *
 * Two steps, one promise: ask for the security question of ANY well-formed mobile number, then answer
 * it and set a new password. The question step never says whether the number has an account, and the
 * verify step refuses every answer for a number that has none with the very same sentence a wrong
 * answer gets, so the flow leaks nothing.
 *
 * Every dependency is handed in by the composition root (`router.ts`) — the repository, the credential
 * helpers of the auth lane, and the clock the specs replace.
 */

/** Shown when the mobile number is not ten digits starting 6, 7, 8 or 9. */
export const INVALID_MOBILE_MESSAGE = 'Enter a valid 10-digit mobile number.';

/** Shown when the answer field is empty. */
export const ANSWER_REQUIRED_MESSAGE = 'Enter the answer to your security question.';

/**
 * How many unregistered mobile numbers the in-process decoy throttle remembers. The decoy counter
 * exists only so an unregistered number is refused exactly like a registered one; it holds no account
 * data, so starting over when the map grows large loses nothing of value.
 */
const MAX_TRACKED_DECOYS = 2000;

export interface PasswordResetDeps {
  readonly users: UserRepository;
  /** The auth lane's `verifySecurityAnswer` — it normalises case, so answers match case-insensitively. */
  readonly verifyAnswer: (answer: string, hash: string) => Promise<boolean>;
  readonly hashPassword: (password: string) => Promise<string>;
  /** The auth lane's `validatePassword`: the rule message, or null when the password is acceptable. */
  readonly validatePassword: (password: string) => string | null;
  /** The clock. Production leaves it out; the specs pass a fixed instant. */
  readonly now?: () => number;
}

export interface QuestionRequest {
  readonly mobile: string;
}

export interface VerifyRequest {
  readonly mobile: string;
  readonly answer: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

/** A refusal, with the HTTP status the router should answer and the sentence to show. */
export interface ResetFailure {
  readonly ok: false;
  readonly status: number;
  readonly message: string;
}

export interface QuestionSuccess extends ResetQuestion {
  readonly ok: true;
}

export type QuestionOutcome = QuestionSuccess | ResetFailure;

export interface VerifySuccess {
  readonly ok: true;
  readonly user: AuthUser;
}

export type VerifyOutcome = VerifySuccess | ResetFailure;

export interface PasswordResetService {
  question(input: QuestionRequest): Promise<QuestionOutcome>;
  verify(input: VerifyRequest): Promise<VerifyOutcome>;
}

function failure(status: number, message: string): ResetFailure {
  return { ok: false, status, message };
}

function authUserOf(record: UserRecord): AuthUser {
  return {
    id: record.id,
    fullName: record.fullName,
    mobile: record.mobile,
    securityQuestionId: record.securityQuestionId,
  };
}

export function createPasswordResetService(deps: PasswordResetDeps): PasswordResetService {
  const clock = deps.now ?? ((): number => Date.now());

  /** Wrong-answer counters for numbers with no account, so the decoy path throttles identically. */
  const decoyAttempts = new Map<string, ResetAnswerState>();

  function refuseDecoy(mobile: string, nowMs: number): ResetFailure {
    const tracked = decoyAttempts.get(mobile);
    const state: ResetAnswerState = tracked ?? { failedResetCount: 0, resetBlockedUntil: null };

    if (isResetBlocked(state, nowMs)) return failure(429, MESSAGES.resetBlocked);

    const wrong = afterWrongAnswer(state, nowMs);
    if (decoyAttempts.size >= MAX_TRACKED_DECOYS) decoyAttempts.clear();
    decoyAttempts.set(mobile, wrong.patch);

    return wrong.blocked ? failure(429, MESSAGES.resetBlocked) : failure(400, MESSAGES.wrongSecurityAnswer);
  }

  return {
    async question(input: QuestionRequest): Promise<QuestionOutcome> {
      if (!isWellFormedMobile(input.mobile)) return failure(400, INVALID_MOBILE_MESSAGE);

      const mobile = normaliseResetMobile(input.mobile);
      const account = await deps.users.findByMobile(mobile);
      const question = questionForAccount(mobile, account === null ? null : account.securityQuestionId);

      return { ok: true, securityQuestionId: question.securityQuestionId, label: question.label };
    },

    async verify(input: VerifyRequest): Promise<VerifyOutcome> {
      if (!isWellFormedMobile(input.mobile)) return failure(400, INVALID_MOBILE_MESSAGE);

      const answer = input.answer.trim();
      if (answer === '') return failure(400, ANSWER_REQUIRED_MESSAGE);

      const mobile = normaliseResetMobile(input.mobile);
      const nowMs = clock();
      const account = await deps.users.findByMobile(mobile);

      // No account: the decoy is refused with the identical wrong-answer sentence, and throttled the
      // same way, so nothing about this number can be inferred from the reply.
      if (account === null) return refuseDecoy(mobile, nowMs);

      if (isResetBlocked(account, nowMs)) return failure(429, MESSAGES.resetBlocked);

      const correct = await deps.verifyAnswer(answer, account.securityAnswerHash);
      if (!correct) {
        const wrong = afterWrongAnswer(account, nowMs);
        await deps.users.update(account.id, {
          failedResetCount: wrong.patch.failedResetCount,
          resetBlockedUntil: wrong.patch.resetBlockedUntil,
        });
        return wrong.blocked ? failure(429, MESSAGES.resetBlocked) : failure(400, MESSAGES.wrongSecurityAnswer);
      }

      const ruleMessage = deps.validatePassword(input.newPassword);
      if (ruleMessage !== null) return failure(400, ruleMessage);
      if (input.newPassword !== input.confirmPassword) return failure(400, MESSAGES.passwordMismatch);

      const passwordHash = await deps.hashPassword(input.newPassword);
      const cleared = afterSuccessfulReset();
      const updated = await deps.users.update(account.id, {
        passwordHash,
        // A completed reset also clears the LOGIN lockout: the traveller proved who they are.
        failedLoginCount: 0,
        lockedUntil: null,
        failedResetCount: cleared.failedResetCount,
        resetBlockedUntil: cleared.resetBlockedUntil,
      });

      decoyAttempts.delete(mobile);
      return { ok: true, user: authUserOf(updated) };
    },
  };
}
