import { MESSAGES } from '../../messages/index.js';
import {
  SECURITY_QUESTIONS,
  toAuthUser,
  type AuthUser,
  type SecurityQuestion,
  type SecurityQuestionId,
  type UserRecord,
  type UserRepository,
} from '../../models/accounts/index.js';
import { NOT_SIGNED_IN_MESSAGE } from '../auth/responses.js';
import {
  normaliseFullName,
  validateFullName,
  validateSecurityAnswer,
  SECURITY_QUESTION_RULE_MESSAGE,
  type ChangePasswordInput,
  type ChangeSecurityQuestionInput,
  type UpdateNameInput,
} from './validation.js';

/**
 * THE PROFILE & CREDENTIAL CHANGE SERVICE — the rules behind `PATCH /api/profile`,
 * `POST /api/profile/password` and `POST /api/profile/security-question`.
 *
 * Everything it needs is handed to it by the factory: the account repository and the four credential
 * helpers the auth lane owns. Nothing here reads the clock, the environment or a module-level global,
 * so the whole of the behaviour below — including the current-password check and the fact that the
 * mobile number is never part of an update — is exercised with no database at all.
 *
 * THE MOBILE NUMBER IS THE LOGIN IDENTIFIER AND IS IMMUTABLE: no method takes it, and no patch this
 * file builds contains it.
 */

/** The slice of the account repository the profile routes use. */
export type ProfileUserStore = Pick<UserRepository, 'findById' | 'update'>;

export interface ProfileServiceDeps {
  readonly users: ProfileUserStore;
  /** The auth lane's bcrypt comparison. */
  readonly verifyPassword: (password: string, hash: string) => Promise<boolean>;
  readonly hashPassword: (password: string) => Promise<string>;
  /** Hashes the case-folded answer, so answers stay case-insensitive. */
  readonly hashSecurityAnswer: (answer: string) => Promise<string>;
  /** The ONE password rule of this app — sign-up's. Returns a message, or null when acceptable. */
  readonly validatePassword: (password: string) => string | null;
}

export type ProfileFailureCode =
  | 'account_missing'
  | 'wrong_current_password'
  | 'invalid_full_name'
  | 'password_mismatch'
  | 'weak_password'
  | 'invalid_security_question'
  | 'invalid_security_answer';

export interface ProfileFailure {
  readonly ok: false;
  /** The HTTP status the route answers with. */
  readonly status: number;
  readonly code: ProfileFailureCode;
  /** A sentence from the app's own message catalogue or rule set — never a raw library string. */
  readonly message: string;
}

export interface ProfileSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export type ProfileResult<T> = ProfileSuccess<T> | ProfileFailure;

export interface ProfileService {
  /** The signed-in traveller's own details. */
  getProfile(userId: string): Promise<ProfileResult<AuthUser>>;
  /** Changes the full name. The mobile number is untouched. */
  changeName(userId: string, input: UpdateNameInput): Promise<ProfileResult<AuthUser>>;
  /** Changes the password after verifying the current one. Resolves to null on success (HTTP 204). */
  changePassword(userId: string, input: ChangePasswordInput): Promise<ProfileResult<null>>;
  /** Changes the security question and answer after verifying the current password. */
  changeSecurityQuestion(
    userId: string,
    input: ChangeSecurityQuestionInput,
  ): Promise<ProfileResult<AuthUser>>;
}

const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;

function failure(status: number, code: ProfileFailureCode, message: string): ProfileFailure {
  return { ok: false, status, code, message };
}

/** The chosen question, or null when the id is not one of the fixed four. */
function asSecurityQuestionId(value: string): SecurityQuestionId | null {
  const match = SECURITY_QUESTIONS.find((question: SecurityQuestion) => question.id === value);
  return match === undefined ? null : match.id;
}

export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  async function requireRecord(userId: string): Promise<ProfileResult<UserRecord>> {
    const record = await deps.users.findById(userId);
    if (record === null) {
      // The session pointed at an account that no longer exists (deleted in another tab).
      return failure(UNAUTHORIZED, 'account_missing', NOT_SIGNED_IN_MESSAGE);
    }
    return { ok: true, value: record };
  }

  async function withVerifiedPassword(
    userId: string,
    currentPassword: string,
  ): Promise<ProfileResult<UserRecord>> {
    const found = await requireRecord(userId);
    if (!found.ok) return found;
    const matches = await deps.verifyPassword(currentPassword, found.value.passwordHash);
    if (!matches) {
      return failure(BAD_REQUEST, 'wrong_current_password', MESSAGES.currentPasswordIncorrect);
    }
    return found;
  }

  return {
    async getProfile(userId: string): Promise<ProfileResult<AuthUser>> {
      const found = await requireRecord(userId);
      if (!found.ok) return found;
      return { ok: true, value: toAuthUser(found.value) };
    },

    async changeName(userId: string, input: UpdateNameInput): Promise<ProfileResult<AuthUser>> {
      const ruleMessage = validateFullName(input.fullName);
      if (ruleMessage !== null) {
        return failure(BAD_REQUEST, 'invalid_full_name', ruleMessage);
      }
      const found = await requireRecord(userId);
      if (!found.ok) return found;

      // Only the name: the mobile number, the credentials and the counters are left alone.
      const updated = await deps.users.update(userId, { fullName: normaliseFullName(input.fullName) });
      return { ok: true, value: toAuthUser(updated) };
    },

    async changePassword(userId: string, input: ChangePasswordInput): Promise<ProfileResult<null>> {
      const verified = await withVerifiedPassword(userId, input.currentPassword);
      if (!verified.ok) return verified;

      if (input.newPassword !== input.confirmPassword) {
        return failure(BAD_REQUEST, 'password_mismatch', MESSAGES.passwordMismatch);
      }
      const ruleMessage = deps.validatePassword(input.newPassword);
      if (ruleMessage !== null) {
        return failure(BAD_REQUEST, 'weak_password', ruleMessage);
      }

      const passwordHash = await deps.hashPassword(input.newPassword);
      await deps.users.update(userId, { passwordHash });
      return { ok: true, value: null };
    },

    async changeSecurityQuestion(
      userId: string,
      input: ChangeSecurityQuestionInput,
    ): Promise<ProfileResult<AuthUser>> {
      const verified = await withVerifiedPassword(userId, input.currentPassword);
      if (!verified.ok) return verified;

      const securityQuestionId = asSecurityQuestionId(input.securityQuestionId);
      if (securityQuestionId === null) {
        return failure(BAD_REQUEST, 'invalid_security_question', SECURITY_QUESTION_RULE_MESSAGE);
      }
      const answerMessage = validateSecurityAnswer(input.securityAnswer);
      if (answerMessage !== null) {
        return failure(BAD_REQUEST, 'invalid_security_answer', answerMessage);
      }

      const securityAnswerHash = await deps.hashSecurityAnswer(input.securityAnswer);
      const updated = await deps.users.update(userId, { securityQuestionId, securityAnswerHash });
      return { ok: true, value: toAuthUser(updated) };
    },
  };
}
