import { MESSAGES } from '../../messages/index.js';
import type { BookingRecord, BookingRepository, PassengerInput } from '../../models/bookings/index.js';
import type { SeatInfo, TripDetail, TripRepository } from '../../models/catalogue/index.js';
import { INVALID_REQUEST_MESSAGE, parseCreateBooking } from './validation.js';

/**
 * THE SEAT MAP AND BOOKING CREATION RULES.
 *
 * Reading a bus is one lookup: its seat map (each seat with its number, grid position and booked
 * flag) and the boarding points configured for it.
 *
 * Creating a booking is a sequence of refusals, every one of which leaves NOTHING written:
 *
 *   • the request must carry 1–6 seats with a name, an age and a gender for each (see validation.ts);
 *   • the trip must exist and must not have departed;
 *   • the boarding point must be one of that bus's own;
 *   • every chosen seat must be a seat of that bus, and must still be free.
 *
 * Only then is the booking handed to `bookingRepository.create`, which writes the booking, its
 * passengers and its seat holds inside ONE transaction. When a seat was taken a moment earlier that
 * transaction books nothing and names the seat, and this service turns that into the conflict the
 * traveller is shown — the same `SEAT_TAKEN` answer as a seat already grey in the fetched map, so one
 * message covers both.
 *
 * The catalogue and the booking repository arrive as dependencies, and so does the clock, so the
 * rules can be exercised with no database and no real time.
 */

export type TripBookingFailureCode =
  | 'INVALID_REQUEST'
  | 'TRIP_NOT_FOUND'
  | 'INVALID_BOARDING_POINT'
  | 'TRIP_DEPARTED'
  | 'SEAT_TAKEN';

/** A refusal, with the HTTP status and the machine code the API answers with. */
export interface TripBookingFailure {
  ok: false;
  status: number;
  code: TripBookingFailureCode;
  message: string;
  /** The seat to tell the traveller about — present only for `SEAT_TAKEN`. */
  conflictSeat?: string;
}

export interface SeatMapSuccess {
  ok: true;
  trip: TripDetail;
}

export type SeatMapOutcome = SeatMapSuccess | TripBookingFailure;

export interface CreateBookingSuccess {
  ok: true;
  booking: BookingRecord;
}

export type CreateBookingOutcome = CreateBookingSuccess | TripBookingFailure;

export interface TripBookingDeps {
  /** The travel catalogue — `tripRepository` satisfies this. */
  readonly trips: Pick<TripRepository, 'findDetail'>;
  /** The booking writer — `bookingRepository` satisfies this. */
  readonly bookings: Pick<BookingRepository, 'create'>;
  /** The clock. Defaults to the real one; specs pass a fixed instant. */
  readonly now?: () => Date;
}

export interface TripBookingService {
  /** The bus with its seat map and boarding points. */
  seatMap(tripId: string): Promise<SeatMapOutcome>;
  /** Create a booking for that account from a raw request body. */
  createBooking(userId: string, body: unknown): Promise<CreateBookingOutcome>;
}

export const TRIP_NOT_FOUND_MESSAGE = 'That bus is no longer available. Please search again.';
export const TRIP_DEPARTED_MESSAGE = 'This bus has already departed.';
export const BOARDING_POINT_NOT_ON_BUS_MESSAGE = 'Please choose a boarding point for this bus.';

/** Shown when a chosen seat is not a seat of that bus at all. */
export function seatNotOnBusMessage(seatNumber: string): string {
  return `Seat ${seatNumber} is not on this bus.`;
}

function failure(status: number, code: TripBookingFailureCode, message: string): TripBookingFailure {
  return { ok: false, status, code, message };
}

/** The one conflict answer: 409, the seat's number, and the catalogue's seat-just-booked sentence. */
export function seatTakenFailure(seatNumber: string): TripBookingFailure {
  return {
    ok: false,
    status: 409,
    code: 'SEAT_TAKEN',
    message: MESSAGES.seatJustBooked(seatNumber),
    conflictSeat: seatNumber,
  };
}

function seatOf(trip: TripDetail, seatNumber: string): SeatInfo | undefined {
  const wanted = seatNumber.trim().toUpperCase();
  return trip.seats.find((seat: SeatInfo) => seat.number.trim().toUpperCase() === wanted);
}

/** True once the scheduled departure is in the past. An unreadable departure never blocks a sale. */
export function hasDeparted(trip: TripDetail, now: Date): boolean {
  const departure = Date.parse(trip.departureAt);
  return Number.isNaN(departure) ? false : departure <= now.getTime();
}

export function createTripBookingService(deps: TripBookingDeps): TripBookingService {
  const clock: () => Date = deps.now ?? ((): Date => new Date());

  return {
    async seatMap(tripId: string): Promise<SeatMapOutcome> {
      const wanted = tripId.trim();
      if (wanted === '') return failure(400, 'INVALID_REQUEST', INVALID_REQUEST_MESSAGE);

      const trip = await deps.trips.findDetail(wanted);
      if (trip === null) return failure(404, 'TRIP_NOT_FOUND', TRIP_NOT_FOUND_MESSAGE);

      return { ok: true, trip };
    },

    async createBooking(userId: string, body: unknown): Promise<CreateBookingOutcome> {
      const parsed = parseCreateBooking(body);
      if (!parsed.ok) return failure(400, 'INVALID_REQUEST', parsed.message);

      const request = parsed.value;
      const trip = await deps.trips.findDetail(request.tripId);
      if (trip === null) return failure(404, 'TRIP_NOT_FOUND', TRIP_NOT_FOUND_MESSAGE);

      if (hasDeparted(trip, clock())) return failure(409, 'TRIP_DEPARTED', TRIP_DEPARTED_MESSAGE);

      const point = trip.boardingPoints.find((candidate) => candidate.id === request.boardingPointId);
      if (point === undefined) {
        return failure(400, 'INVALID_BOARDING_POINT', BOARDING_POINT_NOT_ON_BUS_MESSAGE);
      }

      for (const passenger of request.passengers) {
        const seat = seatOf(trip, passenger.seatNumber);
        if (seat === undefined) {
          return failure(400, 'INVALID_REQUEST', seatNotOnBusMessage(passenger.seatNumber));
        }
        if (seat.isBooked) return seatTakenFailure(seat.number);
      }

      const passengers: PassengerInput[] = request.passengers;
      const result = await deps.bookings.create({
        userId,
        tripId: trip.id,
        boardingPointId: point.id,
        passengers,
      });

      if (result.ok) return { ok: true, booking: result.booking };
      return seatTakenFailure(result.conflictSeat);
    },
  };
}
