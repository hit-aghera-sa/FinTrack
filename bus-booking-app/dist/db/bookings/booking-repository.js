import { BookingNotCancellableError, BookingNotFoundError, BookingTripNotFoundError, canCancelBooking, deriveBookingStatus, isCancelledText, parseGender, } from '../../models/bookings/index.js';
import { BOOKING_ID_PREFIX } from '../../models/common/index.js';
/**
 * THE BOOKING RULES.
 *
 * Everything the product promises about a booking is decided here:
 *
 *   • creation is ONE transaction over every chosen seat — a seat already held returns
 *     `{ ok: false, conflictSeat }` and nothing at all is written;
 *   • the human reference is a fresh `BB-#####`, checked against the ones already in use;
 *   • a read belongs to the owning account only, and derives `status` and `canCancel` against the
 *     moment of the read, never from a stored flag;
 *   • cancellation is refused unless the booking is still cancellable, and otherwise releases the
 *     seats straight away so they reappear in the seat map.
 *
 * The rows come from a `BookingDataSource` and the trip's details from a `TripReader`, so these rules
 * are exercised by specs with in-memory doubles and by Prisma in production with no second copy.
 */
const PREFIX = BOOKING_ID_PREFIX.endsWith('-') ? BOOKING_ID_PREFIX : `${BOOKING_ID_PREFIX}-`;
const ID_ATTEMPTS = 10;
/** A fresh human booking reference: the app's prefix and five digits, e.g. `BB-10452`. */
export function randomBookingId(random = Math.random) {
    const serial = 10_000 + Math.floor(random() * 90_000);
    return `${PREFIX}${serial}`;
}
function boardingPointName(trip, boardingPointId) {
    if (boardingPointId !== null) {
        const match = trip.boardingPoints.find((point) => point.id === boardingPointId);
        if (match !== undefined)
            return match.name;
    }
    const first = trip.boardingPoints[0];
    return first === undefined ? '' : first.name;
}
function toPassenger(row) {
    return {
        seatNumber: row.seatNumber,
        name: row.name,
        age: row.age,
        gender: parseGender(row.gender) ?? 'OTHER',
    };
}
/** One stored booking, its trip, and the moment of the read, as the record every lane shows. */
export function toBookingRecord(row, trip, now) {
    const passengers = row.passengers.map(toPassenger);
    const seatNumbers = passengers.map((passenger) => passenger.seatNumber);
    const cancelledAt = row.cancelledAt === null ? null : row.cancelledAt.toISOString();
    const cancelled = cancelledAt !== null || isCancelledText(row.statusText);
    const departureAt = trip.departureAt;
    const arrivalAt = trip.arrivalAt;
    const status = cancelled
        ? 'CANCELLED'
        : deriveBookingStatus({ cancelledAt: null, departureAt, arrivalAt }, now);
    return {
        id: row.id,
        userId: row.userId,
        tripId: row.tripId,
        busName: trip.busName,
        busType: trip.busType,
        fromCityName: trip.fromCity.name,
        toCityName: trip.toCity.name,
        departureAt,
        arrivalAt,
        boardingPointName: boardingPointName(trip, row.boardingPointId),
        seatNumbers,
        passengers,
        farePerSeat: trip.farePerSeat,
        totalFare: trip.farePerSeat * seatNumbers.length,
        status,
        canCancel: canCancelBooking(status, departureAt, now),
        createdAt: row.createdAt.toISOString(),
        cancelledAt,
    };
}
/** Newest journey first, with the most recently made booking first on a tie. */
export function compareBookingsNewestFirst(left, right) {
    const byDeparture = Date.parse(right.departureAt) - Date.parse(left.departureAt);
    if (Number.isFinite(byDeparture) && byDeparture !== 0)
        return byDeparture;
    const byCreated = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return Number.isFinite(byCreated) ? byCreated : 0;
}
export function createBookingRepository(deps) {
    const clock = deps.now ?? (() => new Date());
    const nextId = deps.newBookingId ?? (() => randomBookingId());
    async function tripFor(cache, tripId) {
        const cached = cache.get(tripId);
        if (cached !== undefined)
            return cached;
        const trip = await deps.trips.findDetail(tripId);
        cache.set(tripId, trip);
        return trip;
    }
    return {
        async create(input) {
            const trip = await deps.trips.findDetail(input.tripId);
            if (trip === null)
                throw new BookingTripNotFoundError(input.tripId);
            const passengers = input.passengers.map((passenger) => ({
                seatNumber: passenger.seatNumber.trim(),
                name: passenger.name.trim(),
                age: Math.trunc(passenger.age),
                gender: passenger.gender,
            }));
            // Fast refusal from the seat map the traveller was shown; the transaction settles any race.
            const held = new Set(trip.seats.filter((seat) => seat.isBooked).map((seat) => seat.number));
            for (const passenger of passengers) {
                if (held.has(passenger.seatNumber))
                    return { ok: false, conflictSeat: passenger.seatNumber };
            }
            const totalFare = trip.farePerSeat * passengers.length;
            for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
                const id = nextId();
                const taken = await deps.bookings.existsById(id);
                if (taken)
                    continue;
                const written = await deps.bookings.insert({
                    id,
                    userId: input.userId,
                    tripId: input.tripId,
                    boardingPointId: input.boardingPointId,
                    passengers,
                    farePerSeat: trip.farePerSeat,
                    totalFare,
                    createdAt: clock(),
                });
                if (!written.ok)
                    return { ok: false, conflictSeat: written.conflictSeat };
                return { ok: true, booking: toBookingRecord(written.booking, trip, clock()) };
            }
            throw new Error('Bus Booking App bookings: no free booking reference could be allocated.');
        },
        async listByUser(userId, now) {
            const rows = await deps.bookings.listByUser(userId);
            const cache = new Map();
            const records = [];
            for (const row of rows) {
                if (row.userId !== userId)
                    continue;
                const trip = await tripFor(cache, row.tripId);
                if (trip === null)
                    continue;
                records.push(toBookingRecord(row, trip, now));
            }
            records.sort(compareBookingsNewestFirst);
            return records;
        },
        async findByIdForUser(bookingId, userId, now) {
            const row = await deps.bookings.findByIdForUser(bookingId, userId);
            if (row === null || row.userId !== userId)
                return null;
            const trip = await deps.trips.findDetail(row.tripId);
            if (trip === null)
                return null;
            return toBookingRecord(row, trip, now);
        },
        async cancel(bookingId, userId) {
            const now = clock();
            const row = await deps.bookings.findByIdForUser(bookingId, userId);
            if (row === null || row.userId !== userId)
                throw new BookingNotFoundError(bookingId);
            const trip = await deps.trips.findDetail(row.tripId);
            if (trip === null)
                throw new BookingNotFoundError(bookingId);
            const current = toBookingRecord(row, trip, now);
            if (!current.canCancel)
                throw new BookingNotCancellableError(bookingId);
            const cancelled = await deps.bookings.markCancelled(bookingId, userId, now);
            if (cancelled === null)
                throw new BookingNotFoundError(bookingId);
            return toBookingRecord(cancelled, trip, now);
        },
    };
}
