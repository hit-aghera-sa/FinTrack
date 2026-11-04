import type { AccountDeletionStore, AccountPurgeSummary } from './types.js';

/**
 * THE IRREVERSIBLE WRITE, over the app's own PostgreSQL.
 *
 * Deleting an account touches five groups of rows that must go together or not at all, so the whole
 * thing runs inside ONE transaction supplied by the injected SQL runner:
 *
 *   1. the seats of the traveller's bookings are RELEASED back to the available pool;
 *   2. the passenger rows of those bookings are deleted;
 *   3. the bookings themselves are deleted (a cancelled booking and a travelled one alike);
 *   4. every session row of the account is revoked, so every device is signed out;
 *   5. the account row is deleted — which takes the stored security question and answer, the lockout
 *      counters and the reset counters with it, and frees the mobile number for a fresh sign-up.
 *
 * The PHYSICAL schema belongs to the schema lane, which is free to map names. So, exactly as the
 * booking source does, this store asks the database ONCE what it actually has (the column list of the
 * current schema) and builds parameterised statements from the real names. Every id comparison is
 * cast to text, so a uuid key and a text key both work; every statement ends in RETURNING, so the
 * counts reported are the rows that really moved.
 *
 * Nothing happens on import: the column list is read lazily on the first purge and then cached.
 */

/** The one-method SQL surface this store needs. */
export interface SqlExecutor {
  query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

/** The same, plus an interactive transaction — the bookings lane's `prismaBookingSqlRunner` satisfies it. */
export interface TransactionalSql extends SqlExecutor {
  transaction<T>(run: (sql: SqlExecutor) => Promise<T>): Promise<T>;
}

export const SCHEMA_COLUMNS_SQL =
  'SELECT table_name, column_name FROM information_schema.columns ' +
  'WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position';

/** One row of `information_schema.columns`, as this store reads it. */
export interface SchemaColumn {
  readonly table: string;
  readonly column: string;
}

/** One physical table: its real name, and its real column names by normalised key. */
export interface TableIndex {
  readonly table: string;
  readonly columns: ReadonlyMap<string, string>;
}

export type SchemaIndex = ReadonlyMap<string, TableIndex>;

/** Raised when the schema holds no account table at all — deletion cannot be attempted. */
export class AccountSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountSchemaError';
  }
}

export interface SessionTableNames {
  readonly table: string;
  readonly userId: string;
}

export interface BookingTableNames {
  readonly table: string;
  readonly id: string;
  readonly userId: string;
  readonly tripId: string | null;
}

export interface PassengerTableNames {
  readonly table: string;
  readonly bookingId: string;
  readonly seatNumber: string | null;
}

export interface SeatTableNames {
  readonly table: string;
  readonly bookingId: string | null;
  readonly booked: string | null;
  readonly tripId: string | null;
  readonly seatNumber: string | null;
}

/** Every real name this store needs, resolved from the live schema. */
export interface AccountDeletionSchema {
  readonly userTable: string;
  readonly userId: string;
  readonly sessions: SessionTableNames | null;
  readonly bookings: BookingTableNames | null;
  readonly passengers: PassengerTableNames | null;
  readonly seats: SeatTableNames | null;
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
export function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildIndex(rows: readonly SchemaColumn[]): SchemaIndex {
  const index = new Map<string, { table: string; columns: Map<string, string> }>();
  for (const row of rows) {
    if (row.table === '' || row.column === '') continue;
    const key = normaliseName(row.table);
    const existing = index.get(key);
    const entry = existing ?? { table: row.table, columns: new Map<string, string>() };
    if (existing === undefined) index.set(key, entry);
    entry.columns.set(normaliseName(row.column), row.column);
  }
  return index;
}

/** The first candidate table that really exists, with its real name. */
export function pickTable(index: SchemaIndex, candidates: readonly string[]): TableIndex | null {
  for (const candidate of candidates) {
    const found = index.get(normaliseName(candidate));
    if (found !== undefined) return found;
  }
  return null;
}

/** The first candidate column that really exists on that table, with its real name. */
export function pickColumn(table: TableIndex, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const found = table.columns.get(normaliseName(candidate));
    if (found !== undefined) return found;
  }
  return null;
}

