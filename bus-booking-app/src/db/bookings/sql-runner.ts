import { prisma } from '../client/index.js';
import type { BookingSqlRunner, SqlQuery } from './prisma-source.js';

/**
 * THE SQL SURFACE the booking source runs on, backed by the app's own Prisma client.
 *
 * Importing this opens no connection — Prisma connects lazily on the first query. `transaction` uses
 * an interactive transaction, so the advisory lock, the seat re-check and every write of one booking
 * share a single database transaction.
 */
export const prismaBookingSqlRunner: BookingSqlRunner = {
  async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(text, ...(params ?? []));
    return Array.isArray(rows) ? rows : [];
  },

  transaction<T>(run: (sql: SqlQuery) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const scoped: SqlQuery = {
        async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
          const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(text, ...(params ?? []));
          return Array.isArray(rows) ? rows : [];
        },
      };
      return run(scoped);
    });
  },
};
