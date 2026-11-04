export const SCHEMA_COLUMNS_SQL = 'SELECT table_name, column_name FROM information_schema.columns ' +
    'WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position';
/** Raised when the schema holds no account table at all — deletion cannot be attempted. */
export class AccountSchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AccountSchemaError';
    }
}
const USER_TABLES = ['user', 'users', 'account', 'accounts', 'traveller', 'travellers'];
const SESSION_TABLES = ['session', 'sessions', 'usersession', 'usersessions'];
const BOOKING_TABLES = ['booking', 'bookings'];
const PASSENGER_TABLES = ['passenger', 'passengers', 'bookingpassenger', 'bookingpassengers'];
const SEAT_TABLES = ['seat', 'seats', 'tripseat', 'tripseats', 'busseat', 'busseats'];
const USER_ID_COLUMNS = ['id', 'userId', 'uuid'];
const USER_FK_COLUMNS = ['userId', 'user_id', 'accountId', 'travellerId', 'userUuid'];
const BOOKING_ID_COLUMNS = ['id', 'bookingId', 'uuid'];
const BOOKING_FK_COLUMNS = ['bookingId', 'booking_id'];
const TRIP_FK_COLUMNS = ['tripId', 'trip_id'];
const SEAT_NUMBER_COLUMNS = ['seatNumber', 'seat_number', 'seatNo', 'seatLabel', 'number', 'seat'];
const BOOKED_COLUMNS = ['isBooked', 'booked', 'isReserved', 'reserved', 'isOccupied'];
/** A table or column name as it is compared: letters and digits, lower case. */
export function normaliseName(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function buildIndex(rows) {
    const index = new Map();
    for (const row of rows) {
        if (row.table === '' || row.column === '')
            continue;
        const key = normaliseName(row.table);
        const existing = index.get(key);
        const entry = existing ?? { table: row.table, columns: new Map() };
        if (existing === undefined)
            index.set(key, entry);
        entry.columns.set(normaliseName(row.column), row.column);
    }
    return index;
}
/** The first candidate table that really exists, with its real name. */
export function pickTable(index, candidates) {
    for (const candidate of candidates) {
        const found = index.get(normaliseName(candidate));
        if (found !== undefined)
            return found;
    }
    return null;
}
/** The first candidate column that really exists on that table, with its real name. */
export function pickColumn(table, candidates) {
    for (const candidate of candidates) {
        const found = table.columns.get(normaliseName(candidate));
        if (found !== undefined)
            return found;
    }
    return null;
}
export function resolveAccountSchema(index) {
    const users = pickTable(index, USER_TABLES);
    if (users === null) {
        throw new AccountSchemaError('No account table found in the current schema: account deletion cannot run.');
    }
    const userId = pickColumn(users, USER_ID_COLUMNS);
    if (userId === null) {
        throw new AccountSchemaError(`The account table ${users.table} has no id column: account deletion cannot run.`);
    }
    const sessionTable = pickTable(index, SESSION_TABLES);
    const sessionUserId = sessionTable === null ? null : pickColumn(sessionTable, USER_FK_COLUMNS);
    const sessions = sessionTable !== null && sessionUserId !== null ? { table: sessionTable.table, userId: sessionUserId } : null;
    const bookingTable = pickTable(index, BOOKING_TABLES);
    const bookingId = bookingTable === null ? null : pickColumn(bookingTable, BOOKING_ID_COLUMNS);
    const bookingUserId = bookingTable === null ? null : pickColumn(bookingTable, USER_FK_COLUMNS);
    const bookings = bookingTable !== null && bookingId !== null && bookingUserId !== null
        ? {
            table: bookingTable.table,
            id: bookingId,
            userId: bookingUserId,
            tripId: pickColumn(bookingTable, TRIP_FK_COLUMNS),
        }
        : null;
    const passengerTable = pickTable(index, PASSENGER_TABLES);
    const passengerBookingId = passengerTable === null ? null : pickColumn(passengerTable, BOOKING_FK_COLUMNS);
    const passengers = passengerTable !== null && passengerBookingId !== null
        ? {
            table: passengerTable.table,
            bookingId: passengerBookingId,
            seatNumber: pickColumn(passengerTable, SEAT_NUMBER_COLUMNS),
        }
        : null;
    const seatTable = pickTable(index, SEAT_TABLES);
    const seats = seatTable === null
        ? null
        : {
            table: seatTable.table,
            bookingId: pickColumn(seatTable, BOOKING_FK_COLUMNS),
            booked: pickColumn(seatTable, BOOKED_COLUMNS),
            tripId: pickColumn(seatTable, TRIP_FK_COLUMNS),
            seatNumber: pickColumn(seatTable, SEAT_NUMBER_COLUMNS),
        };
    return { userTable: users.table, userId, sessions, bookings, passengers, seats };
}
function q(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
}
async function loadSchema(sql) {
    const rows = await sql.query(SCHEMA_COLUMNS_SQL);
    const columns = rows.map((row) => ({
        table: String(row.table_name ?? ''),
        column: String(row.column_name ?? ''),
    }));
    return resolveAccountSchema(buildIndex(columns));
}
/**
 * The five steps of a deletion, in the one order that is safe: seats first (they are read through the
 * passenger rows), then passengers, bookings, sessions and finally the account row.
 *
 * Exported so the order and the statements can be verified without a database.
 */
export async function runPurge(sql, schema, userId) {
    const bookings = schema.bookings;
    const passengers = schema.passengers;
    const seats = schema.seats;
    let releasedSeats = 0;
    let deletedPassengers = 0;
    let deletedBookings = 0;
    let revokedSessions = 0;
    const bookingIdsAsText = bookings === null
        ? null
        : `SELECT ${q(bookings.id)}::text FROM ${q(bookings.table)} WHERE ${q(bookings.userId)}::text = $1`;
    if (seats !== null && bookings !== null && bookingIdsAsText !== null) {
        if (seats.bookingId !== null) {
            // The seat table holds the booking that took it: drop the hold (and the booked marker).
            const assignments = [`${q(seats.bookingId)} = NULL`];
            if (seats.booked !== null)
                assignments.push(`${q(seats.booked)} = false`);
            const released = await sql.query(`UPDATE ${q(seats.table)} SET ${assignments.join(', ')} ` +
                `WHERE ${q(seats.bookingId)}::text IN (${bookingIdsAsText}) RETURNING 1 AS released`, [userId]);
            releasedSeats = released.length;
        }
        else if (seats.booked !== null &&
            seats.tripId !== null &&
            seats.seatNumber !== null &&
            bookings.tripId !== null &&
            passengers !== null &&
            passengers.seatNumber !== null) {
            // The seat table carries only a booked marker: find the seats through the passenger rows.
            const released = await sql.query(`UPDATE ${q(seats.table)} SET ${q(seats.booked)} = false WHERE EXISTS (` +
                `SELECT 1 FROM ${q(passengers.table)} p JOIN ${q(bookings.table)} b ` +
                `ON p.${q(passengers.bookingId)}::text = b.${q(bookings.id)}::text ` +
                `WHERE b.${q(bookings.userId)}::text = $1 ` +
                `AND p.${q(passengers.seatNumber)}::text = ${q(seats.table)}.${q(seats.seatNumber)}::text ` +
                `AND b.${q(bookings.tripId)}::text = ${q(seats.table)}.${q(seats.tripId)}::text` +
                `) RETURNING 1 AS released`, [userId]);
            releasedSeats = released.length;
        }
    }
    if (passengers !== null && bookings !== null && bookingIdsAsText !== null) {
        const removed = await sql.query(`DELETE FROM ${q(passengers.table)} ` +
            `WHERE ${q(passengers.bookingId)}::text IN (${bookingIdsAsText}) RETURNING 1 AS deleted`, [userId]);
        deletedPassengers = removed.length;
    }
    if (bookings !== null) {
        const removed = await sql.query(`DELETE FROM ${q(bookings.table)} WHERE ${q(bookings.userId)}::text = $1 RETURNING 1 AS deleted`, [userId]);
        deletedBookings = removed.length;
    }
    if (schema.sessions !== null) {
        const removed = await sql.query(`DELETE FROM ${q(schema.sessions.table)} WHERE ${q(schema.sessions.userId)}::text = $1 RETURNING 1 AS deleted`, [userId]);
        revokedSessions = removed.length;
    }
    const account = await sql.query(`DELETE FROM ${q(schema.userTable)} WHERE ${q(schema.userId)}::text = $1 RETURNING 1 AS deleted`, [userId]);
    return {
        releasedSeats,
        deletedPassengers,
        deletedBookings,
        revokedSessions,
        deletedUser: account.length > 0,
    };
}
/**
 * The production store: the real schema, read once and cached, and one transaction per deletion.
 * A failed schema read is not cached, so a database that was unreachable can be read again later.
 */
export function createSqlAccountDeletionStore(sql) {
    let pending = null;
    const schemaOnce = () => {
        if (pending === null) {
            pending = loadSchema(sql).catch((error) => {
                pending = null;
                throw error;
            });
        }
        return pending;
    };
    return {
        async purgeAccount(userId) {
            const schema = await schemaOnce();
            return sql.transaction((tx) => runPurge(tx, schema, userId));
        },
    };
}
