import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import {
  DATE_OUT_OF_RANGE_MESSAGE,
  INVALID_DATE_MESSAGE,
  MISSING_SEARCH_FIELDS_MESSAGE,
  SEARCH_WINDOW_DAYS,
  dayOffsetFromToday,
  isWithinSearchWindow,
  parseSearchQuery,
  readQueryString,
} from './validation.js';

/** 12 June 2024, 09:30 IST. */
const NOW = new Date('2024-06-12T04:00:00.000Z');

describe('readQueryString', () => {
  it('keeps a trimmed string and refuses an empty or absent one', () => {
    expect(readQueryString('  pune  ')).toBe('pune');
    expect(readQueryString('   ')).toBeNull();
    expect(readQueryString(undefined)).toBeNull();
    expect(readQueryString(42)).toBeNull();
  });

  it('takes the first usable value of a repeated query parameter', () => {
    expect(readQueryString(['', 'mumbai'])).toBe('mumbai');
  });
});

describe('parseSearchQuery — required values', () => {
  it('refuses a search with no route or no date', () => {
    const result = parseSearchQuery({ from: 'city-pune', date: '2024-06-12' }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('invalid_request');
    expect(result.failure.message).toBe(MISSING_SEARCH_FIELDS_MESSAGE);
  });

  it('accepts a route and a date inside the window', () => {
    const result = parseSearchQuery({ from: ' city-pune ', to: 'city-mumbai', date: '2024-06-12' }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query).toEqual({ fromCityId: 'city-pune', toCityId: 'city-mumbai', date: '2024-06-12' });
  });
});

describe('parseSearchQuery — the same-city rule', () => {
  it('refuses identical From and To cities with the catalogue sentence', () => {
    const result = parseSearchQuery({ from: 'city-pune', to: 'city-pune', date: '2024-06-12' }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('same_city');
    expect(result.failure.message).toBe(MESSAGES.sameCity);
    expect(result.failure.message).toBe('From and To cannot be the same city.');
  });

  it('refuses the same city even when the date is also wrong, so one sentence is shown', () => {
    const result = parseSearchQuery({ from: 'city-pune', to: 'city-pune', date: '1999-01-01' }, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('same_city');
  });
});

describe('parseSearchQuery — the today..today+30 window', () => {
  it('accepts today and the thirtieth day ahead', () => {
    expect(parseSearchQuery({ from: 'a', to: 'b', date: '2024-06-12' }, NOW).ok).toBe(true);
    expect(parseSearchQuery({ from: 'a', to: 'b', date: '2024-07-12' }, NOW).ok).toBe(true);
    expect(dayOffsetFromToday('2024-07-12', NOW)).toBe(SEARCH_WINDOW_DAYS);
  });

  it('refuses yesterday and the thirty-first day ahead', () => {
    for (const date of ['2024-06-11', '2024-07-13']) {
      const result = parseSearchQuery({ from: 'a', to: 'b', date }, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('date_out_of_range');
      expect(result.failure.message).toBe(DATE_OUT_OF_RANGE_MESSAGE);
    }
  });

  it('reads "today" in India time, so the day rolls over at IST midnight', () => {
    // 23:55 UTC on 12 June is already 05:25 IST on 13 June.
    const afterIstMidnight = new Date('2024-06-12T18:35:00.000Z');
    expect(isWithinSearchWindow('2024-06-12', afterIstMidnight)).toBe(false);
    expect(isWithinSearchWindow('2024-06-13', afterIstMidnight)).toBe(true);
    expect(isWithinSearchWindow('2024-07-13', afterIstMidnight)).toBe(true);
  });

  it('refuses text that is not a calendar day', () => {
    for (const date of ['12/06/2024', '2024-13-01', 'tomorrow']) {
      const result = parseSearchQuery({ from: 'a', to: 'b', date }, NOW);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.failure.code).toBe('invalid_date');
      expect(result.failure.message).toBe(INVALID_DATE_MESSAGE);
    }
    expect(dayOffsetFromToday('not-a-date', NOW)).toBeNull();
  });
});
