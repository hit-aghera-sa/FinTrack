import { describe, expect, it } from 'vitest';
import {
  SEARCH_WINDOW_DAYS,
  isDayKey,
  isWithinSearchWindow,
  istDateKey,
  searchDateBounds,
  shiftDayKey,
} from './date-window.js';

/** 00:15 on 13 June in India — the UTC day is still the 12th. */
const JUST_AFTER_IST_MIDNIGHT = new Date('2024-06-12T18:45:00Z');
/** 23:45 on 12 June in India. */
const JUST_BEFORE_IST_MIDNIGHT = new Date('2024-06-12T18:15:00Z');

describe('the search form travel-date window', () => {
  it('offers a window of 30 days', () => {
    expect(SEARCH_WINDOW_DAYS).toBe(30);
  });

  it('reads today as the India-time calendar day, not the browser day', () => {
    expect(istDateKey(JUST_AFTER_IST_MIDNIGHT)).toBe('2024-06-13');
    expect(istDateKey(JUST_BEFORE_IST_MIDNIGHT)).toBe('2024-06-12');
  });

  it('bounds the date field to today and today + 30 days', () => {
    expect(searchDateBounds(JUST_AFTER_IST_MIDNIGHT)).toEqual({ min: '2024-06-13', max: '2024-07-13' });
    expect(searchDateBounds(JUST_BEFORE_IST_MIDNIGHT)).toEqual({ min: '2024-06-12', max: '2024-07-12' });
  });

  it('accepts both ends of the window and nothing outside it', () => {
    expect(isWithinSearchWindow('2024-06-13', JUST_AFTER_IST_MIDNIGHT)).toBe(true);
    expect(isWithinSearchWindow('2024-06-30', JUST_AFTER_IST_MIDNIGHT)).toBe(true);
    expect(isWithinSearchWindow('2024-07-13', JUST_AFTER_IST_MIDNIGHT)).toBe(true);
    expect(isWithinSearchWindow('2024-07-14', JUST_AFTER_IST_MIDNIGHT)).toBe(false);
    expect(isWithinSearchWindow('2024-06-12', JUST_AFTER_IST_MIDNIGHT)).toBe(false);
    expect(isWithinSearchWindow('not-a-date', JUST_AFTER_IST_MIDNIGHT)).toBe(false);
  });

  it('moves across month and year ends', () => {
    expect(shiftDayKey('2024-02-28', 2)).toBe('2024-03-01');
    expect(shiftDayKey('2024-12-20', 30)).toBe('2025-01-19');
    expect(shiftDayKey('2024-06-13', -1)).toBe('2024-06-12');
  });

  it('rejects day keys that are not real dates', () => {
    expect(isDayKey('2024-06-13')).toBe(true);
    expect(isDayKey('2024-02-30')).toBe(false);
    expect(isDayKey('2024-13-01')).toBe(false);
    expect(isDayKey('13/06/2024')).toBe(false);
    expect(isDayKey('')).toBe(false);
  });
});
