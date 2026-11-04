import { istDayKey, normalisePickupAt, toDate, toInstant } from './instant.js';
import {
  buildSchemaMap,
  findColumn,
  findTable,
  quoteIdentifier,
  requireColumn,
  requireTable,
  type SchemaColumnRow,
  type SchemaMap,
} from './schema-map.js';
import type {
  BoardingPointRow,
  CatalogueDataSource,
  CityRow,
  SeatRow,
  TripRow,
  TripSearchQuery,
} from './source.js';

/**
 * THE CATALOGUE READ SOURCE, over the app's own PostgreSQL through Prisma.
 *
 * The physical schema (tables, columns, how a seat is marked taken) belongs to the schema lane, which
 * is free to map names. So this source asks the database ONCE what it actually has — the column list
 * of the current schema — and builds its parameterised statements from the real names. It understands
 * the shapes the schema may take: a trip that names its cities directly or through a route, a bus name
 * and type on the bus or on the trip, seats keyed by trip or by bus and travel date, and a seat marked
 * taken by a boolean, a state, a booking reference, or by a passenger of a live booking sitting there.
 *
 * Nothing happens on import: the column list is read lazily on the first query and then cached.
 */

/** The two-method SQL surface this source needs — `prismaSqlRunner` from `src/db/client` satisfies it. */
export interface CatalogueSqlRunner {
  query(text: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
}

const q = quoteIdentifier;
const DAY_MS = 86_400_000;

const SCHEMA_SQL =
  'SELECT table_name, column_name FROM information_schema.columns ' +
  'WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position';

export interface CityNames {
  readonly table: string;
  readonly id: string;
  readonly name: string;
}

export interface BusNames {
  readonly table: string;
  readonly id: string;
  readonly name: string | null;
  readonly busType: string | null;
}

export type CityLink =
  | { readonly kind: 'columns'; readonly fromColumn: string; readonly toColumn: string }
  | {
      readonly kind: 'route';
      readonly routeIdColumn: string;
      readonly routeTable: string;
      readonly routeId: string;
      readonly fromColumn: string;
      readonly toColumn: string;
    };

export interface TripNames {
  readonly table: string;
  readonly id: string;
  readonly busId: string | null;
  readonly name: string | null;
  readonly busType: string | null;
  readonly departure: string;
  readonly arrival: string | null;
  readonly fare: string;
  readonly travelDate: string | null;
  readonly cityLink: CityLink;
}

export interface SeatNames {
  readonly table: string;
  readonly number: string;
  readonly row: string | null;
  readonly column: string | null;
  readonly tripId: string | null;
  readonly busId: string | null;
  readonly travelDate: string | null;
  readonly isBooked: string | null;
  readonly state: string | null;
  readonly bookingId: string | null;
}

export interface BoardingNames {
  readonly table: string;
  readonly id: string;
  readonly name: string;
  readonly pickupAt: string | null;
  readonly tripId: string | null;
  readonly busId: string | null;
}

export interface BookingNames {
  readonly table: string;
  readonly id: string;
  readonly tripId: string | null;
  readonly status: string | null;
}

export interface PassengerNames {
  readonly table: string;
  readonly bookingId: string;
  readonly seatNumber: string;
}

export interface CatalogueNames {
  readonly city: CityNames;
  readonly bus: BusNames | null;
  readonly trip: TripNames;
  readonly seat: SeatNames;
  readonly boarding: BoardingNames | null;
  readonly booking: BookingNames | null;
  readonly passenger: PassengerNames | null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  // Prisma hands a numeric column over as a Decimal object, which converts cleanly.
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'true' || text === 't' || text === 'yes' || text === '1') return true;
    if (text === 'false' || text === 'f' || text === 'no' || text === '0') return false;
  }
  return null;
}

