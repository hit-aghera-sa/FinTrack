import { prisma } from '../client/index.js';
/**
 * THE SQL SURFACE the booking source runs on, backed by the app's own Prisma client.
 *
 * Importing this opens no connection — Prisma connects lazily on the first query. `transaction` uses
 * an interactive transaction, so the advisory lock, the seat re-check and every write of one booking
 * share a single database transaction.
 */
export const prismaBookingSqlRunner = {
    async query(text, params) {
        const rows = await prisma.$queryRawUnsafe(text, ...(params ?? []));
        return Array.isArray(rows) ? rows : [];
    },
    transaction(run) {
        return prisma.$transaction(async (tx) => {
            const scoped = {
                async query(text, params) {
                    const rows = await tx.$queryRawUnsafe(text, ...(params ?? []));
                    return Array.isArray(rows) ? rows : [];
                },
            };
            return run(scoped);
        });
    },
};
