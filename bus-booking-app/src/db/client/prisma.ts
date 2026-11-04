import { PrismaClient } from '@prisma/client';

/**
 * THE app's single PrismaClient.
 *
 * Constructing the client does NOT open a connection — Prisma connects lazily on the first query —
 * so importing this module stays side-effect free. In development the instance is kept on the global
 * object so a hot reload does not leak a new client (and a new connection pool) on every edit.
 */
interface PrismaGlobal {
  __busBookingPrismaClient?: PrismaClient;
}

const globalRef = globalThis as unknown as PrismaGlobal;

export const prisma: PrismaClient = globalRef.__busBookingPrismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalRef.__busBookingPrismaClient = prisma;
}

/** Close the pool. Called on server shutdown and at the end of the seed script. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
