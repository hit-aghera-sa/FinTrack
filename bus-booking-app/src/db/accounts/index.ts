import type { SessionRepository, UserRepository } from '../../models/accounts/index.js';
import { prismaSessionStore, prismaUserStore } from './prisma-stores.js';
import { createSessionRepository } from './session-repository.js';
import { createUserRepository } from './user-repository.js';

/**
 * THE IDENTITY DATA LAYER of Bus Booking App — the two repositories every auth, registration,
 * password-reset, profile, devices and account-deletion route handler imports.
 *
 * Importing this module is side-effect free: the repositories are plain objects over the shared
 * Prisma client, which connects lazily on its first query.
 */
export const userRepository: UserRepository = createUserRepository(prismaUserStore);

export const sessionRepository: SessionRepository = createSessionRepository({
  sessions: prismaSessionStore,
  users: prismaUserStore,
});

export { createUserRepository, normaliseMobile, type UserStore } from './user-repository.js';
export {
  createSessionRepository,
  type NewSessionRow,
  type SessionRepositoryDeps,
  type SessionStore,
} from './session-repository.js';
export { prismaSessionStore, prismaUserStore } from './prisma-stores.js';
export {
  compareSessionsNewestFirst,
  isoToDateOrNull,
  rowTimestampToIso,
  rowTimestampToIsoOrNull,
  toActiveSession,
  toUserRecord,
  toUserRowPatch,
  type NewUserRow,
  type RowTimestamp,
  type SessionRow,
  type UserRow,
  type UserRowPatch,
} from './rows.js';
