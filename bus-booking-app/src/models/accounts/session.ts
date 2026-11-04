import type { UserRecord } from './user.js';

/**
 * THE SESSION DOMAIN: one row per signed-in browser. The token is the credential the client sends as
 * a bearer token; the user agent is the device description shown on the "Active devices" screen.
 */

/** What the auth lane hands over when a log-in, sign-up or password reset succeeds. */
export interface CreateSessionInput {
  userId: string;
  token: string;
  /** The browser's User-Agent header, or null when the client sent none. */
  userAgent: string | null;
}

/** One row of the "Active devices" list. The token itself is never exposed. */
export interface ActiveSessionSummary {
  id: string;
  userAgent: string | null;
  /** ISO-8601 instant the session was created. */
  createdAt: string;
  /** True for the session making the request, so the screen can mark "This device". */
  current: boolean;
}

/** Every read and write of a session the app performs. */
export interface SessionRepository {
  create(input: CreateSessionInput): Promise<void>;
  /** The account owning this token, or null when the token is unknown or revoked. */
  findUserByToken(token: string): Promise<UserRecord | null>;
  /** Log out of one device. Revoking an unknown token is not an error. */
  deleteByToken(token: string): Promise<void>;
  /**
   * The traveller's signed-in devices, newest first. Pass the requesting session's token to have its
   * row flagged `current`; with no token every row is `current: false`.
   */
  listActiveByUser(userId: string, currentToken?: string | null): Promise<ActiveSessionSummary[]>;
  /** Sign out everywhere, and the revocation step of account deletion. */
  deleteAllForUser(userId: string): Promise<void>;
}
