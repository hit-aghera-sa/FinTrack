import { describe, expect, it } from 'vitest';
import {
  AccountSchemaError,
  SCHEMA_COLUMNS_SQL,
  buildIndex,
  createSqlAccountDeletionStore,
  resolveAccountSchema,
  runPurge,
  type SchemaColumn,
  type SqlExecutor,
  type TransactionalSql,
} from './sql-store.js';

/** A schema where the seat table carries only a booked marker (seats found through passengers). */
const MARKER_COLUMNS: readonly SchemaColumn[] = [
  { table: 'User', column: 'id' },
  { table: 'User', column: 'mobileNumber' },
  { table: 'User', column: 'securityAnswerHash' },
  { table: 'User', column: 'failedLoginCount' },
  { table: 'Session', column: 'id' },
  { table: 'Session', column: 'userId' },
  { table: 'Booking', column: 'id' },
  { table: 'Booking', column: 'userId' },
  { table: 'Booking', column: 'tripId' },
  { table: 'Passenger', column: 'id' },
  { table: 'Passenger', column: 'bookingId' },
  { table: 'Passenger', column: 'seatNumber' },
  { table: 'Seat', column: 'id' },
  { table: 'Seat', column: 'tripId' },
  { table: 'Seat', column: 'seatNumber' },
  { table: 'Seat', column: 'isBooked' },
];

/** A schema where the seat row itself names the booking that holds it. */
const SEAT_HOLD_COLUMNS: readonly SchemaColumn[] = [
  ...MARKER_COLUMNS,
  { table: 'Seat', column: 'bookingId' },
];

interface Recorded {
  readonly text: string;
  readonly params: readonly unknown[];
}

function rowsFor(text: string): Array<Record<string, unknown>> {
  if (text.startsWith('UPDATE')) return [{ released: 1 }, { released: 1 }];
  if (text.includes('"Passenger"')) return [{ deleted: 1 }, { deleted: 1 }];
  if (text.includes('"Booking"')) return [{ deleted: 1 }];
  if (text.includes('"Session"')) return [{ deleted: 1 }, { deleted: 1 }, { deleted: 1 }];
  return [{ deleted: 1 }];
}

function recordingSql(): { sql: SqlExecutor; statements: Recorded[] } {
  const statements: Recorded[] = [];
  const sql: SqlExecutor = {
    async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
      statements.push({ text, params: params ?? [] });
      return rowsFor(text);
    },
  };
  return { sql, statements };
}

function fakeDatabase(columns: readonly SchemaColumn[]): { sql: TransactionalSql; statements: Recorded[] } {
  const statements: Recorded[] = [];
  const sql: TransactionalSql = {
    async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
      statements.push({ text, params: params ?? [] });
      if (text === SCHEMA_COLUMNS_SQL) {
        return columns.map((column: SchemaColumn) => ({
          table_name: column.table,
          column_name: column.column,
        }));
      }
      return rowsFor(text);
    },
    async transaction<T>(run: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return run(sql);
    },
  };
  return { sql, statements };
}

describe('the live schema is read, not assumed', () => {
  it('resolves the real table and column names', () => {
    const schema = resolveAccountSchema(buildIndex(MARKER_COLUMNS));
    expect(schema.userTable).toBe('User');
    expect(schema.userId).toBe('id');
    expect(schema.sessions).toEqual({ table: 'Session', userId: 'userId' });
    expect(schema.bookings).toEqual({ table: 'Booking', id: 'id', userId: 'userId', tripId: 'tripId' });
    expect(schema.passengers).toEqual({ table: 'Passenger', bookingId: 'bookingId', seatNumber: 'seatNumber' });
    expect(schema.seats).toEqual({
      table: 'Seat',
      bookingId: null,
      booked: 'isBooked',
      tripId: 'tripId',
      seatNumber: 'seatNumber',
    });
  });

  it('refuses to run at all when the schema holds no account table', () => {
    expect(() => resolveAccountSchema(buildIndex([{ table: 'City', column: 'id' }]))).toThrow(AccountSchemaError);
  });
});

describe('one deletion, in one order', () => {
  it('releases the seats before removing the passengers, then the bookings, sessions and account', async () => {
    const schema = resolveAccountSchema(buildIndex(MARKER_COLUMNS));
    const { sql, statements } = recordingSql();

    const summary = await runPurge(sql, schema, 'traveller-1');

    const texts = statements.map((statement: Recorded) => statement.text);
    expect(texts.length).toBe(5);
    expect(texts[0]).toContain('UPDATE "Seat" SET "isBooked" = false');
    expect(texts[0]).toContain('"Passenger"');
    expect(texts[1]).toContain('DELETE FROM "Passenger"');
    expect(texts[2]).toContain('DELETE FROM "Booking"');
    expect(texts[3]).toContain('DELETE FROM "Session"');
    expect(texts[4]).toContain('DELETE FROM "User"');
    expect(statements.every((statement: Recorded) => statement.params[0] === 'traveller-1')).toBe(true);
    expect(summary).toEqual({
      releasedSeats: 2,
      deletedPassengers: 2,
      deletedBookings: 1,
      revokedSessions: 3,
      deletedUser: true,
    });
  });

  it('drops the seat hold itself when the seat row names its booking', async () => {
    const schema = resolveAccountSchema(buildIndex(SEAT_HOLD_COLUMNS));
    const { sql, statements } = recordingSql();

    await runPurge(sql, schema, 'traveller-1');

    expect(statements[0]?.text).toContain('"bookingId" = NULL');
    expect(statements[0]?.text).toContain('"isBooked" = false');
  });

  it('reports an account that had already gone', async () => {
    const schema = resolveAccountSchema(buildIndex(MARKER_COLUMNS));
    const sql: SqlExecutor = {
      async query(): Promise<Array<Record<string, unknown>>> {
        return [];
      },
    };

    const summary = await runPurge(sql, schema, 'ghost-1');

    expect(summary.deletedUser).toBe(false);
    expect(summary.releasedSeats).toBe(0);
  });
});

describe('the store over a real SQL runner', () => {
  it('reads the schema once and purges inside a transaction', async () => {
    const { sql, statements } = fakeDatabase(MARKER_COLUMNS);
    const store = createSqlAccountDeletionStore(sql);

    const first = await store.purgeAccount('traveller-1');
    const second = await store.purgeAccount('traveller-2');

    expect(first.deletedUser).toBe(true);
    expect(second.revokedSessions).toBe(3);
    const schemaReads = statements.filter((statement: Recorded) => statement.text === SCHEMA_COLUMNS_SQL);
    expect(schemaReads.length).toBe(1);
  });
});
