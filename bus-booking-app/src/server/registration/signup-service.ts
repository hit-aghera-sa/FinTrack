import { MESSAGES } from '../../messages/index.js';
import { toAuthUser, type AuthUser, type UserRepository } from '../../models/accounts/index.js';
import { validateSignup, type PasswordRule, type SignupField } from './validation.js';

/**
 * WHAT CREATING AN ACCOUNT MEANS, with no Express and no Prisma in sight.
 *
 * Everything the route needs to decide — the field rules, the already-registered mobile number, the
 * hashing of the password and the security answer, the welcome sentence — happens here, over the
 * repository and credential helpers handed in by the router. The session is NOT started here: that
 * needs the request and the response, so the router does it with the returned user's id.
 */

/** Prisma's unique-constraint code: two sign-ups racing on the same mobile number. */
export const DUPLICATE_MOBILE_PRISMA_CODE = 'P2002';

/** Exactly the data-layer and credential surface sign-up uses. */
export interface SignupDeps {
  readonly users: Pick<UserRepository, 'findByMobile' | 'create'>;
  readonly hashPassword: (password: string) => Promise<string>;
  readonly hashSecurityAnswer: (answer: string) => Promise<string>;
  readonly validatePassword: PasswordRule;
}

export interface SignupSuccess {
  readonly ok: true;
  readonly status: 201;
  readonly user: AuthUser;
  /** The account-created greeting, from the shared message catalogue. */
  readonly message: string;
}

export interface SignupRefusal {
  readonly ok: false;
  /** 400 for a field that breaks a rule, 409 for a mobile number that already has an account. */
  readonly status: 400 | 409;
  readonly field: SignupField | null;
  readonly message: string;
}

export type SignupOutcome = SignupSuccess | SignupRefusal;

export interface SignupService {
  /** Validate, create and return the outcome. Throws only when the database itself fails. */
  register(body: unknown): Promise<SignupOutcome>;
}

function duplicateMobile(): SignupRefusal {
  return { ok: false, status: 409, field: 'mobile', message: MESSAGES.duplicateMobile };
}

/** The `code` carried by a Prisma known-request error, when there is one. */
function errorCodeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  if (!('code' in error)) return null;
  const code = error.code;
  return typeof code === 'string' ? code : null;
}

export function createSignupService(deps: SignupDeps): SignupService {
  return {
    async register(body: unknown): Promise<SignupOutcome> {
      const parsed = validateSignup(body, deps.validatePassword);
      if (!parsed.ok) {
        return { ok: false, status: 400, field: parsed.field, message: parsed.message };
      }

      const input = parsed.value;

      const existing = await deps.users.findByMobile(input.mobile);
      if (existing !== null) {
        return duplicateMobile();
      }

      const [passwordHash, securityAnswerHash] = await Promise.all([
        deps.hashPassword(input.password),
        // The answer is hashed through the auth lane's helper, which normalises it, so it is stored
        // — and later compared — case-insensitively.
        deps.hashSecurityAnswer(input.securityAnswer),
      ]);

      try {
        const record = await deps.users.create({
          fullName: input.fullName,
          mobile: input.mobile,
          passwordHash,
          securityQuestionId: input.securityQuestionId,
          securityAnswerHash,
        });
        const user = toAuthUser(record);
        return { ok: true, status: 201, user, message: MESSAGES.welcome(user.fullName) };
      } catch (error: unknown) {
        // Someone else claimed this number between the check and the insert.
        if (errorCodeOf(error) === DUPLICATE_MOBILE_PRISMA_CODE) {
          return duplicateMobile();
        }
        throw error;
      }
    },
  };
}