export function resolveAccountSchema(index: SchemaIndex): AccountDeletionSchema {
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
  const sessions: SessionTableNames | null =
    sessionTable !== null && sessionUserId !== null ? { table: sessionTable.table, userId: sessionUserId } : null;

  const bookingTable = pickTable(index, BOOKING_TABLES);
  const bookingId = bookingTable === null ? null : pickColumn(bookingTable, BOOKING_ID_COLUMNS);
  const bookingUserId = bookingTable === null ? null : pickColumn(bookingTable, USER_FK_COLUMNS);
  const bookings: BookingTableNames | null =
    bookingTable !== null && bookingId !== null && bookingUserId !== null
      ? {
          table: bookingTable.table,
          id: bookingId,
          userId: bookingUserId,
          tripId: pickColumn(bookingTable, TRIP_FK_COLUMNS),
        }
      : null;

  const passengerTable = pickTable(index, PASSENGER_TABLES);
  const passengerBookingId = passengerTable === null ? null : pickColumn(passengerTable, BOOKING_FK_COLUMNS);
  const passengers: PassengerTableNames | null =
    passengerTable !== null && passengerBookingId !== null
      ? {
          table: passengerTable.table,
          bookingId: passengerBookingId,
          seatNumber: pickColumn(passengerTable, SEAT_NUMBER_COLUMNS),
        }
      : null;

  const seatTable = pickTable(index, SEAT_TABLES);
  const seats: SeatTableNames | null =
    seatTable === null
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

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function loadSchema(sql: SqlExecutor): Promise<AccountDeletionSchema> {
  const rows = await sql.query(SCHEMA_COLUMNS_SQL);
  const columns: SchemaColumn[] = rows.map((row: Record<string, unknown>) => ({
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
export async function runPurge(
  sql: SqlExecutor,
  schema: AccountDeletionSchema,
  userId: string,
): Promise<AccountPurgeSummary> {
  const bookings = schema.bookings;
  const passengers = schema.passengers;
  const seats = schema.seats;

  let releasedSeats = 0;
  let deletedPassengers = 0;
  let deletedBookings = 0;
  let revokedSessions = 0;

  const bookingIdsAsText =
    bookings === null
      ? null
      : `SELECT ${q(bookings.id)}::text FROM ${q(bookings.table)} WHERE ${q(bookings.userId)}::text = $1`;

  if (seats !== null && bookings !== null && bookingIdsAsText !== null) {
    if (seats.bookingId !== null) {
      // The seat table holds the booking that took it: drop the hold (and the booked marker).
      const assignments = [`${q(seats.bookingId)} = NULL`];
      if (seats.booked !== null) assignments.push(`${q(seats.booked)} = false`);
      const released = await sql.query(
        `UPDATE ${q(seats.table)} SET ${assignments.join(', ')} ` +
          `WHERE ${q(seats.bookingId)}::text IN (${bookingIdsAsText}) RETURNING 1 AS released`,
        [userId],
      );
      releasedSeats = released.length;
    } else if (
      seats.booked !== null &&
      seats.tripId !== null &&
      seats.seatNumber !== null &&
      bookings.tripId !== null &&
      passengers !== null &&
      passengers.seatNumber !== null
    ) {
      // The seat table carries only a booked marker: find the seats through the passenger rows.
      const released = await sql.query(
        `UPDATE ${q(seats.table)} SET ${q(seats.booked)} = false WHERE EXISTS (` +
          `SELECT 1 FROM ${q(passengers.table)} p JOIN ${q(bookings.table)} b ` +
          `ON p.${q(passengers.bookingId)}::text = b.${q(bookings.id)}::text ` +
          `WHERE b.${q(bookings.userId)}::text = $1 ` +
          `AND p.${q(passengers.seatNumber)}::text = ${q(seats.table)}.${q(seats.seatNumber)}::text ` +
          `AND b.${q(bookings.tripId)}::text = ${q(seats.table)}.${q(seats.tripId)}::text` +
          `) RETURNING 1 AS released`,
        [userId],
      );
      releasedSeats = released.length;
    }
  }

  if (passengers !== null && bookings !== null && bookingIdsAsText !== null) {
    const removed = await sql.query(
      `DELETE FROM ${q(passengers.table)} ` +
        `WHERE ${q(passengers.bookingId)}::text IN (${bookingIdsAsText}) RETURNING 1 AS deleted`,
      [userId],
    );
    deletedPassengers = removed.length;
  }

  if (bookings !== null) {
    const removed = await sql.query(
      `DELETE FROM ${q(bookings.table)} WHERE ${q(bookings.userId)}::text = $1 RETURNING 1 AS deleted`,
      [userId],
    );
    deletedBookings = removed.length;
  }

  if (schema.sessions !== null) {
    const removed = await sql.query(
      `DELETE FROM ${q(schema.sessions.table)} WHERE ${q(schema.sessions.userId)}::text = $1 RETURNING 1 AS deleted`,
      [userId],
    );
    revokedSessions = removed.length;
  }

  const account = await sql.query(
    `DELETE FROM ${q(schema.userTable)} WHERE ${q(schema.userId)}::text = $1 RETURNING 1 AS deleted`,
    [userId],
  );

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
export function createSqlAccountDeletionStore(sql: TransactionalSql): AccountDeletionStore {
  let pending: Promise<AccountDeletionSchema> | null = null;

  const schemaOnce = (): Promise<AccountDeletionSchema> => {
    if (pending === null) {
      pending = loadSchema(sql).catch((error: unknown) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };

  return {
    async purgeAccount(userId: string): Promise<AccountPurgeSummary> {
      const schema = await schemaOnce();
      return sql.transaction((tx: SqlExecutor) => runPurge(tx, schema, userId));
    },
  };
}
