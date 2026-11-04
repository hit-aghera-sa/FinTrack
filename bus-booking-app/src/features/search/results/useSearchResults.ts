import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, UNEXPECTED_MESSAGE, apiFetch, isOfflineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import type { City, TripSummary } from '../../../models/catalogue/index.js';
import { resolveCityName, toCityList, toTripList, upcomingEarliestFirst } from './results-order.js';
import {
  CITIES_PATH,
  currentSearch,
  isCompleteQuery,
  parseResultsQuery,
  tripsRequestPath,
  type SearchResultsQuery,
} from './results-query.js';

/**
 * THE DATA BEHIND /search/results.
 *
 * Reads the route and day from the page's own address, asks the app's API for the buses still to
 * depart on that route and day (`GET /api/trips?from=&to=&date=`) plus the city list that lets the
 * screen name the route in words rather than in ids, and hands the screen an ordered list with one
 * clear state: loading, ready, error, or an address that does not yet name a search.
 */

export type SearchResultsStatus = 'loading' | 'ready' | 'error' | 'incomplete';

export interface SearchResultsState {
  readonly status: SearchResultsStatus;
  readonly query: SearchResultsQuery;
  /** The buses still to depart, earliest first. */
  readonly trips: readonly TripSummary[];
  readonly fromCityName: string;
  readonly toCityName: string;
  readonly errorMessage: string | null;
  readonly reload: () => void;
}

/** The sentence a traveller is shown for a failed search. */
export function describeSearchError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof ApiError) return error.message;
  return UNEXPECTED_MESSAGE;
}

export function useSearchResults(): SearchResultsState {
  const [search, setSearch] = useState<string>(currentSearch);
  const [trips, setTrips] = useState<readonly TripSummary[]>([]);
  const [cities, setCities] = useState<readonly City[]>([]);
  const [status, setStatus] = useState<SearchResultsStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Back and Forward change the query string without remounting this screen.
  useEffect(() => {
    const sync = (): void => {
      setSearch(currentSearch());
    };
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const query = useMemo<SearchResultsQuery>(() => parseResultsQuery(search), [search]);
  const complete = isCompleteQuery(query);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!complete) {
        setTrips([]);
        setErrorMessage(null);
        setStatus('incomplete');
        return;
      }
      setStatus('loading');
      setErrorMessage(null);
      const init = signal === undefined ? undefined : { signal };
      try {
        const [tripsPayload, citiesPayload] = await Promise.all([
          apiFetch<unknown>(tripsRequestPath(query), init),
          // The city names are a nicety: a failure there must not hide the buses.
          apiFetch<unknown>(CITIES_PATH, init).catch((): unknown => []),
        ]);
        if (signal?.aborted === true) return;
        setTrips(toTripList(tripsPayload));
        setCities(toCityList(citiesPayload));
        setStatus('ready');
      } catch (error: unknown) {
        if (signal?.aborted === true) return;
        setErrorMessage(describeSearchError(error));
        setStatus('error');
      }
    },
    [complete, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  const orderedTrips = useMemo<readonly TripSummary[]>(
    () => upcomingEarliestFirst(trips, new Date()),
    [trips],
  );

  return {
    status,
    query,
    trips: orderedTrips,
    fromCityName: resolveCityName(query.fromCityId, cities, trips),
    toCityName: resolveCityName(query.toCityId, cities, trips),
    errorMessage,
    reload,
  };
}
