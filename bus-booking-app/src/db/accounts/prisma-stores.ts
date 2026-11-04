import { prisma } from '../client/prisma.js';
import type { NewUserRow, SessionRow, UserRow, UserRowPatch } from './rows.js';
import type { NewSessionRow, SessionStore } from './session-repository.js';
import type { UserStore } from './user-repository.js';

/**
 * THE PRISMA-BACKED ROW STORES for the User and Session tables.
 *
 * The only place in the identity data layer that mentions Prisma. Importing this module opens no
 * connection: the client connects lazily on its first query.
 *
 * Lookups by token and by mobile number use `findFirst`, which needs no unique attribute, and a
 * session's account is resolved by a second query rather than by a relation include — so a change in
 * the schema lane's index or relation naming cannot break this file.
 */

export const prismaUserStore: UserStore = {
  findByMobileNumber(mobileNumber: string): Promise<UserRow | null> {
    return prisma.user.findFirst({ where: { mobileNumber } });
  },

  findById(id: string): Promise<UserRow | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  insert(row: NewUserRow): Promise<UserRow> {
    return prisma.user.create({
      data: {
        fullName: row.fullName,
        mobileNumber: row.mobileNumber,
        passwordHash: row.passwordHash,
        securityQuestionId: row.securityQuestionId,
        securityAnswerHash: row.securityAnswerHash,
        failedLoginCount: 0,
        failedResetCount: 0,
      },
    });
  },

  patch(id: string, patch: UserRowPatch): Promise<UserRow> {
    return prisma.user.update({ where: { id }, data: patch });
  },
};

export const prismaSessionStore: SessionStore = {
  async insert(row: NewSessionRow): Promise<void> {
    await prisma.session.create({
      // The column is optional but not nullable, so "no device description" is an absent value.
      data: { userId: row.userId, token: row.token, userAgent: row.userAgent ?? undefined },
    });
  },

  findByToken(token: string): Promise<SessionRow | null> {
    return prisma.session.findFirst({ where: { token } });
  },

  async deleteByToken(token: string): Promise<void> {
    // deleteMany, so revoking a token that is already gone is not an error.
    await prisma.session.deleteMany({ where: { token } });
  },

  listByUser(userId: string): Promise<SessionRow[]> {
    return prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  async deleteAllForUser(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  },
};
