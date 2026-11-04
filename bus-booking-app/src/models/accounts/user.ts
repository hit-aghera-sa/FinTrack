import type { SecurityQuestionId } from './security-questions.js';

/**
 * THE ACCOUNT DOMAIN of Bus Booking App — declared once here and imported by every auth, profile,
 * registration, password-reset and devices lane.
 *
 * Dates are ISO-8601 strings everywhere above the data layer, so a value read from a repository can
 * be put straight into a JSON response and compared without a Date instance in sight.
 */

/** The signed-in traveller as the API hands them to the client: never a hash, never a counter. */
export interface AuthUser {
  id: string;
  fullName: string;
  /** The 10-digit Indian mobile number. It is the login identifier and never changes. */
  mobile: string;
  securityQuestionId: SecurityQuestionId;
}

/**
 * The whole stored account, including the credential hashes and the two abuse counters:
 * failedLoginCount / lockedUntil guard log-in, failedResetCount / resetBlockedUntil guard the
 * security-question password reset.
 */
export interface UserRecord extends AuthUser {
  passwordHash: string;
  /** bcrypt hash of the case-insensitively normalised answer. */
  securityAnswerHash: string;
  failedLoginCount: number;
  /** ISO-8601 instant the log-in lock expires, or null when the account is not locked. */
  lockedUntil: string | null;
  failedResetCount: number;
  /** ISO-8601 instant the reset block expires, or null when reset is not blocked. */
  resetBlockedUntil: string | null;
  createdAt: string;
}

/** What the sign-up screen collects, before any hashing. */
export interface SignupInput {
  fullName: string;
  mobile: string;
  password: string;
  securityQuestionId: SecurityQuestionId;
  securityAnswer: string;
}

/** What the repository needs to create an account: hashes only, never a plain secret. */
export interface CreateUserInput {
  fullName: string;
  mobile: string;
  passwordHash: string;
  securityQuestionId: SecurityQuestionId;
  securityAnswerHash: string;
}

/**
 * The fields an account update may touch. The mobile number is deliberately absent: it is the login
 * identifier and immutable, and id / createdAt are never rewritten.
 */
export type UserPatch = Partial<
  Pick<
    UserRecord,
    | 'fullName'
    | 'passwordHash'
    | 'securityQuestionId'
    | 'securityAnswerHash'
    | 'failedLoginCount'
    | 'lockedUntil'
    | 'failedResetCount'
    | 'resetBlockedUntil'
  >
>;

/** Every read and write of an account the app performs. */
export interface UserRepository {
  findByMobile(mobile: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  update(id: string, patch: UserPatch): Promise<UserRecord>;
}

/** The safe public projection of a stored account: drops the hashes and the counters. */
export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    securityQuestionId: user.securityQuestionId,
  };
}
