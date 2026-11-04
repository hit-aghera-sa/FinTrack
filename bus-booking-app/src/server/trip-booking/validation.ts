import { z } from 'zod';
import {
  MAX_SEATS_PER_BOOKING,
  MIN_SEATS_PER_BOOKING,
  parseGender,
  type PassengerInput,
} from '../../models/bookings/index.js';

/**
 * WHAT A BOOKING REQUEST MUST LOOK LIKE.
 *
 * One place decides whether the body a traveller's phone sent can become a booking at all: the trip,
 * the pickup point, between one and six seats, and a name, an age and a gender for every one of those
 * seats. Nothing here touches the database or the network, so the rules can be read and tested on
 * their own.
 *
 * The approved client shape is `CreateBookingInput` — `{ tripId, boardingPointId, passengers }` with
 * the seat number on each passenger. The older spelling of the same request (`busId` plus a
 * `seatNumbers` array alongside passengers that carry no seat of their own) is accepted too and
 * normalised into exactly the same value, so one endpoint serves both without a second code path
 * downstream.
 */

/** Shown when the request could not be read as a booking at all. */
export const INVALID_REQUEST_MESSAGE = 'Please check the booking details and try again.';

/** Shown when no seat (or a blank seat) came with the request. */
export const SEAT_REQUIRED_MESSAGE = 'Please select at least one seat.';

/** The ceiling a traveller is told about when a seventh seat arrives. */
export const MAX_SEATS_MESSAGE = `You can book a maximum of ${MAX_SEATS_PER_BOOKING} seats.`;

/** Two passengers cannot share one seat. */
export const DUPLICATE_SEAT_MESSAGE = 'Each seat can carry only one passenger.';

export const PASSENGER_NAME_MESSAGE = "Please enter each passenger's name.";
export const PASSENGER_AGE_MESSAGE = "Please enter each passenger's age between 1 and 120.";
export const PASSENGER_GENDER_MESSAGE = "Please choose each passenger's gender.";
export const BOARDING_POINT_REQUIRED_MESSAGE = 'Please choose a boarding point.';

export const PASSENGER_NAME_MIN_LENGTH = 2;
export const PASSENGER_NAME_MAX_LENGTH = 60;
export const PASSENGER_AGE_MIN = 1;
export const PASSENGER_AGE_MAX = 120;

const passengerSchema = z.object({
  seatNumber: z.string().trim().min(1, { message: SEAT_REQUIRED_MESSAGE }).optional(),
  name: z
    .string({ invalid_type_error: PASSENGER_NAME_MESSAGE, required_error: PASSENGER_NAME_MESSAGE })
    .trim()
    .min(PASSENGER_NAME_MIN_LENGTH, { message: PASSENGER_NAME_MESSAGE })
    .max(PASSENGER_NAME_MAX_LENGTH, { message: PASSENGER_NAME_MESSAGE }),
  age: z.coerce
    .number({ invalid_type_error: PASSENGER_AGE_MESSAGE, required_error: PASSENGER_AGE_MESSAGE })
    .int({ message: PASSENGER_AGE_MESSAGE })
    .min(PASSENGER_AGE_MIN, { message: PASSENGER_AGE_MESSAGE })
    .max(PASSENGER_AGE_MAX, { message: PASSENGER_AGE_MESSAGE }),
  gender: z
    .string({ invalid_type_error: PASSENGER_GENDER_MESSAGE, required_error: PASSENGER_GENDER_MESSAGE })
    .trim(),
});

/**
 * The envelope of `POST /bookings`. The seat ceiling is checked AFTER parsing so the traveller is
 * told about the six-seat maximum in the product's own words rather than through a schema message.
 */
export const createBookingBodySchema = z.object({
  tripId: z.string().trim().optional(),
  busId: z.string().trim().optional(),
  boardingPointId: z
    .string({
      invalid_type_error: BOARDING_POINT_REQUIRED_MESSAGE,
      required_error: BOARDING_POINT_REQUIRED_MESSAGE,
    })
    .trim()
    .min(1, { message: BOARDING_POINT_REQUIRED_MESSAGE }),
  seatNumbers: z.array(z.string().trim().min(1, { message: SEAT_REQUIRED_MESSAGE })).optional(),
  passengers: z
    .array(passengerSchema, {
      invalid_type_error: SEAT_REQUIRED_MESSAGE,
      required_error: SEAT_REQUIRED_MESSAGE,
    })
    .min(MIN_SEATS_PER_BOOKING, { message: SEAT_REQUIRED_MESSAGE }),
});

/** A booking request that passed every rule, in the shape the booking repository takes. */
export interface ValidBooking {
  readonly tripId: string;
  readonly boardingPointId: string;
  readonly passengers: PassengerInput[];
}

/** Either the request is usable, or the one sentence to show the traveller. */
export type CreateBookingValidation =
  | { ok: true; value: ValidBooking }
  | { ok: false; message: string };

/** The first thing the schema objected to, as a sentence. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues.length === 0 ? INVALID_REQUEST_MESSAGE : error.issues[0].message;
}

/** Read a `POST /bookings` body into a value the service can act on, or the refusal to show. */
export function parseCreateBooking(body: unknown): CreateBookingValidation {
  const parsed = createBookingBodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: firstIssueMessage(parsed.error) };

  const data = parsed.data;
  const tripId = (data.tripId ?? data.busId ?? '').trim();
  if (tripId === '') return { ok: false, message: INVALID_REQUEST_MESSAGE };

  const seatNumbers = data.seatNumbers ?? [];
  const passengers: PassengerInput[] = [];

  for (let index = 0; index < data.passengers.length; index += 1) {
    const raw = data.passengers[index];
    const fallbackSeat: string | undefined = seatNumbers[index];
    const seatNumber = (raw.seatNumber ?? fallbackSeat ?? '').trim();
    if (seatNumber === '') return { ok: false, message: SEAT_REQUIRED_MESSAGE };

    const gender = parseGender(raw.gender) ?? null;
    if (gender === null) return { ok: false, message: PASSENGER_GENDER_MESSAGE };

    passengers.push({ seatNumber, name: raw.name, age: raw.age, gender });
  }

  if (passengers.length < MIN_SEATS_PER_BOOKING) return { ok: false, message: SEAT_REQUIRED_MESSAGE };
  if (passengers.length > MAX_SEATS_PER_BOOKING) return { ok: false, message: MAX_SEATS_MESSAGE };

  const distinct = new Set(passengers.map((passenger: PassengerInput) => passenger.seatNumber.toUpperCase()));
  if (distinct.size !== passengers.length) return { ok: false, message: DUPLICATE_SEAT_MESSAGE };

  return { ok: true, value: { tripId, boardingPointId: data.boardingPointId, passengers } };
}
