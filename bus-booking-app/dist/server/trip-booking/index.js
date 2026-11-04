/**
 * THE SEAT MAP & BOOKING CREATION LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `tripBookingRouter` under `/api`:
 *
 *   app.use('/api', tripBookingRouter);
 *
 * which gives the app `GET /api/trips/:tripId` and `POST /api/bookings`. Everything else here exists
 * so the rules and the addresses can be reused and tested without an HTTP server.
 */
export { BOOKINGS_ROUTE, TRIP_BOOKING_API_PATHS, TRIP_DETAIL_ROUTE, createTripBookingRouter, tripBookingRouter, } from './router.js';
export { BOARDING_POINT_NOT_ON_BUS_MESSAGE, TRIP_DEPARTED_MESSAGE, TRIP_NOT_FOUND_MESSAGE, createTripBookingService, hasDeparted, seatNotOnBusMessage, seatTakenFailure, } from './service.js';
export { BOARDING_POINT_REQUIRED_MESSAGE, DUPLICATE_SEAT_MESSAGE, INVALID_REQUEST_MESSAGE, MAX_SEATS_MESSAGE, PASSENGER_AGE_MAX, PASSENGER_AGE_MESSAGE, PASSENGER_AGE_MIN, PASSENGER_GENDER_MESSAGE, PASSENGER_NAME_MAX_LENGTH, PASSENGER_NAME_MESSAGE, PASSENGER_NAME_MIN_LENGTH, SEAT_REQUIRED_MESSAGE, createBookingBodySchema, firstIssueMessage, parseCreateBooking, } from './validation.js';
