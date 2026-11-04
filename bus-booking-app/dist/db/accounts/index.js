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
export const userRepository = createUserRepository(prismaUserStore);
export const sessionRepository = createSessionRepository({
    sessions: prismaSessionStore,
    users: prismaUserStore,
});
export { createUserRepository, normaliseMobile } from './user-repository.js';
export { createSessionRepository, } from './session-repository.js';
export { prismaSessionStore, prismaUserStore } from './prisma-stores.js';
export { compareSessionsNewestFirst, isoToDateOrNull, rowTimestampToIso, rowTimestampToIsoOrNull, toActiveSession, toUserRecord, toUserRowPatch, } from './rows.js';