/** Resolve every table and column the catalogue reads, or fail with one clear sentence. */
export function resolveCatalogueNames(map: SchemaMap): CatalogueNames {
  const cityTable = requireTable(map, ['city', 'cities'], 'cities');
  const city: CityNames = {
    table: cityTable.name,
    id: requireColumn(cityTable, ['id', 'cityId'], 'the city id'),
    name: requireColumn(cityTable, ['name', 'cityName', 'title'], 'the city name'),
  };

  const busTable = findTable(map, ['bus', 'buses']);
  const bus: BusNames | null =
    busTable === null
      ? null
      : {
          table: busTable.name,
          id: requireColumn(busTable, ['id', 'busId'], 'the bus id'),
          name: findColumn(busTable, ['name', 'busName', 'title']),
          busType: findColumn(busTable, ['busType', 'type', 'category']),
        };

  const tripTable = requireTable(map, ['trip', 'trips'], 'trips');
  const fromColumn = findColumn(tripTable, ['fromCityId', 'originCityId', 'sourceCityId', 'startCityId']);
  const toColumn = findColumn(tripTable, ['toCityId', 'destinationCityId', 'endCityId']);
  const routeIdColumn = findColumn(tripTable, ['routeId']);
  let cityLink: CityLink | null = null;
  if (fromColumn !== null && toColumn !== null) {
    cityLink = { kind: 'columns', fromColumn, toColumn };
  } else if (routeIdColumn !== null) {
    const routeTable = findTable(map, ['route', 'routes']);
    if (routeTable !== null) {
      const routeId = findColumn(routeTable, ['id', 'routeId']);
      const routeFrom = findColumn(routeTable, ['fromCityId', 'originCityId', 'sourceCityId']);
      const routeTo = findColumn(routeTable, ['toCityId', 'destinationCityId', 'endCityId']);
      if (routeId !== null && routeFrom !== null && routeTo !== null) {
        cityLink = {
          kind: 'route',
          routeIdColumn,
          routeTable: routeTable.name,
          routeId,
          fromColumn: routeFrom,
          toColumn: routeTo,
        };
      }
    }
  }
  if (cityLink === null) {
    throw new Error(
      `Bus Booking App catalogue: cannot tell which cities a trip connects — expected from/to city ` +
        `columns on "${tripTable.name}" or a route table to join.`,
    );
  }

  const trip: TripNames = {
    table: tripTable.name,
    id: requireColumn(tripTable, ['id', 'tripId'], 'the trip id'),
    busId: findColumn(tripTable, ['busId']),
    name: findColumn(tripTable, ['busName', 'name', 'title']),
    busType: findColumn(tripTable, ['busType', 'type']),
    departure: requireColumn(
      tripTable,
      ['departureAt', 'departsAt', 'departureTime', 'departure'],
      'the trip departure',
    ),
    arrival: findColumn(tripTable, ['arrivalAt', 'arrivesAt', 'arrivalTime', 'arrival']),
    fare: requireColumn(tripTable, ['farePerSeat', 'fare', 'fareInRupees', 'price'], 'the fare per seat'),
    travelDate: findColumn(tripTable, ['travelDate', 'journeyDate', 'serviceDate', 'date']),
    cityLink,
  };

  const seatTable = requireTable(map, ['seat', 'seats'], 'seats');
  const seat: SeatNames = {
    table: seatTable.name,
    number: requireColumn(seatTable, ['seatNumber', 'number', 'label', 'code'], 'the seat number'),
    row: findColumn(seatTable, ['row', 'rowIndex', 'seatRow', 'rowNumber', 'gridRow']),
    column: findColumn(seatTable, ['column', 'columnIndex', 'seatColumn', 'columnNumber', 'gridColumn', 'col']),
    tripId: findColumn(seatTable, ['tripId']),
    busId: findColumn(seatTable, ['busId']),
    travelDate: findColumn(seatTable, ['travelDate', 'journeyDate', 'date']),
    isBooked: findColumn(seatTable, ['isBooked', 'booked']),
    state: findColumn(seatTable, ['state', 'status', 'seatState']),
    bookingId: findColumn(seatTable, ['bookingId']),
  };

  const boardingTable = findTable(map, ['boardingPoint', 'boardingPoints', 'pickupPoint', 'pickupPoints']);
  const boarding: BoardingNames | null =
    boardingTable === null
      ? null
      : {
          table: boardingTable.name,
          id: requireColumn(boardingTable, ['id', 'boardingPointId'], 'the boarding point id'),
          name: requireColumn(boardingTable, ['name', 'label', 'title'], 'the boarding point name'),
          pickupAt: findColumn(boardingTable, ['pickupAt', 'pickupTime', 'pickUpAt', 'time']),
          tripId: findColumn(boardingTable, ['tripId']),
          busId: findColumn(boardingTable, ['busId']),
        };

  const bookingTable = findTable(map, ['booking', 'bookings']);
  const booking: BookingNames | null =
    bookingTable === null
      ? null
      : {
          table: bookingTable.name,
          id: requireColumn(bookingTable, ['id', 'bookingId'], 'the booking id'),
          tripId: findColumn(bookingTable, ['tripId']),
          status: findColumn(bookingTable, ['status', 'state']),
        };

  const passengerTable = findTable(map, ['passenger', 'passengers']);
  let passenger: PassengerNames | null = null;
  if (passengerTable !== null) {
    const bookingId = findColumn(passengerTable, ['bookingId']);
    const seatNumber = findColumn(passengerTable, ['seatNumber', 'seat', 'seatLabel']);
    if (bookingId !== null && seatNumber !== null) {
      passenger = { table: passengerTable.name, bookingId, seatNumber };
    }
  }

  return { city, bus, trip, seat, boarding, booking, passenger };
}

