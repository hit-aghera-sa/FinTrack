/**
 * THE TRAVEL CATALOGUE DOMAIN — cities, trips, seat maps and boarding points — declared ONCE for the
 * whole app.
 *
 * Every lane (search API, seat map API, booking creation, and the screens behind them) imports these
 * types from `src/models/catalogue` instead of re-declaring them, so one change to the shape of a trip
 * is one change in the product.
 *
 * Types only: no React, no Prisma, no fetching. The implementation of `TripRepository` lives in
 * `src/db/catalogue`.
 */
export {};
