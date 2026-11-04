import { IST_OFFSET_MINUTES } from '../../../format/index.js';

/**
 * THE TRAVEL-DATE WINDOW OF THE BUS SEARCH FORM.
 *
 * A traveller may search from today up to 30 days ahead, and "today" is the India-time calendar day
 * wherever the browser happens to be — a phone set to another zone must still be offered the same
 * days the API accepts. The IST offset itself is NOT re-declared here: it comes from the formatting
 * lane, the single place it is written down.
 *
 * Pure functions over `YYYY-MM-DD` day keys (the value shape a native date input works in). No React,
 * no fetching, no state.
 */

/** How far ahead the form lets a traveller look, mirroring the search API's own window. */
export const SEARCH_WINDOW_DAYS = 30;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The two ends of the window, as the `min` and `max` of the date field. */
export interface SearchDateBounds {
  readonly min: string;
  readonly max: string;
}

function formatDayKey(utcMs: number): string {
  const at = new Date(utcMs);
  const year = String(at.getUTCFullYear()).padStart(4, '0');
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  const day = String(at.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A day key as midnight UTC of that calendar day, or null when it is not a real date. */
export function dayKeyToUtcMs(dayKey: string): number | null {
  const match = DAY_KEY_PATTERN.exec(dayKey.trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const at = new Date(ms);
  // Rejects the 30th of February and friends, which Date.UTC would silently roll over.
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  return ms;
}

/** True for a real `YYYY-MM-DD` calendar day. */
export function isDayKey(value: string): boolean {
  return dayKeyToUtcMs(value) !== null;
}

/** The India-time calendar day of an instant, as `YYYY-MM-DD`. */
export function istDateKey(instant: Date): string {
  return formatDayKey(instant.getTime() + IST_OFFSET_MINUTES * MINUTE_MS);
}

/** The day `days` after (or before) `dayKey`; an unparsable key is handed back unchanged. */
export function shiftDayKey(dayKey: string, days: number): string {
  const ms = dayKeyToUtcMs(dayKey);
  if (ms === null) return dayKey;
  return formatDayKey(ms + days * DAY_MS);
}

/** Today through today + 30 days, in India time. */
export function searchDateBounds(now: Date): SearchDateBounds {
  const min = istDateKey(now);
  return { min, max: shiftDayKey(min, SEARCH_WINDOW_DAYS) };
}

/** True when the chosen day is a real date inside the window (both ends included). */
export function isWithinSearchWindow(dayKey: string, now: Date): boolean {
  const trimmed = dayKey.trim();
  if (!isDayKey(trimmed)) return false;
  const bounds = searchDateBounds(now);
  // `YYYY-MM-DD` sorts chronologically as text, so a plain comparison is the date comparison.
  return trimmed >= bounds.min && trimmed <= bounds.max;
}
