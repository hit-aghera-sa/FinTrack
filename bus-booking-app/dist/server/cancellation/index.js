/**
 * THE BOOKING CANCELLATION LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts the router under `/api`:
 *
 *   app.use('/api', cancellationRouter);
 *
 * which gives the app `POST /api/bookings/:bookingId/cancel`. The rules are exported alongside it so
 * the one-hour cut-off can be read and tested without an HTTP server.
 */
export { CANCEL_BOOKING_ROUTE, cancelBookingPath, cancellationRouter, cancellationService, createCancellationRouter, } from './router.js';
export { BOOKING_NOT_FOUND_MESSAGE, createCancellationService, httpStatusFor, isWithinCancelCutoff, msUntilDeparture, } from './service.js';
