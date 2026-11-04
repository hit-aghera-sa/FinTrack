import { randomUUID } from 'node:crypto';
import { IST_OFFSET_MINUTES } from '../../format/index.js';
import { istDayKey, toDate } from '../catalogue/instant.js';
import { buildSchemaMap, findTable, normaliseIdentifier, quoteIdentifier, } from '../catalogue/schema-map.js';
/**
 * THE BOOKING WRITE/READ SOURCE, over the app's own PostgreSQL through Prisma.
 *
 * The physical schema belongs to the schema lane, which is free to map names and types. So this
 * source asks the database ONCE what it actually has — the column list of the current schema — and
 * builds its parameterised statements from the real names, exactly as the catalogue source does.
 *
 * Creation runs inside ONE transaction that first takes a transaction-scoped advisory lock on the
 * trip, so two travellers choosing the same seat at the same moment are serialised; the seats are
 * then re-checked (passenger rows of live bookings AND any booked marker on the seat table) and the
 * booking, its passengers and its seat holds are written together or not at all.
 *
 * Nothing happens on import: the column list is read lazily on the first call and then cached.
 */
const q = quoteIdentifier;
const SCHEMA_SQL = 'SELECT table_name, column_name, data_type FROM information_schema.columns ' +
    'WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position';
const LOCK_SQL = 'WITH lock_taken AS (SELECT pg_advisory_xact_lock(hashtext($1)) AS token) SELECT 1 AS locked FROM lock_taken';
const BOOKING_TABLES = ['booking', 'bookings'];
const PASSENGER_TABLES = ['passenger', 'passengers', 'bookingpassenger', 'bookingpassengers'];
const SEAT_TABLES = ['seat', 'seats', 'tripseat', 'tripseats', 'busseat', 'busseats'];
const TRIP_TABLES = ['trip', 'trips', 'bustrip', 'bustrips', 'schedule', 'schedules'];
const NO_TRIP_CONTEXT = { busId: null, dayKey: null, departure: null };
/** A Postgres text array literal, e.g. `{"A1","A2"}`. JSON quoting is compatible for these values. */
export function textArrayLiteral(values) {
    return `{${values.map((value) => JSON.stringify(value)).join(',')}}`;
}
/** The India-time clock reading of an instant, as `HH:MM:SS`. */
export function istClock(instant) {
    const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}:00`;
}
function columnOf(table, candidates) {
    for (const candidate of candidates) {
        const actual = table.columns.get(normaliseIdentifier(candidate));
        if (actual !== undefined)
            return actual;
    }
    return null;
}
function requiredColumn(table, candidates, what) {
    const found = columnOf(table, candidates);
    if (found === null) {
        throw new Error(`Bus Booking App bookings: table "${table.name}" has no ${what} column (looked for ${candidates.join(', ')}).`);
    }
    return found;
}
function typeOf(types, table, column) {
    if (column === null)
        return null;
    return types.get(`${normaliseIdentifier(table)}.${normaliseIdentifier(column)}`) ?? null;
}
/** The physical names and types the booking statements need, from the live column list. */
export function resolveBookingNames(rows) {
    const map = buildSchemaMap(rows.map((row) => ({ table: row.table, column: row.column })));
    const types = new Map();
    for (const row of rows) {
        types.set(`${normaliseIdentifier(row.table)}.${normaliseIdentifier(row.column)}`, row.dataType.toLowerCase());
    }
    const bookingTable = findTable(map, BOOKING_TABLES);
    if (bookingTable === null) {
        throw new Error('Bus Booking App bookings: no Booking table was found in the current schema.');
    }
    const passengerTable = findTable(map, PASSENGER_TABLES);
    if (passengerTable === null) {
        throw new Error('Bus Booking App bookings: no Passenger table was found in the current schema.');
    }
    const id = requiredColumn(bookingTable, ['id', 'bookingId', 'reference', 'code'], 'booking id');
    const referenceCandidate = columnOf(bookingTable, ['bookingId', 'reference', 'bookingReference', 'bookingCode', 'code']);
    const reference = referenceCandidate === null || referenceCandidate === id ? null : referenceCandidate;
    const seatNumbers = columnOf(bookingTable, ['seatNumbers', 'seats']);
    const travelDate = columnOf(bookingTable, ['travelDate', 'journeyDate', 'date']);
    const departureTime = columnOf(bookingTable, ['departureTime', 'departureAt', 'departsAt']);
    const bookings = {
        table: bookingTable.name,
        id,
        idIsUuid: typeOf(types, bookingTable.name, id) === 'uuid',
        reference,
        userId: requiredColumn(bookingTable, ['userId', 'travellerId', 'travelerId', 'accountId'], 'owning user'),
        tripId: requiredColumn(bookingTable, ['tripId', 'busTripId', 'scheduleId'], 'trip'),
        boardingPointId: columnOf(bookingTable, ['boardingPointId', 'boardingPoint', 'pickupPointId']),
        status: columnOf(bookingTable, ['status', 'bookingStatus', 'state']),
        seatCount: columnOf(bookingTable, ['seatCount', 'seatsBooked', 'numberOfSeats', 'seatQuantity']),
        totalFare: columnOf(bookingTable, ['totalFare', 'totalAmount', 'total', 'amount']),
        farePerSeat: columnOf(bookingTable, ['farePerSeat', 'fare']),
        createdAt: columnOf(bookingTable, ['createdAt', 'bookedAt', 'created']),
        cancelledAt: columnOf(bookingTable, ['cancelledAt', 'canceledAt']),
        seatNumbers,
        seatNumbersType: typeOf(types, bookingTable.name, seatNumbers),
        busId: columnOf(bookingTable, ['busId']),
        travelDate,
        travelDateType: typeOf(types, bookingTable.name, travelDate),
        departureTime,
        departureTimeType: typeOf(types, bookingTable.name, departureTime),
    };
    const passengerId = columnOf(passengerTable, ['id', 'passengerId']);
    const passengers = {
        table: passengerTable.name,
        id: passengerId,
        idType: typeOf(types, passengerTable.name, passengerId),
        bookingId: requiredColumn(passengerTable, ['bookingId'], 'booking'),
        seatNumber: requiredColumn(passengerTable, ['seatNumber', 'seat', 'number'], 'seat number'),
        name: requiredColumn(passengerTable, ['name', 'fullName', 'passengerName'], 'passenger name'),
        age: columnOf(passengerTable, ['age']),
        gender: columnOf(passengerTable, ['gender', 'sex']),
    };
    let seats = null;
    const seatTable = findTable(map, SEAT_TABLES);
    if (seatTable !== null) {
        const number = columnOf(seatTable, ['seatNumber', 'number', 'seat', 'label', 'code']);
        if (number !== null) {
            seats = {
                table: seatTable.name,
                number,
                tripId: columnOf(seatTable, ['tripId']),
                busId: columnOf(seatTable, ['busId']),
                travelDate: columnOf(seatTable, ['travelDate', 'journeyDate', 'date']),
                isBooked: columnOf(seatTable, ['isBooked', 'booked']),
                state: columnOf(seatTable, ['state', 'status', 'seatState']),
                bookingId: columnOf(seatTable, ['bookingId']),
            };
        }
    }
    let trips = null;
    const tripTable = findTable(map, TRIP_TABLES);
    if (tripTable !== null) {
        const tripId = columnOf(tripTable, ['id', 'tripId']);
        if (tripId !== null) {
            trips = {
                table: tripTable.name,
                id: tripId,
                busId: columnOf(tripTable, ['busId']),
                travelDate: columnOf(tripTable, ['travelDate', 'journeyDate', 'date']),
                departure: columnOf(tripTable, ['departureAt', 'departureTime', 'departsAt', 'departure']),
            };
        }
    }
    return { bookings, passengers, seats, trips };
}
function toNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'bigint')
        return Number(value);
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}
function text(value) {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function firstStartingWith(values, prefix) {
    for (const value of values) {
        if (value.trim().toLowerCase().startsWith(prefix))
            return value;
    }
    return null;
}
function matchGenderWord(values, target) {
    const initial = target.charAt(0);
    for (const value of values) {
        const upper = value.trim().toUpperCase();
        if (upper === target || upper === initial)
            return value;
    }
    return null;
}
function addSeatNumbers(add, column, type, seats) {
    const kind = (type ?? '').toLowerCase();
    if (kind === 'array') {
        add(column, textArrayLiteral(seats), 'text[]');
        return;
    }
    if (kind.includes('jsonb')) {
        add(column, JSON.stringify(seats), 'jsonb');
        return;
    }
    if (kind.includes('json')) {
        add(column, JSON.stringify(seats), 'json');
        return;
    }
    add(column, seats.join(', '));
}
function addTravelDate(add, column, type, dayKey) {
    const kind = (type ?? '').toLowerCase();
    if (kind.startsWith('timestamp')) {
        add(column, new Date(`${dayKey}T00:00:00.000Z`));
        return;
    }
    if (kind === 'date') {
        add(column, dayKey, 'date');
        return;
    }
    add(column, dayKey);
}
function addDepartureTime(add, column, type, departure) {
    const kind = (type ?? '').toLowerCase();
    if (kind.startsWith('timestamp')) {
        add(column, departure);
        return;
    }
    if (kind.startsWith('time')) {
        add(column, istClock(departure), 'time');
        return;
    }
    add(column, istClock(departure).slice(0, 5));
}
/**
 * The clause that picks the seats of one trip, with `prefix` either '' or an alias such as 's.'.
 * Appends its own values to `params` and returns null when the seat table cannot be keyed.
 */
function seatScope(seats, prefix, tripId, context, params) {
    if (seats.tripId !== null) {
        params.push(tripId);
        return `CAST(${prefix}${q(seats.tripId)} AS text) = $${params.length}`;
    }
    if (seats.busId !== null && seats.travelDate !== null && context.busId !== null && context.dayKey !== null) {
        params.push(context.busId);
        const busParam = `$${params.length}`;
        params.push(context.dayKey);
        const dayParam = `$${params.length}`;
        return (`CAST(${prefix}${q(seats.busId)} AS text) = ${busParam} AND ` +
            `CAST(${prefix}${q(seats.travelDate)} AS date) = CAST(${dayParam} AS date)`);
    }
    return null;
}
function bookingSelect(names, where) {
    const b = names.bookings;
    const parts = [
        `CAST(${q(b.id)} AS text) AS row_id`,
        `CAST(${q(b.userId)} AS text) AS user_id`,
        `CAST(${q(b.tripId)} AS text) AS trip_id`,
    ];
    if (b.reference !== null)
        parts.push(`CAST(${q(b.reference)} AS text) AS reference`);
    if (b.boardingPointId !== null)
        parts.push(`CAST(${q(b.boardingPointId)} AS text) AS boarding_point_id`);
    if (b.status !== null)
        parts.push(`CAST(${q(b.status)} AS text) AS status_text`);
    if (b.createdAt !== null)
        parts.push(`${q(b.createdAt)} AS created_at`);
    if (b.cancelledAt !== null)
        parts.push(`${q(b.cancelledAt)} AS cancelled_at`);
    return `SELECT ${parts.join(', ')} FROM ${q(b.table)} WHERE ${where}`;
}
function identityWhere(names) {
    const b = names.bookings;
    const byId = b.reference === null
        ? `CAST(${q(b.id)} AS text) = $1`
        : `(CAST(${q(b.id)} AS text) = $1 OR CAST(${q(b.reference)} AS text) = $1)`;
    return `${byId} AND CAST(${q(b.userId)} AS text) = $2`;
}
async function readPassengers(sql, names, ids) {
    const p = names.passengers;
    const parts = [
        `CAST(${q(p.bookingId)} AS text) AS booking_id`,
        `CAST(${q(p.seatNumber)} AS text) AS seat_number`,
        `CAST(${q(p.name)} AS text) AS name`,
    ];
    if (p.age !== null)
        parts.push(`${q(p.age)} AS age`);
    if (p.gender !== null)
        parts.push(`CAST(${q(p.gender)} AS text) AS gender`);
    const statement = `SELECT ${parts.join(', ')} FROM ${q(p.table)} ` +
        `WHERE CAST(${q(p.bookingId)} AS text) = ANY(CAST($1 AS text[])) ORDER BY 1, 2`;
    const rows = await sql.query(statement, [textArrayLiteral(ids)]);
    const grouped = new Map();
    for (const row of rows) {
        const bookingId = text(row.booking_id);
        if (bookingId === null)
            continue;
        const passenger = {
            seatNumber: text(row.seat_number) ?? '',
            name: text(row.name) ?? '',
            age: toNumber(row.age, 0),
            gender: text(row.gender),
        };
        const existing = grouped.get(bookingId);
        if (existing === undefined)
            grouped.set(bookingId, [passenger]);
        else
            existing.push(passenger);
    }
    return grouped;
}
function toBookingRow(row, passengers) {
    const rowId = text(row.row_id) ?? '';
    const reference = text(row.reference);
    return {
        rowId,
        id: reference ?? rowId,
        userId: text(row.user_id) ?? '',
        tripId: text(row.trip_id) ?? '',
        boardingPointId: text(row.boarding_point_id),
        statusText: text(row.status_text),
        createdAt: toDate(row.created_at ?? null) ?? new Date(0),
        cancelledAt: toDate(row.cancelled_at ?? null),
        passengers: passengers.get(rowId) ?? [],
    };
}
async function readBookings(sql, names, where, params) {
    const rows = await sql.query(bookingSelect(names, where), params);
    if (rows.length === 0)
        return [];
    const ids = [];
    for (const row of rows) {
        const id = text(row.row_id);
        if (id !== null)
            ids.push(id);
    }
    const passengers = ids.length === 0 ? new Map() : await readPassengers(sql, names, ids);
    return rows.map((row) => toBookingRow(row, passengers));
}
async function distinctText(sql, table, column) {
    const rows = await sql.query(`SELECT DISTINCT CAST(${q(column)} AS text) AS value FROM ${q(table)} LIMIT 50`);
    const values = [];
    for (const row of rows) {
        const value = text(row.value);
        if (value !== null)
            values.push(value);
    }
    return values;
}
async function loadTripContext(sql, names, tripId) {
    const trips = names.trips;
    if (trips === null)
        return NO_TRIP_CONTEXT;
    const parts = [];
    if (trips.busId !== null)
        parts.push(`CAST(${q(trips.busId)} AS text) AS bus_id`);
    if (trips.travelDate !== null)
        parts.push(`${q(trips.travelDate)} AS travel_date`);
    if (trips.departure !== null)
        parts.push(`${q(trips.departure)} AS departure_at`);
    if (parts.length === 0)
        return NO_TRIP_CONTEXT;
    const rows = await sql.query(`SELECT ${parts.join(', ')} FROM ${q(trips.table)} WHERE CAST(${q(trips.id)} AS text) = $1 LIMIT 1`, [tripId]);
    const row = rows[0];
    if (row === undefined)
        return NO_TRIP_CONTEXT;
    const departure = toDate(row.departure_at ?? null);
    const travel = toDate(row.travel_date ?? null);
    let dayKey = null;
    if (travel !== null)
        dayKey = istDayKey(travel);
    else if (departure !== null)
        dayKey = istDayKey(departure);
    return { busId: text(row.bus_id), dayKey, departure };
}
export function createPrismaBookingSource(runner) {
    let namesOnce = null;
    let statusOnce = null;
    let genderOnce = null;
    let seatStateOnce = null;
    async function loadNames() {
        const rows = await runner.query(SCHEMA_SQL);
        return resolveBookingNames(rows.map((row) => ({
            table: text(row.table_name) ?? '',
            column: text(row.column_name) ?? '',
            dataType: text(row.data_type) ?? '',
        })));
    }
    function names() {
        if (namesOnce === null)
            namesOnce = loadNames();
        return namesOnce;
    }
    async function loadStatusWords(current) {
        const column = current.bookings.status;
        if (column === null)
            return { booked: 'Booked', cancelled: 'Cancelled' };
        const values = await distinctText(runner, current.bookings.table, column);
        return {
            booked: firstStartingWith(values, 'book') ?? 'Booked',
            cancelled: firstStartingWith(values, 'cancel') ?? 'Cancelled',
        };
    }
    function statusWords(current) {
        if (statusOnce === null)
            statusOnce = loadStatusWords(current);
        return statusOnce;
    }
    async function loadGenderWords(current) {
        const fallback = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
        const column = current.passengers.gender;
        if (column === null)
            return fallback;
        const values = await distinctText(runner, current.passengers.table, column);
        return {
            MALE: matchGenderWord(values, 'MALE') ?? fallback.MALE,
            FEMALE: matchGenderWord(values, 'FEMALE') ?? fallback.FEMALE,
            OTHER: matchGenderWord(values, 'OTHER') ?? fallback.OTHER,
        };
    }
    function genderWords(current) {
        if (genderOnce === null)
            genderOnce = loadGenderWords(current);
        return genderOnce;
    }
    async function loadSeatStateWords(current) {
        const fallback = { booked: 'booked', available: 'available' };
        const seats = current.seats;
        if (seats === null || seats.state === null)
            return fallback;
        const values = await distinctText(runner, seats.table, seats.state);
        return {
            booked: firstStartingWith(values, 'book') ?? fallback.booked,
            available: firstStartingWith(values, 'avail') ?? fallback.available,
        };
    }
    function seatStateWords(current) {
        if (seatStateOnce === null)
            seatStateOnce = loadSeatStateWords(current);
        return seatStateOnce;
    }
    async function takenSeats(sql, current, tripId, seatNumbers, context) {
        const taken = new Set();
        const seatsLiteral = textArrayLiteral(seatNumbers);
        const b = current.bookings;
        const p = current.passengers;
        const active = [];
        if (b.cancelledAt !== null)
            active.push(`b.${q(b.cancelledAt)} IS NULL`);
        if (b.status !== null)
            active.push(`lower(CAST(b.${q(b.status)} AS text)) NOT LIKE 'cancel%'`);
        const activeSql = active.length === 0 ? 'TRUE' : active.join(' AND ');
        const byPassenger = `SELECT CAST(p.${q(p.seatNumber)} AS text) AS seat FROM ${q(p.table)} p ` +
            `JOIN ${q(b.table)} b ON CAST(b.${q(b.id)} AS text) = CAST(p.${q(p.bookingId)} AS text) ` +
            `WHERE CAST(b.${q(b.tripId)} AS text) = $1 AND ${activeSql} ` +
            `AND CAST(p.${q(p.seatNumber)} AS text) = ANY(CAST($2 AS text[]))`;
        for (const row of await sql.query(byPassenger, [tripId, seatsLiteral])) {
            const seat = text(row.seat);
            if (seat !== null)
                taken.add(seat);
        }
        const seats = current.seats;
        if (seats !== null) {
            const marks = [];
            if (seats.isBooked !== null)
                marks.push(`s.${q(seats.isBooked)} = TRUE`);
            if (seats.bookingId !== null)
                marks.push(`s.${q(seats.bookingId)} IS NOT NULL`);
            if (seats.state !== null)
                marks.push(`lower(CAST(s.${q(seats.state)} AS text)) LIKE 'book%'`);
            if (marks.length > 0) {
                const params = [];
                const scope = seatScope(seats, 's.', tripId, context, params);
                if (scope !== null) {
                    params.push(seatsLiteral);
                    const statement = `SELECT CAST(s.${q(seats.number)} AS text) AS seat FROM ${q(seats.table)} s ` +
                        `WHERE ${scope} AND CAST(s.${q(seats.number)} AS text) = ANY(CAST($${params.length} AS text[])) ` +
                        `AND (${marks.join(' OR ')})`;
                    for (const row of await sql.query(statement, params)) {
                        const seat = text(row.seat);
                        if (seat !== null)
                            taken.add(seat);
                    }
                }
            }
        }
        return taken;
    }
    async function insertBookingRow(sql, current, row, rowId, bookedWord, context) {
        const b = current.bookings;
        const columns = [];
        const values = [];
        const params = [];
        const add = (column, value, cast) => {
            columns.push(q(column));
            params.push(value);
            values.push(cast === undefined ? `$${params.length}` : `CAST($${params.length} AS ${cast})`);
        };
        add(b.id, rowId);
        if (b.reference !== null)
            add(b.reference, row.id);
        add(b.userId, row.userId);
        add(b.tripId, row.tripId);
        if (b.boardingPointId !== null)
            add(b.boardingPointId, row.boardingPointId);
        if (b.status !== null)
            add(b.status, bookedWord);
        if (b.seatCount !== null)
            add(b.seatCount, row.passengers.length);
        if (b.totalFare !== null)
            add(b.totalFare, row.totalFare);
        if (b.farePerSeat !== null)
            add(b.farePerSeat, row.farePerSeat);
        if (b.createdAt !== null)
            add(b.createdAt, row.createdAt);
        if (b.seatNumbers !== null) {
            addSeatNumbers(add, b.seatNumbers, b.seatNumbersType, row.passengers.map((passenger) => passenger.seatNumber));
        }
        if (b.busId !== null && context.busId !== null)
            add(b.busId, context.busId);
        if (b.travelDate !== null && context.dayKey !== null) {
            addTravelDate(add, b.travelDate, b.travelDateType, context.dayKey);
        }
        if (b.departureTime !== null && context.departure !== null) {
            addDepartureTime(add, b.departureTime, b.departureTimeType, context.departure);
        }
        await sql.query(`INSERT INTO ${q(b.table)} (${columns.join(', ')}) VALUES (${values.join(', ')}) ` +
            `RETURNING CAST(${q(b.id)} AS text) AS row_id`, params);
    }
    async function insertPassengerRows(sql, current, row, rowId, genders) {
        const p = current.passengers;
        const serial = (p.idType ?? '').startsWith('int') || (p.idType ?? '') === 'smallint' || (p.idType ?? '') === 'bigint';
        for (const passenger of row.passengers) {
            const columns = [];
            const values = [];
            const params = [];
            const add = (column, value, cast) => {
                columns.push(q(column));
                params.push(value);
                values.push(cast === undefined ? `$${params.length}` : `CAST($${params.length} AS ${cast})`);
            };
            if (p.id !== null && !serial) {
                add(p.id, p.idType === 'uuid' ? randomUUID() : `${rowId}-${passenger.seatNumber}`);
            }
            add(p.bookingId, rowId);
            add(p.seatNumber, passenger.seatNumber);
            add(p.name, passenger.name);
            if (p.age !== null)
                add(p.age, passenger.age);
            if (p.gender !== null)
                add(p.gender, genders[passenger.gender]);
            await sql.query(`INSERT INTO ${q(p.table)} (${columns.join(', ')}) VALUES (${values.join(', ')}) ` +
                `RETURNING CAST(${q(p.bookingId)} AS text) AS booking_id`, params);
        }
    }
    async function holdSeats(sql, current, tripId, seatNumbers, rowId, context, words) {
        const seats = current.seats;
        if (seats === null)
            return;
        const params = [];
        const sets = [];
        if (seats.isBooked !== null)
            sets.push(`${q(seats.isBooked)} = TRUE`);
        if (seats.bookingId !== null) {
            params.push(rowId);
            sets.push(`${q(seats.bookingId)} = $${params.length}`);
        }
        if (seats.state !== null) {
            params.push(words.booked);
            sets.push(`${q(seats.state)} = $${params.length}`);
        }
        if (sets.length === 0)
            return;
        const scope = seatScope(seats, '', tripId, context, params);
        if (scope === null)
            return;
        params.push(textArrayLiteral(seatNumbers));
        await sql.query(`UPDATE ${q(seats.table)} SET ${sets.join(', ')} WHERE ${scope} ` +
            `AND CAST(${q(seats.number)} AS text) = ANY(CAST($${params.length} AS text[])) ` +
            `RETURNING CAST(${q(seats.number)} AS text) AS seat`, params);
    }
    async function freeSeats(sql, current, booking, context, words) {
        const seats = current.seats;
        if (seats === null)
            return;
        const params = [];
        const sets = [];
        if (seats.isBooked !== null)
            sets.push(`${q(seats.isBooked)} = FALSE`);
        if (seats.bookingId !== null)
            sets.push(`${q(seats.bookingId)} = NULL`);
        if (seats.state !== null) {
            params.push(words.available);
            sets.push(`${q(seats.state)} = $${params.length}`);
        }
        if (sets.length === 0)
            return;
        let where;
        if (seats.bookingId !== null) {
            params.push(booking.rowId);
            where = `CAST(${q(seats.bookingId)} AS text) = $${params.length}`;
        }
        else {
            const scope = seatScope(seats, '', booking.tripId, context, params);
            if (scope === null)
                return;
            params.push(textArrayLiteral(booking.passengers.map((passenger) => passenger.seatNumber)));
            where = `${scope} AND CAST(${q(seats.number)} AS text) = ANY(CAST($${params.length} AS text[]))`;
        }
        await sql.query(`UPDATE ${q(seats.table)} SET ${sets.join(', ')} WHERE ${where} ` +
            `RETURNING CAST(${q(seats.number)} AS text) AS seat`, params);
    }
    return {
        async existsById(bookingId) {
            const current = await names();
            const b = current.bookings;
            const where = b.reference === null
                ? `CAST(${q(b.id)} AS text) = $1`
                : `(CAST(${q(b.id)} AS text) = $1 OR CAST(${q(b.reference)} AS text) = $1)`;
            const rows = await runner.query(`SELECT 1 AS found FROM ${q(b.table)} WHERE ${where} LIMIT 1`, [bookingId]);
            return rows.length > 0;
        },
        async insert(row) {
            const current = await names();
            const status = await statusWords(current);
            const genders = await genderWords(current);
            const seatStates = await seatStateWords(current);
            const seatNumbers = row.passengers.map((passenger) => passenger.seatNumber);
            return runner.transaction(async (tx) => {
                await tx.query(LOCK_SQL, [row.tripId]);
                const context = await loadTripContext(tx, current, row.tripId);
                const taken = await takenSeats(tx, current, row.tripId, seatNumbers, context);
                for (const seat of seatNumbers) {
                    if (taken.has(seat))
                        return { ok: false, conflictSeat: seat };
                }
                const rowId = current.bookings.idIsUuid ? randomUUID() : row.id;
                await insertBookingRow(tx, current, row, rowId, status.booked, context);
                await insertPassengerRows(tx, current, row, rowId, genders);
                await holdSeats(tx, current, row.tripId, seatNumbers, rowId, context, seatStates);
                const stored = await readBookings(tx, current, `CAST(${q(current.bookings.id)} AS text) = $1`, [rowId]);
                const booking = stored[0];
                if (booking === undefined) {
                    throw new Error('Bus Booking App bookings: the new booking could not be read back.');
                }
                return { ok: true, booking };
            });
        },
        async listByUser(userId) {
            const current = await names();
            return readBookings(runner, current, `CAST(${q(current.bookings.userId)} AS text) = $1`, [userId]);
        },
        async findByIdForUser(bookingId, userId) {
            const current = await names();
            const rows = await readBookings(runner, current, identityWhere(current), [bookingId, userId]);
            return rows[0] ?? null;
        },
        async markCancelled(bookingId, userId, cancelledAt) {
            const current = await names();
            const status = await statusWords(current);
            const seatStates = await seatStateWords(current);
            const b = current.bookings;
            return runner.transaction(async (tx) => {
                const found = await readBookings(tx, current, identityWhere(current), [bookingId, userId]);
                const existing = found[0];
                if (existing === undefined)
                    return null;
                const params = [];
                const sets = [];
                if (b.cancelledAt !== null) {
                    params.push(cancelledAt);
                    sets.push(`${q(b.cancelledAt)} = $${params.length}`);
                }
                if (b.status !== null) {
                    params.push(status.cancelled);
                    sets.push(`${q(b.status)} = $${params.length}`);
                }
                if (sets.length > 0) {
                    params.push(existing.rowId);
                    await tx.query(`UPDATE ${q(b.table)} SET ${sets.join(', ')} WHERE CAST(${q(b.id)} AS text) = $${params.length} ` +
                        `RETURNING CAST(${q(b.id)} AS text) AS row_id`, params);
                }
                const context = await loadTripContext(tx, current, existing.tripId);
                await freeSeats(tx, current, existing, context, seatStates);
                const after = await readBookings(tx, current, `CAST(${q(b.id)} AS text) = $1`, [existing.rowId]);
                return after[0] ?? null;
            });
        },
    };
}
