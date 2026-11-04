import type { Router } from 'express';
import { bookingRepository } from '../../db/bookings/index.js';
import { createMyBookingsRouter } from './router.js';

/**
 * THE MY BOOKINGS LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts the router under `/api`:
 *
 *   app.use('/api', myBookingsRouter);
 *
 * which gives the app `GET /api/bookings` — the traveller's own bookings split into `upcoming`
 * (buses that have not departed, soonest first) and `past` (departed buses plus cancelled bookings,
 * newest first), each record carrying its status and `canCancel` — and `GET /api/bookings/:bookingId`,
 * one booking in full as the ticket.
 *
 * Importing this module opens no connection: `bookingRepository` is a plain object over the shared
 * Prisma client, which connects lazily on its first query.
 */
export const myBookingsRouter: Router = createMyBookingsRouter({ bookings: bookingRepository });

export {
  BOOKING_NOT_FOUND_MESSAGE,
  MY_BOOKINGS_API_PATHS,
  NOT_SIGNED_IN_MESSAGE,
  bookingTicketPath,
  createMyBookingsRouter,
} from './router.js';

export {
  createMyBookingsService,
  type MyBookingsDeps,
  type MyBookingsService,
  type MyBookingsStore,
  type TicketOutcome,
} from './service.js';

export {
  compareNewestFirst,
  compareSoonestFirst,
  instantMs,
  isUpcoming,
  splitBookings,
  type MyBookingsList,
} from './split.js';
