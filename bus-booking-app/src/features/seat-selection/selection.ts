import { isApiError, isOfflineError } from '../../api/index.js';
import { formatTime } from '../../format/index.js';
import { MESSAGES } from '../../messages/index.js';
import { MAX_SEATS_PER_BOOKING, MIN_SEATS_PER_BOOKING } from '../../models/bookings/index.js';
import { BUS_TYPES, DEFAULT_BUS_TYPE } from '../../models/catalogue/index.js';
import type { BoardingPoint, BusType, City, SeatInfo, TripDetail } from '../../models/catalogue/index.js';

/**
 * THE SEAT SELECTION RULES, as pure functions.
 *
 * Everything the seat map promises a traveller is decided here, with no React and no fetching, so the
 * two rules the product cares most about can be read and tested directly:
 *
 *   • a BOOKED seat is never selectable — tapping it changes nothing and says so;
 *   • at most SIX seats go into one booking — a seventh pick is refused with a notice.
 *
 * The screen beside this file renders what these functions decide.
 */

/** The seat-selection screen's own address pattern. */
export const SEAT_ROUTE = '/trips/:tripId/seats';

/** Where Continue goes: the passenger-details screen of the same trip. */
export const PASSENGERS_ROUTE = '/trips/:tripId/passengers';

/** One booking carries at least one and at most six seats (the shared booking domain decides this). */
export const MAX_SEATS: number = MAX_SEATS_PER_BOOKING;
export const MIN_SEATS: number = MIN_SEATS_PER_BOOKING;

export const SEAT_LIMIT_NOTICE = `You can select up to ${MAX_SEATS} seats in one booking.`;
export const SEAT_BOOKED_NOTICE = 'That seat is already booked. Please choose another seat.';
export const SELECT_SEATS_NOTICE = 'Please select at least one seat to continue.';
export const BOARDING_REQUIRED_NOTICE = 'Please choose a boarding point to continue.';
export const NO_BOARDING_POINTS_NOTICE = 'This bus has no boarding point list yet.';
export const TRIP_NOT_FOUND_MESSAGE = 'This bus is no longer available. Please search again.';
export const TRIP_LOAD_FAILED_MESSAGE = 'Could not load the seat map. Please try again.';
export const NO_SEATS_TITLE = 'No seat map for this bus yet';
export const NO_SEATS_MESSAGE = 'The seat layout for this bus has not been published. Please pick another bus.';
export const BOARDING_PLACEHOLDER_LABEL = 'Select a boarding point';

/** How one seat of the map reads: white available, grey booked, green selected. */
export type SeatCellState = 'available' | 'booked' | 'selected';

/** Every seat state also carries a word, so colour is never the only signal. */
export const SEAT_STATE_LABELS: Record<SeatCellState, string> = {
  available: 'Available',
  booked: 'Booked',
  selected: 'Selected',
};

/** …and a mark, so the state survives a greyscale screen. */
export const SEAT_STATE_MARKS: Record<SeatCellState, string> = {
  available: '',
  booked: '\u00d7',
  selected: '\u2713',
};

/** One row of the seat map, left to right. */
export interface SeatRow {
  readonly row: number;
  readonly seats: readonly SeatInfo[];
}

/** A boarding-point choice as the shared select field takes it. */
export interface BoardingOption {
  readonly value: string;
  readonly label: string;
}

/** What a tap on a seat produces: the new selection, and the notice to show (or none). */
export interface SeatToggleResult {
  readonly seats: readonly string[];
  readonly notice: string | null;
}

const SEAT_PATH = /^\/trips\/([^/]+)\/seats\/?$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/** The trip this screen is showing, read off its own address. Null when the path is not ours. */
export function tripIdFromPath(pathname: string): string | null {
  const match = SEAT_PATH.exec(pathname);
  if (match === null) return null;
  const raw = match[1] ?? '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const id = decoded.trim();
  return id === '' ? null : id;
}

/** White, grey or green for one seat, given what this traveller has picked. */
export function seatStateOf(seat: SeatInfo, selected: readonly string[]): SeatCellState {
  if (seat.isBooked) return 'booked';
  return selected.includes(seat.number) ? 'selected' : 'available';
}

