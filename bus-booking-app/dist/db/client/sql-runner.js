import { prisma } from './prisma.js';
/**
 * The two-method SQL surface the built-in job queue needs, backed by the app's own Prisma client.
 * The server composition root passes this to `createPostgresJobQueue({ query: ... })`.
 */
export const prismaSqlRunner = {
    async query(text, params) {
        const rows = await prisma.$queryRawUnsafe(text, ...(params ?? []));
        return Array.isArray(rows) ? rows : [];
    },
};
