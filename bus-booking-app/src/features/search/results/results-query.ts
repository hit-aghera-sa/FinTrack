import { formatDate } from '../../../format/index.js';

/**
 * THE ADDRESS OF A RESULTS PAGE, as data.
 *
 * `/search/results?from=&to=&date=` carries the whole of what this screen shows: the two city ids the
 * search form chose and the India-time calendar day (`YYYY-MM-DD`). Everything here is pure, so the
 * reading of that address is tested without a browser.
 */

/** The catalogue endpoints this screen reads, relative to the app's own `/api` prefix. */
export const TRIPS_PATH = '/trips';
export const CITIES_PATH = '/cities';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What the results screen was asked for. City ids are never rendered — they address the API. */
export interface SearchResultsQuery {
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly date: string;
}

/** The query string of the page being shown, or an empty string outside a browser. */
export function currentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

/** `'?from=c1&to=c2&date=2024-05-20'` as the three values this screen needs. */
export function parseResultsQuery(search: string): SearchResultsQuery {
  const text = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(text);
  return {
    fromCityId: (params.get('from') ?? '').trim(),
    toCityId: (params.get('to') ?? '').trim(),
    date: (params.get('date') ?? '').trim(),
  };
}

/** True when the address names a route AND a real calendar day, so a search can be run. */
export function isCompleteQuery(query: SearchResultsQuery): boolean {
  return query.fromCityId !== '' && query.toCityId !== '' && ISO_DATE.test(query.date);
}

/** The bus search request for a complete query: `/trips?from=&to=&date=`. */
export function tripsRequestPath(query: SearchResultsQuery): string {
  const params = new URLSearchParams({
    from: query.fromCityId,
    to: query.toCityId,
    date: query.date,
  });
  return `${TRIPS_PATH}?${params.toString()}`;
}

/** The travel day as the product writes dates (DD/MM/YYYY), or '' when the address carried none. */
export function formatTravelDate(date: string): string {
  if (!ISO_DATE.test(date)) return '';
  return formatDate(`${date}T00:00:00.000Z`);
}
