/**
 * THE CATALOGUE DOMAIN BARREL — cities, trips, seats and boarding points.
 *
 * Import the travel types from here (`src/models/catalogue`) and nowhere else; the repository that
 * implements `TripRepository` is `tripRepository` in `src/db/catalogue`.
 */
export type {
  BoardingPoint,
  BusType,
  City,
  SeatInfo,
  TripDetail,
  TripRepository,
  TripSearchParams,
  TripSummary,
  UpcomingTripsParams,
} from './types.js';
export { BUS_TYPES, BUS_TYPE_LABELS, DEFAULT_BUS_TYPE, busTypeLabel, isBusType, parseBusType } from './bus-type.js';
