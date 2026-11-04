import { UNEXPECTED_MESSAGE, isApiError, isOfflineError } from '../../api/index.js';
import { formatDate, formatINR, formatTime } from '../../format/index.js';
import { MESSAGES } from '../../messages/index.js';
import { busTypeLabel, type BoardingPoint, type TripDetail } from '../../models/catalogue/index.js';

/**
 * THE BOOKING SUMMARY, AND WHAT A FAILED CONFIRMATION MEANS.
 *
 * Pure presentation rules: the rows the summary shows, the boarding point's label, and the reading of
 * an `ApiError` — in particular the one failure this screen must handle on its own, a seat taken
 * between seat selection and confirmation, where nothing at all is booked.
 */

/** What the booking API answers with when a chosen seat was taken a moment earlier. */
export const SEAT_TAKEN_PATTERN = /seat[_\s-]?taken/i;

/** The seat named inside a message such as "Sorry, seat A2 was just booked." */
const SEAT_IN_MESSAGE = /seat\s+([A-Za-z0-9]+)/i;

/** What is owed for the whole booking: whole rupees, one fare per chosen seat. */
export function totalFare(farePerSeat: number, seatCount: number): number {
  return farePerSeat * seatCount;
}

/** The boarding point the traveller chose, falling back to the bus's first one. */
export function boardingPointFor(trip: TripDetail, boardingPointId: string): BoardingPoint | null {
  const chosen = trip.boardingPoints.find((point) => point.id === boardingPointId);
  if (chosen !== undefined) return chosen;
  return trip.boardingPoints[0] ?? null;
}

function isInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

/** How a boarding point reads in the summary: its name, and its pickup time when one is known. */
export function boardingPointLabel(point: BoardingPoint | null): string {
  if (point === null) return 'Not selected';
  const pickup = point.pickupAt.trim();
  if (pickup === '') return point.name;
  return `${point.name} · ${isInstant(pickup) ? formatTime(pickup) : pickup}`;
}

/** One line of the booking summary. */
export interface SummaryRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

/** Everything the summary states before Confirm booking. */
export function summaryRows(
  trip: TripDetail,
  seats: readonly string[],
  boardingPoint: string,
): readonly SummaryRow[] {
  return [
    { key: 'bus', label: 'Bus', value: `${trip.busName} · ${busTypeLabel(trip.busType)}` },
    { key: 'route', label: 'Route', value: `${trip.fromCity.name} to ${trip.toCity.name}` },
    { key: 'date', label: 'Travel date', value: formatDate(trip.departureAt) },
    { key: 'departure', label: 'Departure time', value: formatTime(trip.departureAt) },
    { key: 'boarding', label: 'Boarding point', value: boardingPoint },
    { key: 'seats', label: 'Seat numbers', value: seats.join(', ') },
    { key: 'fare', label: 'Fare per seat', value: formatINR(trip.farePerSeat) },
    {
      key: 'total',
      label: 'Total fare',
      value: formatINR(totalFare(trip.farePerSeat, seats.length)),
      emphasis: true,
    },
  ];
}

/** True for the one refusal this screen answers by sending the traveller back to the seat map. */
export function isSeatTakenError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return error.status === 409 || SEAT_TAKEN_PATTERN.test(error.code);
}

/**
 * The seat to name in the message: the one the server reported when it is one of the chosen seats,
 * otherwise the first seat of this booking.
 */
export function conflictSeatFrom(error: unknown, seats: readonly string[]): string {
  const fallback = seats[0] ?? '';
  if (!isApiError(error)) return fallback;
  const match = SEAT_IN_MESSAGE.exec(error.message);
  const token = match === null ? undefined : match[1];
  if (token === undefined) return fallback;
  const exact = seats.find((seat) => seat.toUpperCase() === token.toUpperCase());
  return exact ?? fallback;
}

/** The catalogue's seat-just-booked sentence, naming the seat that was taken. */
export function seatTakenMessage(error: unknown, seats: readonly string[]): string {
  return MESSAGES.seatJustBooked(conflictSeatFrom(error, seats));
}

/** Any other failure, in the words the app uses everywhere else. */
export function describeBookingError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (isApiError(error) && error.message.trim() !== '') return error.message;
  return UNEXPECTED_MESSAGE;
}