interface TripPlan {
  readonly select: string;
  readonly fromExpr: string;
  readonly toExpr: string;
}

function buildTripPlan(names: CatalogueNames): TripPlan {
  const joins: string[] = [];
  const busIdColumn = names.trip.busId;
  const busNames = names.bus;
  let busNameExpr: string | null = null;
  let busTypeExpr: string | null = null;
  if (busNames !== null && busIdColumn !== null) {
    joins.push(
      `LEFT JOIN ${q(busNames.table)} bu ON bu.${q(busNames.id)}::text = tr.${q(busIdColumn)}::text`,
    );
    busNameExpr = busNames.name === null ? null : `bu.${q(busNames.name)}`;
    busTypeExpr = busNames.busType === null ? null : `bu.${q(busNames.busType)}::text`;
  }

  const link = names.trip.cityLink;
  let fromExpr: string;
  let toExpr: string;
  if (link.kind === 'columns') {
    fromExpr = `tr.${q(link.fromColumn)}`;
    toExpr = `tr.${q(link.toColumn)}`;
  } else {
    joins.push(
      `LEFT JOIN ${q(link.routeTable)} ro ON ro.${q(link.routeId)}::text = tr.${q(link.routeIdColumn)}::text`,
    );
    fromExpr = `ro.${q(link.fromColumn)}`;
    toExpr = `ro.${q(link.toColumn)}`;
  }
  joins.push(`LEFT JOIN ${q(names.city.table)} fc ON fc.${q(names.city.id)}::text = ${fromExpr}::text`);
  joins.push(`LEFT JOIN ${q(names.city.table)} tc ON tc.${q(names.city.id)}::text = ${toExpr}::text`);

  const columns: string[] = [
    `tr.${q(names.trip.id)}::text AS trip_id`,
    `${busNameExpr ?? 'NULL'} AS bus_name`,
    `${names.trip.name === null ? 'NULL' : `tr.${q(names.trip.name)}`} AS trip_name`,
    `${busTypeExpr ?? 'NULL'} AS bus_type`,
    `${names.trip.busType === null ? 'NULL' : `tr.${q(names.trip.busType)}::text`} AS trip_type`,
    `fc.${q(names.city.id)}::text AS from_city_id`,
    `fc.${q(names.city.name)} AS from_city_name`,
    `tc.${q(names.city.id)}::text AS to_city_id`,
    `tc.${q(names.city.name)} AS to_city_name`,
    `tr.${q(names.trip.departure)} AS departure_at`,
    `${names.trip.arrival === null ? 'NULL' : `tr.${q(names.trip.arrival)}`} AS arrival_at`,
    `tr.${q(names.trip.fare)} AS fare_per_seat`,
    `${names.trip.travelDate === null ? 'NULL' : `tr.${q(names.trip.travelDate)}`} AS travel_date`,
  ];

  return {
    select: `SELECT ${columns.join(', ')} FROM ${q(names.trip.table)} tr ${joins.join(' ')}`,
    fromExpr,
    toExpr,
  };
}

