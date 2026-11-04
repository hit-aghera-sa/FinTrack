// The `prisma.seed` / `db:seed` entry. Hashes the sample credentials with bcrypt and writes the
// sample cities, buses, trips, seat maps, boarding points and bookings through the app's own Prisma
// client. It upserts accounts and NEVER deletes them: the platform's first admin already exists
// when this runs.
import bcrypt from 'bcrypt';
import { disconnectPrisma, prisma } from '../src/db/client/index.js';
import { DEMO_TRAVELLER, normaliseSecurityAnswer, seedDatabase } from '../src/db/client/seed-data.js';

const BCRYPT_ROUNDS = 10;

async function main(): Promise<void> {
  const demoPasswordHash = await bcrypt.hash(DEMO_TRAVELLER.password, BCRYPT_ROUNDS);
  const demoSecurityAnswerHash = await bcrypt.hash(
    normaliseSecurityAnswer(DEMO_TRAVELLER.securityAnswer),
    BCRYPT_ROUNDS,
  );

  const summary = await seedDatabase(prisma, { demoPasswordHash, demoSecurityAnswerHash });

  console.log(
    `Seeded ${summary.cities} cities, ${summary.buses} buses, ${summary.trips} trips, ` +
      `${summary.seats} seats and ${summary.bookings} bookings. ` +
      `Demo traveller: ${summary.demoMobileNumber} / ${DEMO_TRAVELLER.password}`,
  );
}

try {
  await main();
} catch (error: unknown) {
  console.error('Seed failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
