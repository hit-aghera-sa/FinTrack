import type {
  ActiveSessionSummary,
  CreateSessionInput,
  SessionRepository,
  UserRecord,
} from '../../models/accounts/index.js';
import { compareSessionsNewestFirst, toActiveSession, toUserRecord, type SessionRow } from './rows.js';
import type { UserStore } from './user-repository.js';

/**
 * THE SESSION REPOSITORY, as a factory over two tiny row stores.
 *
 * `findUserByToken` resolves the owning account with a second lookup rather than a join, so this file
 * depends on nothing but the two stores below and stays testable without a database.
 */

/** The columns written when a session starts. */
export interface NewSessionRow {
  readonly userId: string;
  readonly token: string;
  readonly userAgent: string | null;
}

/** The row-level access the session repository needs. */
export interface SessionStore {
  insert(row: NewSessionRow): Promise<void>;
  findByToken(token: string): Promise<SessionRow | null>;
  deleteByToken(token: string): Promise<void>;
  listByUser(userId: string): Promise<SessionRow[]>;
  deleteAllForUser(userId: string): Promise<void>;
}

export interface SessionRepositoryDeps {
  readonly sessions: SessionStore;
  readonly users: UserStore;
}

export function createSessionRepository(deps: SessionRepositoryDeps): SessionRepository {
  return {
    async create(input: CreateSessionInput): Promise<void> {
      await deps.sessions.insert({
        userId: input.userId,
        token: input.token,
        userAgent: input.userAgent,
      });
    },

    async findUserByToken(token: string): Promise<UserRecord | null> {
      const session = await deps.sessions.findByToken(token);
      if (session === null) return null;
      const user = await deps.users.findById(session.userId);
      return user === null ? null : toUserRecord(user);
    },

    async deleteByToken(token: string): Promise<void> {
      await deps.sessions.deleteByToken(token);
    },

    async listActiveByUser(userId: string, currentToken?: string | null): Promise<ActiveSessionSummary[]> {
      const rows = await deps.sessions.listByUser(userId);
      const token = currentToken ?? null;
      return [...rows]
        .sort(compareSessionsNewestFirst)
        .map((row: SessionRow) => toActiveSession(row, token));
    },

    async deleteAllForUser(userId: string): Promise<void> {
      await deps.sessions.deleteAllForUser(userId);
    },
  };
}
