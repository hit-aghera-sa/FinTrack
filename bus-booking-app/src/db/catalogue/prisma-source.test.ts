import { describe, expect, it } from 'vitest';
import { buildSchemaMap, type SchemaColumnRow } from './schema-map.js';
import { createPrismaCatalogueSource, resolveCatalogueNames, type CatalogueSqlRunner } from './prisma-source.js';

/**
 * The catalogue source is exercised against a SIMULATED schema: the fake SQL runner answers the
 * column-list query with the tables below and then answers each statement the source builds from
 * those names. That proves the whole path — name resolution, statement building and row mapping —
 * without a live database.
 */
const SIMULATED_SCHEMA: Readonly<Record<string, readonly string[]>> = {
  City: ['id', 'name'],
  Bus: ['id', 'name', 'busType'],
  Trip: ['id', 'busId', 'fromCityId', 'toCityId', 'departureAt', 'arrivalAt', 'farePerSeat'],
  Seat: ['id', 'tripId', 'seatNumber', 'row', 'column', 'isBooked'],
  BoardingPoint: ['id', 'busId', 'name', 'pickupAt'],
  Booking: ['id', 'tripId', 'status'],
  Passenger: ['id', 'bookingId', 'seatNumber'],
};

const SCHEMA_ROWS: Array<Record<string, unknown>> = Object.entries(SIMULATED_SCHEMA).flatMap(
  ([table, columns]) => columns.map((column) => ({ table_name: table, column_name: column })),
);

const TRIP_ROW: Record<string, unknown> = {
  trip_id: 'trip-pune-mumbai',
  bus_name: 'Shree Travels',
  trip_name: null,
  bus_type: 'AC Sleeper',
  trip_type: null,
  from_city_id: 'city-pune',
  from_city_name: 'Pune',
  to_city_id: 'city-mumbai',
  to_city_name: 'Mumbai',
  departure_at: new Date('2024-06-12T16:00:00.000Z'),
  arrival_at: new Date('2024-06-12T23:30:00.000Z'),
  fare_per_seat: 600,
  travel_date: null,
};

const SEAT_ROWS: Array<Record<string, unknown>> = [
  {
    trip_id: 'trip-pune-mumbai',
    seat_number: 'A1',
    seat_row: 1,
    seat_column: 1,
    is_booked: false,
    seat_state: null,
    booking_id: null,
    travel_date: null,
  },
  {
    trip_id: 'trip-pune-mumbai',
    seat_number: 'A2',
    seat_row: 1,
    seat_column: 2,
    is_booked: false,
    seat_state: null,
    booking_id: null,
    travel_date: null,
  },
];

interface RecordedQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

function createRunner(): { runner: CatalogueSqlRunner; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const runner: CatalogueSqlRunner = {
    async query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>> {
      queries.push({ sql: text, params: params ?? [] });
      if (text.includes('information_schema.columns')) return SCHEMA_ROWS;
      if (text.includes('FROM "Trip" tr')) {
        if (text.includes('AS bus_id')) {
          return [
            { bus_id: 'bus-shree', departure_at: new Date('2024-06-12T16:00:00.000Z'), travel_date: null },
          ];
        }
        return [TRIP_ROW];
      }
      if (text.includes('FROM "Seat" se')) return SEAT_ROWS;
      if (text.includes('FROM "Passenger" pa')) return [{ trip_id: 'trip-pune-mumbai', seat_number: 'A2' }];
      if (text.includes('FROM "BoardingPoint" bp')) {
        return [{ id: 'bp-dadar', name: 'Dadar, near TT Circle', pickup_at: '9:00 PM' }];
      }
      if (text.includes('FROM "City" ci')) {
        return [
          { id: 'city-pune', name: 'Pune' },
          { id: 'city-mumbai', name: 'Mumbai' },
        ];
      }
      return [];
    },
  };
  return { runner, queries };
}

