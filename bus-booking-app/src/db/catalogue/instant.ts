import { IST_OFFSET_MINUTES } from '../../format/index.js';

/**
 * TIME HANDLING FOR THE CATALOGUE.
 *
 * Every business time in this product is India time: a search for `12/06/2024` means the trips that
 * leave between midnight and midnight IST on that day, wherever the server happens to run. The IST
 * offset itself is NOT re-declared here — it comes from the formatting lane, the single place it is
 * written down.
 *
 * These helpers also absorb the two shapes a stored departure can take: a full timestamp, or a travel
 * date plus a clock time such as `9:30 PM`.
 */

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const IST_SHIFT_MS = IST_OFFSET_MINUTES * MINUTE_MS;

/** Half-open instant range `[start, end)` covering one India-time calendar day. */
export interface DayWindow {
  readonly start: Date;
  readonly end: Date;
}

function parseDateText(raw: string): Date | null {
  const text = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  let candidate = text.replace(' ', 'T');
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(candidate)) {
    if (!candidate.includes('T')) candidate += 'T00:00:00';
    candidate += 'Z';
  }
  const ms = Date.parse(candidate);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** A real instant from a `Date`, an epoch number or an ISO-8601 date/timestamp string. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') return parseDateText(value);
  return null;
}

/** Minutes past midnight for `21:30`, `21:30:00` or `9:30 PM`; null when the text is not a clock time. */
export function parseClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value.trim());
  if (match === null) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  const meridiem = match[4] === undefined ? null : match[4].toLowerCase();
  if (meridiem !== null) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm') hours = hours === 12 ? 12 : hours + 12;
    else hours = hours === 12 ? 0 : hours;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** The India-time calendar day of an instant, as `YYYY-MM-DD`. */
export function istDayKey(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_SHIFT_MS);
  const year = String(shifted.getUTCFullYear()).padStart(4, '0');
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The instant range of one India-time day, or null when `dayKey` is not a real `YYYY-MM-DD` date. */
export function istDayWindow(dayKey: string): DayWindow | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const startMs = Date.UTC(year, month - 1, day) - IST_SHIFT_MS;
  const start = new Date(startMs);
  // Rejects a date that does not exist (e.g. 2024-02-31, which JS would roll into March).
  if (istDayKey(start) !== `${match[1]}-${match[2]}-${match[3]}`) return null;
  return { start, end: new Date(startMs + DAY_MS) };
}

/**
 * The instant a stored time refers to. A timestamp is taken as it is; a bare clock time is placed on
 * the India-time day of `base` (the trip's travel date or departure), which is how a schedule stored
 * as "travel date + departure time" is read.
 */
export function toInstant(value: unknown, base: Date | null): Date | null {
  const direct = toDate(value);
  if (direct !== null) return direct;
  if (typeof value !== 'string') return null;
  const minutes = parseClockMinutes(value);
  if (minutes === null || base === null) return null;
  const day = istDayWindow(istDayKey(base));
  if (day === null) return null;
  return new Date(day.start.getTime() + minutes * MINUTE_MS);
}

/**
 * A boarding point's pickup time for the API: an ISO-8601 instant when one can be derived, otherwise
 * the stored text so the screen can still show something true.
 */
export function normalisePickupAt(value: unknown, base: Date | null): string {
  const instant = toInstant(value, base);
  if (instant !== null) return instant.toISOString();
  return typeof value === 'string' ? value.trim() : '';
}
