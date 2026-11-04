import type { SqlRunner } from '../../builtins/jobs.js';
import { prisma } from './prisma.js';

/**
 * The two-method SQL surface the built-in job queue needs, backed by the app's own Prisma client.
 * The server composition root passes this to `createPostgresJobQueue({ query: ... })`.
 */
export const prismaSqlRunner: SqlRunner = {
  async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(text, ...(params ?? []));
    return Array.isArray(rows) ? rows : [];
  },
};
