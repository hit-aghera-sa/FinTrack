import { DEFAULT_BUS_TYPE, parseBusType } from '../../models/catalogue/index.js';
import { istDayWindow } from './instant.js';
/**
 * THE CATALOGUE'S READ RULES.
 *
 * Everything a traveller is told about what is on offer is decided here:
 *
 *   • a search shows only the trips of that route which leave AFTER the moment of the search and
 *     inside the requested India-time calendar day, earliest first;
 *   • seats-left is counted from the seat map (a trip whose every seat is held reports 0 — sold out);
 *   • a seat map is returned in layout order, each seat carrying whether a booking holds it;
 *   • an unknown trip is `null`, never an empty trip.
 *
 * The rows come from a `CatalogueDataSource`, so these rules are exercised by specs with fixtures and
 * by the Prisma source in production without a second copy of the logic.
 */
/** Layout order: down the rows, across the columns, seat number as the tie-breaker. */
export function compareSeats(left, right) {
    if (left.row !== right.row)
        return left.row - right.row;
    if (left.column !== right.column)
        return left.column - right.column;
    return left.number.localeCompare(right.number);
}
function toSeatInfo(seat) {
    return { number: seat.number, row: seat.row, column: seat.column, isBooked: seat.isBooked };
}
function toBoardingPoint(row) {
    return { id: row.id, name: row.name, pickupAt: row.pickupAt };
}
/** One trip as the API states it, with the seat counts derived from the seats handed in. */
export function toTripSummary(trip, seats) {
    let seatsLeft = 0;
    for (const seat of seats) {
        if (!seat.isBooked)
            seatsLeft += 1;
    }
    return {
        id: trip.id,
        busName: trip.busName,
        busType: parseBusType(trip.busType) ?? DEFAULT_BUS_TYPE,
        fromCity: { id: trip.fromCity.id, name: trip.fromCity.name },
        toCity: { id: trip.toCity.id, name: trip.toCity.name },
        departureAt: trip.departureAt.toISOString(),
        arrivalAt: trip.arrivalAt.toISOString(),
        farePerSeat: trip.farePerSeat,
        seatsLeft,
        totalSeats: seats.length,
    };
}
function groupSeatsByTrip(seats) {
    const grouped = new Map();
    for (const seat of seats) {
        const existing = grouped.get(seat.tripId);
        if (existing === undefined)
            grouped.set(seat.tripId, [seat]);
        else
            existing.push(seat);
    }
    return grouped;
}
export function createTripRepository(source) {
    return {
        async listCities() {
            const rows = await source.listCities();
            return rows
                .map((row) => ({ id: row.id, name: row.name }))
                .sort((left, right) => left.name.localeCompare(right.name));
        },
        async search(params) {
            const day = istDayWindow(params.date);
            if (day === null)
                return [];
            const nowMs = params.now.getTime();
            const startMs = day.start.getTime();
            const endMs = day.end.getTime();
            const trips = await source.listTrips({ fromCityId: params.fromCityId, toCityId: params.toCityId });
            const onOffer = trips
                .filter((trip) => {
                const departure = trip.departureAt.getTime();
                return departure > nowMs && departure >= startMs && departure < endMs;
            })
                .sort((left, right) => left.departureAt.getTime() - right.departureAt.getTime());
            if (onOffer.length === 0)
                return [];
            const seats = groupSeatsByTrip(await source.listSeats(onOffer.map((trip) => trip.id)));
            return onOffer.map((trip) => toTripSummary(trip, seats.get(trip.id) ?? []));
        },
        async listUpcoming(params) {
            if (params.limit <= 0)
                return [];
            const nowMs = params.now.getTime();
            const trips = await source.listTrips({});
            const onOffer = trips
                .filter((trip) => trip.departureAt.getTime() > nowMs)
                .sort((left, right) => left.departureAt.getTime() - right.departureAt.getTime())
                .slice(0, params.limit);
            if (onOffer.length === 0)
                return [];
            const seats = groupSeatsByTrip(await source.listSeats(onOffer.map((trip) => trip.id)));
            return onOffer.map((trip) => toTripSummary(trip, seats.get(trip.id) ?? []));
        },
        async findDetail(tripId) {
            const trip = await source.findTrip(tripId);
            if (trip === null)
                return null;
            const [seatRows, boardingRows] = await Promise.all([
                source.listSeats([trip.id]),
                source.listBoardingPoints(trip.id),
            ]);
            const seats = seatRows.filter((seat) => seat.tripId === trip.id).slice().sort(compareSeats);
            return {
                ...toTripSummary(trip, seats),
                seats: seats.map(toSeatInfo),
                boardingPoints: boardingRows.map(toBoardingPoint),
            };
        },
    };
}