function mapTripRow(row: Record<string, unknown>): TripRow | null {
  const id = asString(row.trip_id);
  if (id === null) return null;
  const travelDay = toDate(row.travel_date);
  const departureAt = toInstant(row.departure_at, travelDay);
  if (departureAt === null) return null;
  let arrivalAt = toInstant(row.arrival_at, travelDay ?? departureAt) ?? departureAt;
  if (arrivalAt.getTime() < departureAt.getTime()) {
    // An arrival stored as a clock time lands on the next day when the bus travels overnight.
    arrivalAt = new Date(arrivalAt.getTime() + DAY_MS);
  }
  return {
    id,
    busName: asString(row.bus_name) ?? asString(row.trip_name) ?? 'Bus',
    busType: asString(row.bus_type) ?? asString(row.trip_type) ?? '',
    fromCity: { id: asString(row.from_city_id) ?? '', name: asString(row.from_city_name) ?? '' },
    toCity: { id: asString(row.to_city_id) ?? '', name: asString(row.to_city_name) ?? '' },
    departureAt,
    arrivalAt,
    farePerSeat: asNumber(row.fare_per_seat) ?? 0,
  };
}

function seatColumns(seat: SeatNames): string {
  return [
    `se.${q(seat.number)} AS seat_number`,
    `${seat.row === null ? 'NULL' : `se.${q(seat.row)}`} AS seat_row`,
    `${seat.column === null ? 'NULL' : `se.${q(seat.column)}`} AS seat_column`,
    `${seat.isBooked === null ? 'NULL' : `se.${q(seat.isBooked)}`} AS is_booked`,
    `${seat.state === null ? 'NULL' : `se.${q(seat.state)}::text`} AS seat_state`,
    `${seat.bookingId === null ? 'NULL' : `se.${q(seat.bookingId)}::text`} AS booking_id`,
    `${seat.travelDate === null ? 'NULL' : `se.${q(seat.travelDate)}`} AS travel_date`,
  ].join(', ');
}

function seatOrderBy(seat: SeatNames): string {
  const parts: string[] = [];
  if (seat.row !== null) parts.push(`se.${q(seat.row)} ASC`);
  if (seat.column !== null) parts.push(`se.${q(seat.column)} ASC`);
  parts.push(`se.${q(seat.number)} ASC`);
  return ` ORDER BY ${parts.join(', ')}`;
}

function seatBooked(row: Record<string, unknown>): boolean {
  const flag = asBoolean(row.is_booked);
  if (flag !== null) return flag;
  const state = asString(row.seat_state);
  if (state !== null) {
    const key = state.toLowerCase();
    return key === 'booked' || key === 'sold' || key === 'unavailable';
  }
  return asString(row.booking_id) !== null;
}

/** Where a seat sits when the schema keeps no grid position: read it off the seat number (`B3`). */
function positionFromNumber(number: string, index: number): { row: number; column: number } {
  const match = /^([A-Za-z]+)[\s-]?(\d+)$/.exec(number.trim());
  if (match !== null) {
    let row = 0;
    for (const character of match[1].toUpperCase()) {
      row = row * 26 + (character.charCodeAt(0) - 64);
    }
    return { row, column: Number(match[2]) };
  }
  return { row: 1, column: index + 1 };
}

function mapSeatRow(row: Record<string, unknown>, tripId: string, index: number): SeatRow | null {
  const number = asString(row.seat_number);
  if (number === null) return null;
  const fallback = positionFromNumber(number, index);
  return {
    tripId,
    number,
    row: asNumber(row.seat_row) ?? fallback.row,
    column: asNumber(row.seat_column) ?? fallback.column,
    isBooked: seatBooked(row),
  };
}

function placeholders(count: number): string {
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) parts.push(`$${index + 1}`);
  return parts.join(', ');
}