/**
 * A tap on one seat.
 *
 * A booked (grey) seat is refused outright; an already-picked seat is given back; a new pick is added
 * unless six seats are already held, in which case the selection is untouched and the ceiling notice
 * is returned.
 */
export function toggleSeat(selected: readonly string[], seat: SeatInfo): SeatToggleResult {
  if (seat.isBooked) return { seats: selected, notice: SEAT_BOOKED_NOTICE };
  if (selected.includes(seat.number)) {
    return { seats: selected.filter((number) => number !== seat.number), notice: null };
  }
  if (selected.length >= MAX_SEATS) return { seats: selected, notice: SEAT_LIMIT_NOTICE };
  return { seats: [...selected, seat.number], notice: null };
}

/** The picked seats in seat-map order, so the summary and the URL always read the same way. */
export function orderedSelection(seats: readonly SeatInfo[], selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  return seats.filter((seat) => chosen.has(seat.number)).map((seat) => seat.number);
}

/** The seat map grouped into its rows, each row left to right. */
export function seatRows(seats: readonly SeatInfo[]): SeatRow[] {
  const byRow = new Map<number, SeatInfo[]>();
  for (const seat of seats) {
    const existing = byRow.get(seat.row);
    if (existing === undefined) byRow.set(seat.row, [seat]);
    else existing.push(seat);
  }
  return [...byRow.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([row, list]) => ({ row, seats: [...list].sort((left, right) => left.column - right.column) }));
}

/** The running total: whole rupees, fare per seat times the number of seats held. */
export function totalFare(farePerSeat: number, seatCount: number): number {
  if (!Number.isFinite(farePerSeat) || seatCount <= 0) return 0;
  return Math.max(0, Math.round(farePerSeat * seatCount));
}

/** "1 seat" / "3 seats" — never a bare figure on its own. */
export function seatCountLabel(seatCount: number): string {
  return seatCount === 1 ? '1 seat' : `${seatCount} seats`;
}

/** Where Continue goes: `/trips/:tripId/passengers?seats=A1,A2&boarding=:boardingPointId`. */
export function passengersPath(tripId: string, seats: readonly string[], boardingPointId: string): string {
  const seatList = seats.map((seat) => encodeURIComponent(seat)).join(',');
  const boarding = encodeURIComponent(boardingPointId);
  return `/trips/${encodeURIComponent(tripId)}/passengers?seats=${seatList}&boarding=${boarding}`;
}

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

/** The `seats=A1,A2` parameter as a list, ignoring blanks. */
export function parseSeatsParam(search: string): string[] {
  const raw = searchParams(search).get('seats') ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * The selection to start with when the traveller comes BACK to this screen (from passenger details,
 * or after a seat was taken at confirmation): the seats named in the URL that are still free, capped
 * at six.
 */
export function initialSelection(trip: TripDetail, search: string): string[] {
  const free = new Set(trip.seats.filter((seat) => !seat.isBooked).map((seat) => seat.number));
  const picked: string[] = [];
  for (const number of parseSeatsParam(search)) {
    if (!free.has(number) || picked.includes(number)) continue;
    if (picked.length >= MAX_SEATS) break;
    picked.push(number);
  }
  return picked;
}

/** The boarding point to start with: the one named in the URL when this bus still offers it. */
export function initialBoardingPointId(trip: TripDetail, search: string): string {
  const wanted = searchParams(search).get('boarding') ?? '';
  const match = trip.boardingPoints.find((point) => point.id === wanted);
  return match === undefined ? '' : match.id;
}

/**
 * The seat-just-booked sentence, when the traveller was sent back here because a seat went in the
 * meantime (`?seatTaken=A1`). The wording is the shared catalogue's, never retyped.
 */
export function seatTakenNotice(search: string): string | null {
  const seat = (searchParams(search).get('seatTaken') ?? '').trim();
  return seat === '' ? null : MESSAGES.seatJustBooked(seat);
}

/** A boarding point as one line: its name and, when the pickup is a real instant, its pickup time. */
export function boardingPointLabel(point: BoardingPoint): string {
  const pickup = point.pickupAt.trim();
  if (pickup === '') return point.name;
  const when = ISO_INSTANT.test(pickup) ? formatTime(pickup) : pickup;
  return `${point.name} \u00b7 ${when}`;
}

/** The chooser's options: a "pick one" placeholder, then this bus's own boarding points. */
export function boardingOptions(points: readonly BoardingPoint[]): BoardingOption[] {
  return [
    { value: '', label: BOARDING_PLACEHOLDER_LABEL },
    ...points.map((point) => ({ value: point.id, label: boardingPointLabel(point) })),
  ];
}

/** What a traveller is told when the seat map could not be loaded. */
export function describeTripError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (isApiError(error)) {
    if (error.status === 404) return TRIP_NOT_FOUND_MESSAGE;
    return error.message === '' ? TRIP_LOAD_FAILED_MESSAGE : error.message;
  }
  return TRIP_LOAD_FAILED_MESSAGE;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) record[key] = item;
  return record;
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function busTypeOf(value: unknown): BusType {
  if (typeof value !== 'string') return DEFAULT_BUS_TYPE;
  const found = BUS_TYPES.find((type) => type === value);
  return found ?? DEFAULT_BUS_TYPE;
}

