import { Router, type Response } from 'express';
import { requireUser, SERVICE_UNAVAILABLE_MESSAGE, type AuthedRequest } from '../auth/index.js';
import { createMyBookingsService, type MyBookingsDeps, type MyBookingsService } from './service.js';

/**
 * THE MY BOOKINGS ROUTES, mounted by the composition root under `/api`:
 *
 *   app.use('/api', myBookingsRouter);
 *
 * which gives the app `GET /api/bookings` and `GET /api/bookings/:bookingId`.
 *
 * The guard is attached PER ROUTE — never `router.use(requireUser)` — so an `/api` path no router
 * matches still reaches the composition root's JSON 404 instead of being answered "signed out".
 */

/** The two addresses of this lane, so a client never retypes them. */
export const MY_BOOKINGS_API_PATHS = {
  list: '/bookings',
  detail: '/bookings/:bookingId',
} as const;

/** What a traveller is told when no booking of theirs carries that id. */
export const BOOKING_NOT_FOUND_MESSAGE = 'Booking not found.';

/** What a caller with no session is told. */
export const NOT_SIGNED_IN_MESSAGE = 'Please log in to continue.';

/** The ticket address of one booking, e.g. `/bookings/BB-10452`. */
export function bookingTicketPath(bookingId: string): string {
  return `${MY_BOOKINGS_API_PATHS.list}/${encodeURIComponent(bookingId)}`;
}

/** The app's one error body shape: `{ error: { code, message } }`. */
function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Build the router over a given booking store — the app wires the real repository in
 * `index.ts`, specs wire an in-memory double.
 */
export function createMyBookingsRouter(deps: MyBookingsDeps): Router {
  const service: MyBookingsService = createMyBookingsService(deps);
  const router = Router();

  router.get(MY_BOOKINGS_API_PATHS.list, requireUser, async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (userId === undefined) {
      fail(res, 401, 'not_signed_in', NOT_SIGNED_IN_MESSAGE);
      return;
    }
    try {
      const bookings = await service.list(userId);
      res.status(200).json(bookings);
    } catch (error: unknown) {
      console.error('GET /api/bookings failed:', describe(error));
      fail(res, 503, 'service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
    }
  });

  router.get(MY_BOOKINGS_API_PATHS.detail, requireUser, async (req: AuthedRequest, res: Response) => {
    const userId = req.user?.id;
    if (userId === undefined) {
      fail(res, 401, 'not_signed_in', NOT_SIGNED_IN_MESSAGE);
      return;
    }
    const raw = req.params.bookingId;
    const bookingId = typeof raw === 'string' ? raw.trim() : '';
    if (bookingId === '') {
      fail(res, 404, 'booking_not_found', BOOKING_NOT_FOUND_MESSAGE);
      return;
    }
    try {
      const outcome = await service.ticket(bookingId, userId);
      if (!outcome.ok) {
        // Another traveller's booking is indistinguishable from one that does not exist.
        fail(res, 404, 'booking_not_found', BOOKING_NOT_FOUND_MESSAGE);
        return;
      }
      res.status(200).json(outcome.booking);
    } catch (error: unknown) {
      console.error('GET /api/bookings/:bookingId failed:', describe(error));
      fail(res, 503, 'service_unavailable', SERVICE_UNAVAILABLE_MESSAGE);
    }
  });

  return router;
}
