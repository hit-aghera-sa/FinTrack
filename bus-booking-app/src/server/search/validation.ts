import { MESSAGES } from '../../messages/index.js';
import { istDayKey, istDayWindow } from '../../db/catalogue/instant.js';

/**
 * WHAT A BUS SEARCH IS ALLOWED TO ASK FOR.
 *
 * Pure functions over the raw query values of `GET /api/trips`, so the two product rules the brief
 * names are decided in one place and tested without a server or a database:
 *
 *   • From and To must be different cities — refused with the catalogue's same-city sentence;
 *   • the travel date must be an India-time calendar day between today and today + 30 days.
 *
 * No filtering or sorting options exist, so nothing else is read from the query string.
 */

/** The last day a traveller may search for, counted from today in India time. */
export const SEARCH_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** Shown when From, To or the date is missing from the query string. */
export const MISSING_SEARCH_FIELDS_MESSAGE = 'Select a From city, a To city and a travel date.';

/** Shown when the date is not a calendar day this API understands. */
export const INVALID_DATE_MESSAGE = 'Enter the travel date as YYYY-MM-DD.';

/** Shown when the date is before today or more than 30 days ahead. */
export const DATE_OUT_OF_RANGE_MESSAGE = 'Choose a travel date from today up to 30 days ahead.';

/** A validated search: a route and one India-time calendar day. */
export interface SearchQuery {
  readonly fromCityId: string;
  readonly toCityId: string;
  /** `YYYY-MM-DD`, read in India time. */
  readonly date: string;
}

/** Why a search was refused: the API error code and the sentence the traveller is shown. */
export interface SearchQueryFailure {
  readonly code: 'invalid_request' | 'same_city' | 'invalid_date' | 'date_out_of_range';
  readonly message: string;
}

export type SearchQueryResult =
  | { readonly ok: true; readonly query: SearchQuery }
  | { readonly ok: false; readonly failure: SearchQueryFailure };

/** The raw query values as Express hands them over. */
export interface SearchQueryInput {
  readonly from?: unknown;
  readonly to?: unknown;
  readonly date?: unknown;
}

/**
 * One trimmed, non-empty string from a query value, or null.
 *
 * Express types a query value as a string, a repeated list of them, or a parsed object; only a
 * string (or the first usable string of a repeated value) is a city id or a date.
 */
export function readQueryString(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text === '' ? null : text;
  }
  if (Array.isArray(value)) {
    const entries: unknown[] = value;
    for (const entry of entries) {
      const first = readQueryString(entry);
      if (first !== null) return first;
    }
  }
  return null;
}

/**
 * How many India-time calendar days `date` is after the day `now` falls on: 0 for today, 1 for
 * tomorrow, a negative number for a day already gone. Null when `date` is not a real `YYYY-MM-DD`
 * calendar day.
 */
export function dayOffsetFromToday(date: string, now: Date): number | null {
  const day = istDayWindow(date);
  if (day === null) return null;
  const today = istDayWindow(istDayKey(now));
  if (today === null) return null;
  return Math.round((day.start.getTime() - today.start.getTime()) / DAY_MS);
}

/** Whether a calendar day is inside the bookable window (today … today + 30 days, inclusive). */
export function isWithinSearchWindow(date: string, now: Date): boolean {
  const offset = dayOffsetFromToday(date, now);
  return offset !== null && offset >= 0 && offset <= SEARCH_WINDOW_DAYS;
}

/** The whole of the search contract: a validated query, or the one reason it was refused. */
export function parseSearchQuery(input: SearchQueryInput, now: Date): SearchQueryResult {
  const fromCityId = readQueryString(input.from);
  const toCityId = readQueryString(input.to);
  const date = readQueryString(input.date);

  if (fromCityId === null || toCityId === null || date === null) {
    return { ok: false, failure: { code: 'invalid_request', message: MISSING_SEARCH_FIELDS_MESSAGE } };
  }

  if (fromCityId === toCityId) {
    return { ok: false, failure: { code: 'same_city', message: MESSAGES.sameCity } };
  }

  const offset = dayOffsetFromToday(date, now);
  if (offset === null) {
    return { ok: false, failure: { code: 'invalid_date', message: INVALID_DATE_MESSAGE } };
  }
  if (offset < 0 || offset > SEARCH_WINDOW_DAYS) {
    return { ok: false, failure: { code: 'date_out_of_range', message: DATE_OUT_OF_RANGE_MESSAGE } };
  }

  return { ok: true, query: { fromCityId, toCityId, date } };
}
