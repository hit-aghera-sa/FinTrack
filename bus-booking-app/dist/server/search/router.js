import { Router } from 'express';
import { tripRepository } from '../../db/catalogue/index.js';
import { createSearchService } from './service.js';
/**
 * THE BUS SEARCH ROUTER, mounted by the composition root under `/api`:
 *
 *   GET /api/cities                        → City[]        (the From/To picker list)
 *   GET /api/trips?from=&to=&date=         → TripSummary[] (buses still to depart, earliest first)
 *   GET /api/trips/upcoming                → TripSummary[] (the next departures of any route)
 *
 * Both are public: a traveller searches before signing in and only needs an account to hold seats.
 * A refused search answers 400 with the app's own sentence; a catalogue that cannot be read answers
 * 503 — never a stale or in-memory substitute.
 */
/** The ONE spelling of these addresses, for the client and the server alike. */
export const SEARCH_API_PATHS = {
    cities: '/api/cities',
    trips: '/api/trips',
    upcomingTrips: '/api/trips/upcoming',
};
/** Shown when the catalogue cannot be read right now. */
export const SEARCH_UNAVAILABLE_MESSAGE = 'Bus information is unavailable right now. Please try again.';
function errorBody(code, message) {
    return { error: { code, message } };
}
function respondUnavailable(res, error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[search] catalogue read failed: ${reason}`);
    res.status(503).json(errorBody('service_unavailable', SEARCH_UNAVAILABLE_MESSAGE));
}
/** The router over a given service — the seam the lane's own specs and the app share. */
export function createSearchRouter(service) {
    const router = Router();
    router.get('/cities', async (_req, res) => {
        try {
            const cities = await service.listCities();
            res.status(200).json(cities);
        }
        catch (error) {
            respondUnavailable(res, error);
        }
    });
    router.get('/trips/upcoming', async (_req, res) => {
        try {
            const trips = await service.listUpcomingTrips();
            res.status(200).json(trips);
        }
        catch (error) {
            respondUnavailable(res, error);
        }
    });
    router.get('/trips', async (req, res) => {
        try {
            const result = await service.searchTrips({
                from: req.query.from,
                to: req.query.to,
                date: req.query.date,
            });
            if (!result.ok) {
                res.status(400).json(errorBody(result.failure.code, result.failure.message));
                return;
            }
            res.status(200).json(result.trips);
        }
        catch (error) {
            respondUnavailable(res, error);
        }
    });
    return router;
}
/** The router the composition root mounts: the real catalogue, the real clock. */
export const searchRouter = createSearchRouter(createSearchService({ trips: tripRepository }));
