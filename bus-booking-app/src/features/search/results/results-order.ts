import { formatDate, formatINR, formatTime } from '../../../format/index.js';
import { MESSAGES } from '../../../messages/index.js';
import type { City, TripSummary } from '../../../models/catalogue/index.js';

/**
 * THE RULES OF THE RESULTS LIST, as pure functions.
 *
 * Only buses that have not left yet are offered, earliest departure first; a bus with no seat left is
 * labelled with the catalogue's Sold out wording; seats-left, fares and the arrival day note are
 * written the one approved way. Nothing here renders anything, so every rule is unit-tested without a
 * browser or a server.
 */

/** At or below this many seats the badge warns rather than reassures. */
export const SEATS_LOW_THRESHOLD = 5;

const DAY_MS = 86_400_000;
const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCityLike(value: unknown): value is City {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';
}

/** True for a payload entry that carries everything a result card renders. */
export function isTripSummaryLike(value: unknown): value is TripSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.busName === 'string' &&
    typeof value.busType === 'string' &&
    typeof value.departureAt === 'string' &&
    typeof value.arrivalAt === 'string' &&
    typeof value.farePerSeat === 'number' &&
    typeof value.seatsLeft === 'number' &&
    typeof value.totalSeats === 'number' &&
    isCityLike(value.fromCity) &&
    isCityLike(value.toCity)
  );
}

/** The trips of a `GET /trips` payload, ignoring anything unusable rather than crashing the screen. */
export function toTripList(value: unknown): TripSummary[] {
  if (!Array.isArray(value)) return [];
  const trips: TripSummary[] = [];
  for (const entry of value) {
    if (isTripSummaryLike(entry)) trips.push(entry);
  }
  return trips;
}

/** The cities of a `GET /cities` payload, used only to name the route in words. */
export function toCityList(value: unknown): City[] {
  if (!Array.isArray(value)) return [];
  const cities: City[] = [];
  for (const entry of value) {
    if (isCityLike(entry)) cities.push({ id: entry.id, name: entry.name });
  }
  return cities;
}

/** A trip's departure as milliseconds; an unreadable instant sorts last. */
export function tripDepartureMs(trip: TripSummary): number {
  const ms = Date.parse(trip.departureAt);
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

/** Earliest departure first, the bus name breaking a tie so the order is stable. */
export function compareByDeparture(left: TripSummary, right: TripSummary): number {
  const difference = tripDepartureMs(left) - tripDepartureMs(right);
  if (difference !== 0) return difference;
  return left.busName.localeCompare(right.busName);
}

/** The buses still to depart at `now`, earliest first. */
export function upcomingEarliestFirst(trips: readonly TripSummary[], now: Date): TripSummary[] {
  const cutoff = now.getTime();
  return trips.filter((trip) => tripDepartureMs(trip) > cutoff).sort(compareByDeparture);
}

/** A bus with no seat left: shown as Sold out and never openable. */
export function isSoldOut(trip: TripSummary): boolean {
  return trip.seatsLeft <= 0;
}

/** `Sold out`, `1 seat left` or `18 seats left`. */
export function seatsLeftLabel(seatsLeft: number): string {
  if (seatsLeft <= 0) return MESSAGES.soldOut;
  return seatsLeft === 1 ? '1 seat left' : `${seatsLeft} seats left`;
}

/** The approved badge for a seats-left count. The words carry the state too, never colour alone. */
export function seatsBadgeClass(seatsLeft: number): string {
  if (seatsLeft <= 0) return 'badge badge-danger';
  if (seatsLeft <= SEATS_LOW_THRESHOLD) return 'badge badge-warning';
  return 'badge badge-success';
}

/** `₹850 / seat`, in whole rupees. */
export function farePerSeatLabel(farePerSeat: number): string {
  return `${formatINR(farePerSeat)} / seat`;
}

function istDayMs(iso: string): number | null {
  const match = DMY.exec(formatDate(iso));
  if (match === null) return null;
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

/** `+1 day` when the bus arrives on a later India-time day, otherwise ''. */
export function arrivalDayNote(departureAt: string, arrivalAt: string): string {
  const from = istDayMs(departureAt);
  const to = istDayMs(arrivalAt);
  if (from === null || to === null) return '';
  const days = Math.round((to - from) / DAY_MS);
  if (days <= 0) return '';
  return days === 1 ? '+1 day' : `+${days} days`;
}

/** The arrival time in 12-hour IST, with the next-day note when the trip runs overnight. */
export function arrivalLabel(trip: TripSummary): string {
  const time = formatTime(trip.arrivalAt);
  const note = arrivalDayNote(trip.departureAt, trip.arrivalAt);
  return note === '' ? time : `${time} ${note}`;
}

/**
 * The name of a city, taken from the city list and failing that from the trips themselves. An id is
 * never returned: when the name is unknown the caller leaves the line out.
 */
export function resolveCityName(
  cityId: string,
  cities: readonly City[],
  trips: readonly TripSummary[],
): string {
  if (cityId === '') return '';
  const listed = cities.find((city) => city.id === cityId);
  if (listed !== undefined) return listed.name;
  for (const trip of trips) {
    if (trip.fromCity.id === cityId) return trip.fromCity.name;
    if (trip.toCity.id === cityId) return trip.toCity.name;
  }
  return '';
}

/** `Mumbai → Pune`, or '' while either city is still unnamed. */
export function routeLabel(fromName: string, toName: string): string {
  if (fromName === '' || toName === '') return '';
  return `${fromName} → ${toName}`;
}

/** `1 bus found` / `6 buses found`. */
export function resultsCountLabel(count: number): string {
  return count === 1 ? '1 bus found' : `${count} buses found`;
}
