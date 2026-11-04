import { PrismaClient } from '@prisma/client';
const globalRef = globalThis;
export const prisma = globalRef.__busBookingPrismaClient ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalRef.__busBookingPrismaClient = prisma;
}
/** Close the pool. Called on server shutdown and at the end of the seed script. */
export async function disconnectPrisma() {
    await prisma.$disconnect();
}
