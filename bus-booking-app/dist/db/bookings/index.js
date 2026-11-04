import { tripRepository } from '../catalogue/index.js';
import { createBookingRepository } from './booking-repository.js';
import { createPrismaBookingSource } from './prisma-source.js';
import { prismaBookingSqlRunner } from './sql-runner.js';
/**
 * THE BOOKING & PASSENGER DATA ACCESS of Bus Booking App.
 *
 * `bookingRepository` is what seat-map booking creation, my bookings, the ticket view and
 * cancellation all read and write through. The trip's details come from the catalogue's
 * `tripRepository`, so a ticket and a seat map can never disagree about a bus.
 *
 * Importing this module opens no connection: the Prisma client connects lazily on the first query
 * and the source learns the booking tables' physical column names on its first call.
 */
export const bookingRepository = createBookingRepository({
    bookings: createPrismaBookingSource(prismaBookingSqlRunner),
    trips: tripRepository,
});
export { compareBookingsNewestFirst, createBookingRepository, randomBookingId, toBookingRecord, } from './booking-repository.js';
export { createPrismaBookingSource, istClock, resolveBookingNames, textArrayLiteral, } from './prisma-source.js';
export { prismaBookingSqlRunner } from './sql-runner.js';
