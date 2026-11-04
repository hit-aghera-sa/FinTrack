import { Router, type Response } from 'express';
import { bookingRepository } from '../../db/bookings/index.js';
import {
  NOT_SIGNED_IN_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  requireUser,
  type AuthedRequest,
} from '../auth/index.js';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  createCancellationService,
  httpStatusFor,
  type CancellationService,
} from './service.js';

/**
 * THE BOOKING CANCELLATION ENDPOINT.
 *
 * `POST /bookings/:bookingId/cancel`, mounted by the composition root under `/api`:
 *
 *   app.use('/api', cancellationRouter);
 *
 * The guard is attached to the ROUTE, never to the router or to `/api` as a whole, so an unknown
 * `/api` address still answers the shared 404 rather than "signed out".
 *
 * Answers:
 *   200  the booking, now `status: 'CANCELLED'`, its seats already released
 *   401  nobody is signed in (from `requireUser`)
 *   404  no such booking for THIS traveller
 *   409  `{ error: { code: 'TOO_LATE', message } }` — inside the last hour, or already finished
 *   503  the datastore could not be reached
 */

/** The route this router adds, relative to the `/api` mount. */
export const CANCEL_BOOKING_ROUTE = '/bookings/:bookingId/cancel';

/** The address a client posts to for one booking, e.g. `/bookings/BB-10452/cancel`. */
export function cancelBookingPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/cancel`;
}

/** The service the running app uses: the real booking repository and the real clock. */
export const cancellationService: CancellationService = createCancellationService({
  bookings: bookingRepository,
});

async function handleCancel(service: CancellationService, req: AuthedRequest, res: Response): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    res.status(401).json({ error: { code: 'NOT_SIGNED_IN', message: NOT_SIGNED_IN_MESSAGE } });
    return;
  }

  const raw: unknown = req.params.bookingId;
  const bookingId = typeof raw === 'string' ? raw.trim() : '';
  if (bookingId === '') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: BOOKING_NOT_FOUND_MESSAGE } });
    return;
  }

  try {
    const result = await service.cancel(bookingId, user.id);
    if (!result.ok) {
      res.status(httpStatusFor(result.code)).json({ error: { code: result.code, message: result.message } });
      return;
    }
    res.status(200).json(result.booking);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[cancellation] POST ${CANCEL_BOOKING_ROUTE} failed: ${detail}`);
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: SERVICE_UNAVAILABLE_MESSAGE } });
  }
}

/** The router, with the service as a parameter so a spec can drive it without a database. */
export function createCancellationRouter(service: CancellationService = cancellationService): Router {
  const router = Router();

  router.post(CANCEL_BOOKING_ROUTE, requireUser, (req: AuthedRequest, res: Response) => {
    void handleCancel(service, req, res);
  });

  return router;
}

export const cancellationRouter: Router = createCancellationRouter();
