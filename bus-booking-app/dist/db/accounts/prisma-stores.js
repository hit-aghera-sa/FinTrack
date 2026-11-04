import { prisma } from '../client/prisma.js';
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
export const prismaUserStore = {
    findByMobileNumber(mobileNumber) {
        return prisma.user.findFirst({ where: { mobileNumber } });
    },
    findById(id) {
        return prisma.user.findUnique({ where: { id } });
    },
    insert(row) {
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
    patch(id, patch) {
        return prisma.user.update({ where: { id }, data: patch });
    },
};
export const prismaSessionStore = {
    async insert(row) {
        await prisma.session.create({
            // The column is optional but not nullable, so "no device description" is an absent value.
            data: { userId: row.userId, token: row.token, userAgent: row.userAgent ?? undefined },
        });
    },
    findByToken(token) {
        return prisma.session.findFirst({ where: { token } });
    },
    async deleteByToken(token) {
        // deleteMany, so revoking a token that is already gone is not an error.
        await prisma.session.deleteMany({ where: { token } });
    },
    listByUser(userId) {
        return prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    },
    async deleteAllForUser(userId) {
        await prisma.session.deleteMany({ where: { userId } });
    },
};