function cityOf(value: unknown, fallbackName: string): City {
  const record = asRecord(value);
  if (record === null) return { id: '', name: fallbackName };
  return { id: stringOf(record.id) ?? '', name: stringOf(record.name) ?? fallbackName };
}

function seatOf(value: unknown, index: number): SeatInfo | null {
  const record = asRecord(value);
  if (record === null) return null;
  const number = stringOf(record.number) ?? stringOf(record.seatNumber);
  if (number === null) return null;
  return {
    number,
    row: numberOf(record.row) ?? index + 1,
    column: numberOf(record.column) ?? 1,
    isBooked: record.isBooked === true || record.booked === true,
  };
}

function boardingPointOf(value: unknown): BoardingPoint | null {
  const record = asRecord(value);
  if (record === null) return null;
  const id = stringOf(record.id);
  const name = stringOf(record.name);
  if (id === null || name === null) return null;
  return { id, name, pickupAt: stringOf(record.pickupAt) ?? '' };
}

/**
 * The trip detail, read out of whatever `GET /api/trips/:tripId` answered.
 *
 * The seat map is the one thing this screen cannot do without, so a body with no seats array is
 * refused (null) and the screen says the bus is unavailable rather than drawing an empty deck. The
 * body is accepted either as the trip itself or wrapped as `{ trip }`, because only the route's
 * contract is pinned, not its envelope.
 */
export function readTripDetail(payload: unknown): TripDetail | null {
  const root = asRecord(payload);
  if (root === null) return null;
  const source = asRecord(root.trip) ?? root;

  const id = stringOf(source.id);
  const seatsRaw = source.seats;
  if (id === null || !Array.isArray(seatsRaw)) return null;

  const seats: SeatInfo[] = [];
  seatsRaw.forEach((entry: unknown, index: number) => {
    const seat = seatOf(entry, index);
    if (seat !== null) seats.push(seat);
  });

  const boardingPoints: BoardingPoint[] = [];
  const pointsRaw = Array.isArray(source.boardingPoints) ? source.boardingPoints : [];
  pointsRaw.forEach((entry: unknown) => {
    const point = boardingPointOf(entry);
    if (point !== null) boardingPoints.push(point);
  });

  const departureAt = stringOf(source.departureAt) ?? '';
  const freeSeats = seats.filter((seat) => !seat.isBooked).length;

  return {
    id,
    busName: stringOf(source.busName) ?? 'Bus',
    busType: busTypeOf(source.busType),
    fromCity: cityOf(source.fromCity, 'Origin'),
    toCity: cityOf(source.toCity, 'Destination'),
    departureAt,
    arrivalAt: stringOf(source.arrivalAt) ?? departureAt,
    farePerSeat: numberOf(source.farePerSeat) ?? 0,
    seatsLeft: numberOf(source.seatsLeft) ?? freeSeats,
    totalSeats: numberOf(source.totalSeats) ?? seats.length,
    seats,
    boardingPoints,
  };
}
