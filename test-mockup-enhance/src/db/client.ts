import { PrismaClient } from "./generated.js";

/**
 * Connection string for the managed PostgreSQL instance. The platform injects
 * DATABASE_URL at publish time; the local fallback exists only so that
 * importing this module never throws during development or unit tests — no
 * connection is opened until the first query runs.
 */
const connectionUrl: string =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/postgres?schema=public";

/** Process-wide Prisma client singleton. Lazy: constructing it does not connect. */
export const prisma: PrismaClient = new PrismaClient({
  datasourceUrl: connectionUrl,
});

/** Closes the pool. Called by the server on shutdown and by the seed script. */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
