import { describe, expect, it } from 'vitest';
import {
  CITIES_PATH,
  formatTravelDate,
  isCompleteQuery,
  parseResultsQuery,
  tripsRequestPath,
} from './results-query.js';

describe('search results address', () => {
  it('reads the route and the travel day from the query string', () => {
    const query = parseResultsQuery('?from=city-mumbai&to=city-pune&date=2024-05-20');
    expect(query.fromCityId).toBe('city-mumbai');
    expect(query.toCityId).toBe('city-pune');
    expect(query.date).toBe('2024-05-20');
  });

  it('tolerates a query string without its leading question mark', () => {
    const query = parseResultsQuery('from=city-mumbai&to=city-pune&date=2024-05-20');
    expect(query.toCityId).toBe('city-pune');
  });

  it('treats missing values as empty rather than as undefined', () => {
    const query = parseResultsQuery('');
    expect(query.fromCityId).toBe('');
    expect(query.toCityId).toBe('');
    expect(query.date).toBe('');
  });

  it('is complete only with both cities and a real calendar day', () => {
    expect(isCompleteQuery({ fromCityId: 'a', toCityId: 'b', date: '2024-05-20' })).toBe(true);
    expect(isCompleteQuery({ fromCityId: '', toCityId: 'b', date: '2024-05-20' })).toBe(false);
    expect(isCompleteQuery({ fromCityId: 'a', toCityId: '', date: '2024-05-20' })).toBe(false);
    expect(isCompleteQuery({ fromCityId: 'a', toCityId: 'b', date: '20/05/2024' })).toBe(false);
    expect(isCompleteQuery({ fromCityId: 'a', toCityId: 'b', date: '' })).toBe(false);
  });

  it('builds the bus search request the API answers', () => {
    const path = tripsRequestPath({ fromCityId: 'city-mumbai', toCityId: 'city-pune', date: '2024-05-20' });
    expect(path).toBe('/trips?from=city-mumbai&to=city-pune&date=2024-05-20');
    expect(CITIES_PATH).toBe('/cities');
  });

  it('writes the travel day as DD/MM/YYYY and nothing at all when there is none', () => {
    expect(formatTravelDate('2024-05-20')).toBe('20/05/2024');
    expect(formatTravelDate('')).toBe('');
    expect(formatTravelDate('not-a-date')).toBe('');
  });
});
