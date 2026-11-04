import type { City, TripRepository, TripSummary } from '../../models/catalogue/index.js';
import { parseSearchQuery, type SearchQueryFailure, type SearchQueryInput } from './validation.js';

/**
 * THE BUS SEARCH SERVICE — the rules behind `GET /api/cities` and `GET /api/trips`.
 *
 * The catalogue repository is injected, so these rules are exercised with fixtures and run against
 * the app's own PostgreSQL in production without a second copy of them. The clock is a constructor
 * parameter with a working default (`new Date`), never a module-level setter.
 *
 * What a traveller is offered: every trip of that route on that India-time day whose departure is
 * still ahead of the moment of the search, earliest departure first. No filtering, no sorting
 * options.
 */

export type SearchTripsResult =
  | { readonly ok: true; readonly trips: TripSummary[] }
  | { readonly ok: false; readonly failure: SearchQueryFailure };

export interface SearchService {
  /** Every city the From/To pickers offer, ordered by name. */
  listCities(): Promise<City[]>;
  /** The buses still on offer for a route and date, or the one reason the search was refused. */
  searchTrips(input: SearchQueryInput): Promise<SearchTripsResult>;
  /** The next departures of any route — the shortcut the search screen offers before a search. */
  listUpcomingTrips(): Promise<TripSummary[]>;
}

/** How many next departures the search screen's shortcut shows. */
export const UPCOMING_TRIPS_LIMIT = 4;

export interface SearchServiceDeps {
  readonly trips: TripRepository;
  /** The clock. Defaults to the real one; a spec passes a fixed instant. */
  readonly now?: () => Date;
}

function departureMs(trip: TripSummary): number {
  const ms = Date.parse(trip.departureAt);
  // An unreadable departure is never silently dropped from the results; it simply sorts last.
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function compareDeparture(left: TripSummary, right: TripSummary): number {
  const a = departureMs(left);
  const b = departureMs(right);
  if (a === b) return left.id.localeCompare(right.id);
  return a < b ? -1 : 1;
}

/**
 * The results as the API states them: only the buses that have NOT yet departed, earliest departure
 * first. A bus that left at or before `now` is gone, however it reached this list.
 */
export function onlyUpcoming(trips: readonly TripSummary[], now: Date): TripSummary[] {
  const cutoff = now.getTime();
  return trips.filter((trip: TripSummary) => departureMs(trip) > cutoff).sort(compareDeparture);
}

export function createSearchService(deps: SearchServiceDeps): SearchService {
  const clock = deps.now ?? ((): Date => new Date());

  return {
    listCities(): Promise<City[]> {
      return deps.trips.listCities();
    },

    async searchTrips(input: SearchQueryInput): Promise<SearchTripsResult> {
      const at = clock();
      const parsed = parseSearchQuery(input, at);
      if (!parsed.ok) return { ok: false, failure: parsed.failure };

      const found = await deps.trips.search({
        fromCityId: parsed.query.fromCityId,
        toCityId: parsed.query.toCityId,
        date: parsed.query.date,
        now: at,
      });

      return { ok: true, trips: onlyUpcoming(found, at) };
    },

    async listUpcomingTrips(): Promise<TripSummary[]> {
      const at = clock();
      const found = await deps.trips.listUpcoming({ now: at, limit: UPCOMING_TRIPS_LIMIT });
      return onlyUpcoming(found, at).slice(0, UPCOMING_TRIPS_LIMIT);
    },
  };
}
