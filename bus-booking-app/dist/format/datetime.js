/**
 * Date and time presentation for the Bus Booking App.
 *
 * All business times are INDIA time. India Standard Time is a fixed +05:30 from UTC and observes no
 * daylight saving, so the instant is shifted by that constant and read back in UTC rather than going
 * through the platform's time-zone database — the output is then identical on every machine, which is
 * what the unit tests and the server-rendered strings rely on.
 *
 * Dates read DD/MM/YYYY and times read 12-hour with AM/PM (for example `9:30 PM`).
 */
/** The business time zone, for anywhere a zone name itself must be shown or passed on. */
export const IST_TIME_ZONE = 'Asia/Kolkata';
/** India Standard Time as minutes ahead of UTC. Fixed: IST has no daylight saving. */
export const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60_000;
function pad2(value) {
    return String(value).padStart(2, '0');
}
/**
 * The India-time calendar fields of a machine date/time string, or `null` when the string is not a
 * date this platform can read. Accepts a full ISO instant (`2024-06-12T16:00:00Z`) as well as a plain
 * ISO date (`2024-06-12`, read as midnight UTC, which is the same calendar day in India).
 */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
export function istPartsOf(iso) {
    // Only an unambiguous machine format is a date here: the platform's own parser is lenient enough to
    // turn prose such as `12-06-2024 maybe` into a real instant, which would print a wrong day on screen.
    if (!ISO_DATE_TIME.test(iso))
        return null;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms))
        return null;
    const shifted = new Date(ms + IST_OFFSET_MINUTES * MINUTE_MS);
    return {
        day: shifted.getUTCDate(),
        month: shifted.getUTCMonth() + 1,
        year: shifted.getUTCFullYear(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
    };
}
function renderDate(parts) {
    return `${pad2(parts.day)}/${pad2(parts.month)}/${String(parts.year).padStart(4, '0')}`;
}
function renderTime(parts) {
    const suffix = parts.hour < 12 ? 'AM' : 'PM';
    const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
    return `${hour12}:${pad2(parts.minute)} ${suffix}`;
}
/**
 * A date in India time as DD/MM/YYYY — `12/06/2024`.
 *
 * An unreadable value renders as the empty string: a screen must never crash, and never show a raw
 * machine timestamp, because one field arrived malformed.
 */
export function formatDate(iso) {
    const parts = istPartsOf(iso);
    return parts === null ? '' : renderDate(parts);
}
/** A time in India time, 12-hour with AM/PM — `9:30 PM`. Empty string for an unreadable value. */
export function formatTime(iso) {
    const parts = istPartsOf(iso);
    return parts === null ? '' : renderTime(parts);
}
/** A date and time in India time — `12/06/2024, 9:30 PM`. Empty string for an unreadable value. */
export function formatDateTime(iso) {
    const parts = istPartsOf(iso);
    return parts === null ? '' : `${renderDate(parts)}, ${renderTime(parts)}`;
}
