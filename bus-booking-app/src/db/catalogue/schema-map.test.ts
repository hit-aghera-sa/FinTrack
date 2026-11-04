import { describe, expect, it } from 'vitest';
import {
  buildSchemaMap,
  findColumn,
  findTable,
  identifierAliases,
  normaliseIdentifier,
  quoteIdentifier,
  requireColumn,
  requireTable,
  type SchemaColumnRow,
} from './schema-map.js';

const ROWS: readonly SchemaColumnRow[] = [
  { table: 'cities', column: 'id' },
  { table: 'cities', column: 'city_name' },
  { table: 'boarding_points', column: 'id' },
  { table: 'boarding_points', column: 'pickup_at' },
  { table: 'Trip', column: 'id' },
  { table: 'Trip', column: 'departureAt' },
];

describe('physical schema map', () => {
  it('normalises an identifier down to its letters and digits', () => {
    expect(normaliseIdentifier('departure_at')).toBe('departureat');
    expect(normaliseIdentifier('departureAt')).toBe('departureat');
    expect(normaliseIdentifier('Trip')).toBe('trip');
  });

  it('offers the singular of a plural table name', () => {
    expect(identifierAliases('cities')).toContain('city');
    expect(identifierAliases('buses')).toContain('bus');
    expect(identifierAliases('trips')).toContain('trip');
    expect(identifierAliases('boarding_points')).toContain('boardingpoint');
  });

  it('finds a table by either its own name or its singular', () => {
    const map = buildSchemaMap(ROWS);
    expect(findTable(map, ['city'])?.name).toBe('cities');
    expect(findTable(map, ['boardingPoint'])?.name).toBe('boarding_points');
    expect(findTable(map, ['trip'])?.name).toBe('Trip');
    expect(findTable(map, ['passenger'])).toBeNull();
  });

  it('finds a column whatever case or underscores it uses', () => {
    const trips = requireTable(buildSchemaMap(ROWS), ['trip'], 'trips');
    expect(requireColumn(trips, ['departureAt'], 'the trip departure')).toBe('departureAt');
    const cities = requireTable(buildSchemaMap(ROWS), ['city'], 'cities');
    expect(findColumn(cities, ['name', 'cityName'])).toBe('city_name');
    expect(findColumn(cities, ['nickname'])).toBeNull();
  });

  it('says exactly what is missing', () => {
    const map = buildSchemaMap(ROWS);
    expect(() => requireTable(map, ['passenger'], 'passengers')).toThrow(
      'Bus Booking App catalogue: no table found for passengers (looked for passenger).',
    );
    const cities = requireTable(map, ['city'], 'cities');
    expect(() => requireColumn(cities, ['nickname'], 'the city nickname')).toThrow(
      'Bus Booking App catalogue: table "cities" has no column for the city nickname (looked for nickname).',
    );
  });

  it('quotes an identifier so a reserved word is still usable', () => {
    expect(quoteIdentifier('column')).toBe('"column"');
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"');
  });
});