describe('resolveCatalogueNames', () => {
  it('resolves every table and column the catalogue reads', () => {
    const rows: SchemaColumnRow[] = SCHEMA_ROWS.flatMap((row) => {
      const table = row.table_name;
      const column = row.column_name;
      return typeof table === 'string' && typeof column === 'string' ? [{ table, column }] : [];
    });
    const names = resolveCatalogueNames(buildSchemaMap(rows));

    expect(names.city).toEqual({ table: 'City', id: 'id', name: 'name' });
    expect(names.trip.table).toBe('Trip');
    expect(names.trip.departure).toBe('departureAt');
    expect(names.trip.cityLink).toEqual({ kind: 'columns', fromColumn: 'fromCityId', toColumn: 'toCityId' });
    expect(names.seat.tripId).toBe('tripId');
    expect(names.seat.isBooked).toBe('isBooked');
    expect(names.boarding?.busId).toBe('busId');
    expect(names.passenger?.seatNumber).toBe('seatNumber');
  });

  it('says so when the catalogue has no cities at all', () => {
    const map = buildSchemaMap([{ table: 'Trip', column: 'id' }]);
    expect(() => resolveCatalogueNames(map)).toThrow(/no table found for cities/);
  });
});

describe('createPrismaCatalogueSource', () => {
  it('reads the physical names once and caches them', async () => {
    const { runner, queries } = createRunner();
    const source = createPrismaCatalogueSource(runner);

    await source.listCities();
    await source.listCities();

    expect(queries.filter((query) => query.sql.includes('information_schema.columns'))).toHaveLength(1);
  });

  it('lists cities by name', async () => {
    const { runner, queries } = createRunner();

    await expect(createPrismaCatalogueSource(runner).listCities()).resolves.toEqual([
      { id: 'city-pune', name: 'Pune' },
      { id: 'city-mumbai', name: 'Mumbai' },
    ]);
    expect(queries.some((query) => query.sql.includes('ORDER BY ci."name" ASC'))).toBe(true);
  });

  it('lists the trips of a route, parameterised by the two cities', async () => {
    const { runner, queries } = createRunner();

    const trips = await createPrismaCatalogueSource(runner).listTrips({
      fromCityId: 'city-pune',
      toCityId: 'city-mumbai',
    });

    expect(trips).toEqual([
      {
        id: 'trip-pune-mumbai',
        busName: 'Shree Travels',
        busType: 'AC Sleeper',
        fromCity: { id: 'city-pune', name: 'Pune' },
        toCity: { id: 'city-mumbai', name: 'Mumbai' },
        departureAt: new Date('2024-06-12T16:00:00.000Z'),
        arrivalAt: new Date('2024-06-12T23:30:00.000Z'),
        farePerSeat: 600,
      },
    ]);
    const tripQuery = queries.find((query) => query.sql.includes('FROM "Trip" tr'));
    expect(tripQuery?.params).toEqual(['city-pune', 'city-mumbai']);
  });

  it('finds one trip by id', async () => {
    const { runner } = createRunner();

    const trip = await createPrismaCatalogueSource(runner).findTrip('trip-pune-mumbai');

    expect(trip?.id).toBe('trip-pune-mumbai');
  });

  it('marks a seat booked when a live booking has a passenger sitting there', async () => {
    const { runner } = createRunner();

    const seats = await createPrismaCatalogueSource(runner).listSeats(['trip-pune-mumbai']);

    expect(seats).toEqual([
      { tripId: 'trip-pune-mumbai', number: 'A1', row: 1, column: 1, isBooked: false },
      { tripId: 'trip-pune-mumbai', number: 'A2', row: 1, column: 2, isBooked: true },
    ]);
  });

  it('asks for no seats when no trip was named', async () => {
    const { runner, queries } = createRunner();

    await expect(createPrismaCatalogueSource(runner).listSeats([])).resolves.toEqual([]);
    expect(queries).toEqual([]);
  });

  it('reads boarding points through the bus and places a clock pickup time on the travel day', async () => {
    const { runner, queries } = createRunner();

    const points = await createPrismaCatalogueSource(runner).listBoardingPoints('trip-pune-mumbai');

    expect(points).toEqual([
      { id: 'bp-dadar', name: 'Dadar, near TT Circle', pickupAt: '2024-06-12T15:30:00.000Z' },
    ]);
    const boardingQuery = queries.find((query) => query.sql.includes('FROM "BoardingPoint" bp'));
    expect(boardingQuery?.params).toEqual(['bus-shree']);
  });
});
