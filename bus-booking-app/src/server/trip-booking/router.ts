import express from 'express';
import type { Request, Response, Router } from 'express';
import { bookingRepository } from '../../db/bookings/index.js';
import { tripRepository } from '../../db/catalogue/index.js';
import { NOT_SIGNED_IN_MESSAGE, SERVICE_UNAVAILABLE_MESSAGE, requireUser, type AuthedRequest } from '../auth/index.js';
import {
  createTripBookingService,
  type TripBookingFailure,
  type TripBookingService,
} from './service.js';
import { INVALID_REQUEST_MESSAGE } from './validation.js';

/**
 * THE SEAT MAP AND BOOKING CREATION ENDPOINTS, mounted under `/api` by the composition root:
 *
 *   app.use('/api', tripBookingRouter);
 *
 * which gives the app `GET /api/trips/:tripId` (the seat map with each seat's number, grid position
 * and booked flag, the fare per seat and the bus's boarding points) and `POST /api/bookings` (a
 * booking for the signed-in traveller, answering 201 with its `BB-…` id, seat numbers, passengers
 * and total fare).
 *
 * The guard sits on the booking route itself, never on the whole router, so an `/api` address no
 * router matches still answers 404 rather than "signed out". The JSON body parser is attached to the
 * one route that has a body, so the endpoint reads a request whatever the composition root does.
 */

/** The seat map route, relative to the `/api` mount. */
export const TRIP_DETAIL_ROUTE = '/trips/:tripId';

/** The booking creation route, relative to the `/api` mount. */
export const BOOKINGS_ROUTE = '/bookings';

/** The addresses as a client calls them — one spelling for client and server alike. */
export const TRIP_BOOKING_API_PATHS = {
  tripDetail: (tripId: string): string => `/api/trips/${encodeURIComponent(tripId)}`,
  bookings: '/api/bookings',
} as const;

function sendFailure(res: Response, outcome: TripBookingFailure): void {
  const body =
    outcome.conflictSeat === undefined
      ? { error: { code: outcome.code, message: outcome.message } }
      : { error: { code: outcome.code, message: outcome.message, seatNumber: outcome.conflictSeat } };
  res.status(outcome.status).json(body);
}

function sendUnavailable(res: Response, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[trip-booking] ${detail}`);
  res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: SERVICE_UNAVAILABLE_MESSAGE } });
}

async function handleSeatMap(service: TripBookingService, req: Request, res: Response): Promise<void> {
  const raw: unknown = req.params.tripId;
  const tripId = typeof raw === 'string' ? raw.trim() : '';
  if (tripId === '') {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: INVALID_REQUEST_MESSAGE } });
    return;
  }

  try {
    const outcome = await service.seatMap(tripId);
    if (!outcome.ok) {
      sendFailure(res, outcome);
      return;
    }
    res.status(200).json(outcome.trip);
  } catch (error: unknown) {
    sendUnavailable(res, error);
  }
}

async function handleCreateBooking(
  service: TripBookingService,
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const user = req.user;
  if (user === undefined) {
    res.status(401).json({ error: { code: 'NOT_SIGNED_IN', message: NOT_SIGNED_IN_MESSAGE } });
    return;
  }

  const body: unknown = req.body;

  try {
    const outcome = await service.createBooking(user.id, body);
    if (!outcome.ok) {
      sendFailure(res, outcome);
      return;
    }
    res.status(201).json(outcome.booking);
  } catch (error: unknown) {
    sendUnavailable(res, error);
  }
}

/** The router over any service — the specs build one with in-memory doubles. */
export function createTripBookingRouter(service: TripBookingService): Router {
  const router: Router = express.Router();

  router.get(TRIP_DETAIL_ROUTE, (req: Request, res: Response): void => {
    void handleSeatMap(service, req, res);
  });

  router.post(
    BOOKINGS_ROUTE,
    express.json(),
    requireUser,
    (req: AuthedRequest, res: Response): void => {
      void handleCreateBooking(service, req, res);
    },
  );

  return router;
}

/** The app's own router, reading and writing through the real data layer. */
export const tripBookingRouter: Router = createTripBookingRouter(
  createTripBookingService({ trips: tripRepository, bookings: bookingRepository }),
);
