import { prismaSqlRunner } from '../client/index.js';
import type { TripRepository } from '../../models/catalogue/index.js';
import { createPrismaCatalogueSource } from './prisma-source.js';
import { createTripRepository } from './trip-repository.js';

/**
 * THE CITY, TRIP AND SEAT MAP DATA ACCESS of Bus Booking App.
 *
 * `tripRepository` is what the search API, the seat map API and booking creation read the catalogue
 * through. Importing this module opens no connection: the Prisma client connects lazily on the first
 * query, and the source learns the catalogue's physical column names on its first call.
 */
export const tripRepository: TripRepository = createTripRepository(createPrismaCatalogueSource(prismaSqlRunner));

export { createTripRepository, compareSeats, toTripSummary } from './trip-repository.js';
export { createPrismaCatalogueSource, resolveCatalogueNames } from './prisma-source.js';
export type { CatalogueSqlRunner, CatalogueNames } from './prisma-source.js';
export type {
  BoardingPointRow,
  CatalogueDataSource,
  CityRow,
  SeatRow,
  TripRow,
  TripSearchQuery,
} from './source.js';
export { istDayKey, istDayWindow, normalisePickupAt, parseClockMinutes, toDate, toInstant } from './instant.js';
export type { DayWindow } from './instant.js';
