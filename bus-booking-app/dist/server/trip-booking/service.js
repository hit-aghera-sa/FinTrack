import { MESSAGES } from '../../messages/index.js';
import { INVALID_REQUEST_MESSAGE, parseCreateBooking } from './validation.js';
export const TRIP_NOT_FOUND_MESSAGE = 'That bus is no longer available. Please search again.';
export const TRIP_DEPARTED_MESSAGE = 'This bus has already departed.';
export const BOARDING_POINT_NOT_ON_BUS_MESSAGE = 'Please choose a boarding point for this bus.';
/** Shown when a chosen seat is not a seat of that bus at all. */
export function seatNotOnBusMessage(seatNumber) {
    return `Seat ${seatNumber} is not on this bus.`;
}
function failure(status, code, message) {
    return { ok: false, status, code, message };
}
/** The one conflict answer: 409, the seat's number, and the catalogue's seat-just-booked sentence. */
export function seatTakenFailure(seatNumber) {
    return {
        ok: false,
        status: 409,
        code: 'SEAT_TAKEN',
        message: MESSAGES.seatJustBooked(seatNumber),
        conflictSeat: seatNumber,
    };
}
function seatOf(trip, seatNumber) {
    const wanted = seatNumber.trim().toUpperCase();
    return trip.seats.find((seat) => seat.number.trim().toUpperCase() === wanted);
}
/** True once the scheduled departure is in the past. An unreadable departure never blocks a sale. */
export function hasDeparted(trip, now) {
    const departure = Date.parse(trip.departureAt);
    return Number.isNaN(departure) ? false : departure <= now.getTime();
}
export function createTripBookingService(deps) {
    const clock = deps.now ?? (() => new Date());
    return {
        async seatMap(tripId) {
            const wanted = tripId.trim();
            if (wanted === '')
                return failure(400, 'INVALID_REQUEST', INVALID_REQUEST_MESSAGE);
            const trip = await deps.trips.findDetail(wanted);
            if (trip === null)
                return failure(404, 'TRIP_NOT_FOUND', TRIP_NOT_FOUND_MESSAGE);
            return { ok: true, trip };
        },
        async createBooking(userId, body) {
            const parsed = parseCreateBooking(body);
            if (!parsed.ok)
                return failure(400, 'INVALID_REQUEST', parsed.message);
            const request = parsed.value;
            const trip = await deps.trips.findDetail(request.tripId);
            if (trip === null)
                return failure(404, 'TRIP_NOT_FOUND', TRIP_NOT_FOUND_MESSAGE);
            if (hasDeparted(trip, clock()))
                return failure(409, 'TRIP_DEPARTED', TRIP_DEPARTED_MESSAGE);
            const point = trip.boardingPoints.find((candidate) => candidate.id === request.boardingPointId);
            if (point === undefined) {
                return failure(400, 'INVALID_BOARDING_POINT', BOARDING_POINT_NOT_ON_BUS_MESSAGE);
            }
            for (const passenger of request.passengers) {
                const seat = seatOf(trip, passenger.seatNumber);
                if (seat === undefined) {
                    return failure(400, 'INVALID_REQUEST', seatNotOnBusMessage(passenger.seatNumber));
                }
                if (seat.isBooked)
                    return seatTakenFailure(seat.number);
            }
            const passengers = request.passengers;
            const result = await deps.bookings.create({
                userId,
                tripId: trip.id,
                boardingPointId: point.id,
                passengers,
            });
            if (result.ok)
                return { ok: true, booking: result.booking };
            return seatTakenFailure(result.conflictSeat);
        },
    };
}