export function createPrismaCatalogueSource(runner: CatalogueSqlRunner): CatalogueDataSource {
  let resolved: Promise<CatalogueNames> | null = null;

  const names = (): Promise<CatalogueNames> => {
    if (resolved === null) {
      resolved = (async (): Promise<CatalogueNames> => {
        const rows = await runner.query(SCHEMA_SQL);
        const schemaRows: SchemaColumnRow[] = rows.flatMap((row) => {
          const table = asString(row.table_name);
          const column = asString(row.column_name);
          return table !== null && column !== null ? [{ table, column }] : [];
        });
        return resolveCatalogueNames(buildSchemaMap(schemaRows));
      })().catch((error: unknown) => {
        // A failed resolution must not be cached: the next call tries again.
        resolved = null;
        throw error;
      });
    }
    return resolved;
  };

  const tripLink = async (
    tripId: string,
  ): Promise<{ busId: string | null; travelDay: Date | null; departureAt: Date | null }> => {
    const catalogue = await names();
    const columns = [
      `${catalogue.trip.busId === null ? 'NULL' : `tr.${q(catalogue.trip.busId)}::text`} AS bus_id`,
      `tr.${q(catalogue.trip.departure)} AS departure_at`,
      `${catalogue.trip.travelDate === null ? 'NULL' : `tr.${q(catalogue.trip.travelDate)}`} AS travel_date`,
    ];
    const rows = await runner.query(
      `SELECT ${columns.join(', ')} FROM ${q(catalogue.trip.table)} tr ` +
        `WHERE tr.${q(catalogue.trip.id)}::text = $1 LIMIT 1`,
      [tripId],
    );
    const row = rows[0];
    if (row === undefined) return { busId: null, travelDay: null, departureAt: null };
    const travelDay = toDate(row.travel_date);
    const departureAt = toInstant(row.departure_at, travelDay);
    return { busId: asString(row.bus_id), travelDay: travelDay ?? departureAt, departureAt };
  };

  const heldSeatNumbers = async (
    tripIds: readonly string[],
    catalogue: CatalogueNames,
  ): Promise<Map<string, Set<string>>> => {
    const held = new Map<string, Set<string>>();
    const booking = catalogue.booking;
    const passenger = catalogue.passenger;
    if (booking === null || passenger === null || booking.tripId === null) return held;
    const statusFilter =
      booking.status === null ? '' : ` AND lower(bk.${q(booking.status)}::text) <> 'cancelled'`;
    const rows = await runner.query(
      `SELECT bk.${q(booking.tripId)}::text AS trip_id, pa.${q(passenger.seatNumber)} AS seat_number ` +
        `FROM ${q(passenger.table)} pa JOIN ${q(booking.table)} bk ` +
        `ON bk.${q(booking.id)}::text = pa.${q(passenger.bookingId)}::text ` +
        `WHERE bk.${q(booking.tripId)}::text IN (${placeholders(tripIds.length)})${statusFilter}`,
      [...tripIds],
    );
    for (const row of rows) {
      const tripId = asString(row.trip_id);
      const number = asString(row.seat_number);
      if (tripId === null || number === null) continue;
      const numbers = held.get(tripId) ?? new Set<string>();
      numbers.add(number);
      held.set(tripId, numbers);
    }
    return held;
  };

  const listSeats = async (tripIds: readonly string[]): Promise<SeatRow[]> => {
    if (tripIds.length === 0) return [];
    const catalogue = await names();
    const seat = catalogue.seat;
    const collected: SeatRow[] = [];
    const tripIdColumn = seat.tripId;

    if (tripIdColumn !== null) {
      const rows = await runner.query(
        `SELECT se.${q(tripIdColumn)}::text AS trip_id, ${seatColumns(seat)} FROM ${q(seat.table)} se ` +
          `WHERE se.${q(tripIdColumn)}::text IN (${placeholders(tripIds.length)})${seatOrderBy(seat)}`,
        [...tripIds],
      );
      rows.forEach((row, index) => {
        const tripId = asString(row.trip_id);
        if (tripId === null) return;
        const mapped = mapSeatRow(row, tripId, index);
        if (mapped !== null) collected.push(mapped);
      });
    } else {
      const busIdColumn = seat.busId;
      for (const tripId of tripIds) {
        if (busIdColumn === null) break;
        const link = await tripLink(tripId);
        if (link.busId === null) continue;
        const rows = await runner.query(
          `SELECT ${seatColumns(seat)} FROM ${q(seat.table)} se ` +
            `WHERE se.${q(busIdColumn)}::text = $1${seatOrderBy(seat)}`,
          [link.busId],
        );
        const dayKey = link.travelDay === null ? null : istDayKey(link.travelDay);
        rows.forEach((row, index) => {
          if (seat.travelDate !== null && dayKey !== null) {
            const seatDay = toDate(row.travel_date);
            if (seatDay !== null && istDayKey(seatDay) !== dayKey) return;
          }
          const mapped = mapSeatRow(row, tripId, index);
          if (mapped !== null) collected.push(mapped);
        });
      }
    }

    const held = await heldSeatNumbers(tripIds, catalogue);
    if (held.size === 0) return collected;
    return collected.map((row) => {
      const numbers = held.get(row.tripId);
      return numbers !== undefined && numbers.has(row.number) ? { ...row, isBooked: true } : row;
    });
  };

  return {
    async listCities(): Promise<CityRow[]> {
      const catalogue = await names();
      const rows = await runner.query(
        `SELECT ci.${q(catalogue.city.id)}::text AS id, ci.${q(catalogue.city.name)} AS name ` +
          `FROM ${q(catalogue.city.table)} ci ORDER BY ci.${q(catalogue.city.name)} ASC`,
      );
      return rows.flatMap((row) => {
        const id = asString(row.id);
        const name = asString(row.name);
        return id !== null && name !== null ? [{ id, name }] : [];
      });
    },

    async listTrips(query: TripSearchQuery): Promise<TripRow[]> {
      const catalogue = await names();
      const plan = buildTripPlan(catalogue);
      const conditions: string[] = [];
      const values: string[] = [];
      if (query.fromCityId !== undefined) {
        values.push(query.fromCityId);
        conditions.push(`${plan.fromExpr}::text = $${values.length}`);
      }
      if (query.toCityId !== undefined) {
        values.push(query.toCityId);
        conditions.push(`${plan.toExpr}::text = $${values.length}`);
      }
      const where = conditions.length === 0 ? '' : ` WHERE ${conditions.join(' AND ')}`;
      const rows = await runner.query(`${plan.select}${where}`, values);
      return rows.flatMap((row) => {
        const trip = mapTripRow(row);
        return trip === null ? [] : [trip];
      });
    },

    async findTrip(tripId: string): Promise<TripRow | null> {
      const catalogue = await names();
      const plan = buildTripPlan(catalogue);
      const rows = await runner.query(`${plan.select} WHERE tr.${q(catalogue.trip.id)}::text = $1 LIMIT 1`, [
        tripId,
      ]);
      const row = rows[0];
      return row === undefined ? null : mapTripRow(row);
    },

    listSeats,

    async listBoardingPoints(tripId: string): Promise<BoardingPointRow[]> {
      const catalogue = await names();
      const boarding = catalogue.boarding;
      if (boarding === null) return [];

      let whereColumn: string | null = boarding.tripId;
      let parameter: string | null = boarding.tripId === null ? null : tripId;
      let base: Date | null = null;
      if (whereColumn === null || boarding.pickupAt !== null) {
        const link = await tripLink(tripId);
        base = link.departureAt;
        if (whereColumn === null && boarding.busId !== null && link.busId !== null) {
          whereColumn = boarding.busId;
          parameter = link.busId;
        }
      }
      if (whereColumn === null || parameter === null) return [];

      const order =
        boarding.pickupAt === null
          ? `ORDER BY bp.${q(boarding.name)} ASC`
          : `ORDER BY bp.${q(boarding.pickupAt)} ASC NULLS LAST, bp.${q(boarding.name)} ASC`;
      const rows = await runner.query(
        `SELECT bp.${q(boarding.id)}::text AS id, bp.${q(boarding.name)} AS name, ` +
          `${boarding.pickupAt === null ? 'NULL' : `bp.${q(boarding.pickupAt)}`} AS pickup_at ` +
          `FROM ${q(boarding.table)} bp WHERE bp.${q(whereColumn)}::text = $1 ${order}`,
        [parameter],
      );
      return rows.flatMap((row) => {
        const id = asString(row.id);
        const name = asString(row.name);
        return id !== null && name !== null
          ? [{ id, name, pickupAt: normalisePickupAt(row.pickup_at, base) }]
          : [];
      });
    },
  };
}
