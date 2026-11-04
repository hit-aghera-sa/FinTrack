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
/**
 * One trimmed, non-empty string from a query value, or null.
 *
 * Express types a query value as a string, a repeated list of them, or a parsed object; only a
 * string (or the first usable string of a repeated value) is a city id or a date.
 */
export function readQueryString(value) {
    if (typeof value === 'string') {
        const text = value.trim();
        return text === '' ? null : text;
    }
    if (Array.isArray(value)) {
        const entries = value;
        for (const entry of entries) {
            const first = readQueryString(entry);
            if (first !== null)
                return first;
        }
    }
    return null;
}
/**
 * How many India-time calendar days `date` is after the day `now` falls on: 0 for today, 1 for
 * tomorrow, a negative number for a day already gone. Null when `date` is not a real `YYYY-MM-DD`
 * calendar day.
 */
export function dayOffsetFromToday(date, now) {
    const day = istDayWindow(date);
    if (day === null)
        return null;
    const today = istDayWindow(istDayKey(now));
    if (today === null)
        return null;
    return Math.round((day.start.getTime() - today.start.getTime()) / DAY_MS);
}
/** Whether a calendar day is inside the bookable window (today … today + 30 days, inclusive). */
export function isWithinSearchWindow(date, now) {
    const offset = dayOffsetFromToday(date, now);
    return offset !== null && offset >= 0 && offset <= SEARCH_WINDOW_DAYS;
}
/** The whole of the search contract: a validated query, or the one reason it was refused. */
export function parseSearchQuery(input, now) {
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
