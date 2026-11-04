import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../../messages/index.js';
import { DEFAULT_BUS_TYPE, type City, type TripSummary } from '../../../models/catalogue/index.js';
import {
  arrivalDayNote,
  arrivalLabel,
  compareByDeparture,
  farePerSeatLabel,
  isSoldOut,
  isTripSummaryLike,
  resolveCityName,
  resultsCountLabel,
  routeLabel,
  seatsBadgeClass,
  seatsLeftLabel,
  toCityList,
  toTripList,
  upcomingEarliestFirst,
} from './results-order.js';

const MUMBAI: City = { id: 'city-mumbai', name: 'Mumbai' };
const PUNE: City = { id: 'city-pune', name: 'Pune' };

function tripFixture(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'trip-shree',
    busName: 'Shree Travels',
    busType: DEFAULT_BUS_TYPE,
    fromCity: MUMBAI,
    toCity: PUNE,
    departureAt: '2099-01-02T16:00:00.000Z',
    arrivalAt: '2099-01-02T23:30:00.000Z',
    farePerSeat: 850,
    seatsLeft: 18,
    totalSeats: 36,
    ...overrides,
  };
}

describe('results ordering', () => {
  it('lists the buses still to depart, earliest first', () => {
    const now = new Date('2024-05-20T00:00:00.000Z');
    const ordered = upcomingEarliestFirst(
      [
        tripFixture({ id: 'trip-late', busName: 'Sharma Yatra', departureAt: '2024-05-20T18:00:00.000Z' }),
        tripFixture({ id: 'trip-early', busName: 'Purple Express', departureAt: '2024-05-20T02:00:00.000Z' }),
        tripFixture({ id: 'trip-mid', busName: 'Neeta Travels', departureAt: '2024-05-20T06:00:00.000Z' }),
      ],
      now,
    );
    expect(ordered.map((trip) => trip.busName)).toEqual(['Purple Express', 'Neeta Travels', 'Sharma Yatra']);
  });

  it('drops a bus whose departure has already passed', () => {
    const now = new Date('2024-05-20T10:00:00.000Z');
    const ordered = upcomingEarliestFirst(
      [
        tripFixture({ id: 'trip-gone', busName: 'Morning Departed', departureAt: '2024-05-20T04:00:00.000Z' }),
        tripFixture({ id: 'trip-next', busName: 'Evening Runner', departureAt: '2024-05-20T14:00:00.000Z' }),
      ],
      now,
    );
    expect(ordered.map((trip) => trip.busName)).toEqual(['Evening Runner']);
  });

  it('keeps a sold-out bus in the list', () => {
    const now = new Date('2024-05-20T00:00:00.000Z');
    const ordered = upcomingEarliestFirst(
      [tripFixture({ seatsLeft: 0, departureAt: '2024-05-20T09:00:00.000Z' })],
      now,
    );
    expect(ordered).toHaveLength(1);
    expect(isSoldOut(ordered[0])).toBe(true);
  });

  it('breaks a tie on the bus name so the order never jumps about', () => {
    const left = tripFixture({ busName: 'Aarav Travels' });
    const right = tripFixture({ busName: 'Zenith Travels' });
    expect(compareByDeparture(left, right)).toBeLessThan(0);
    expect(compareByDeparture(right, left)).toBeGreaterThan(0);
  });
});

describe('results labels', () => {
  it('says Sold out for a full bus and counts the seats otherwise', () => {
    expect(seatsLeftLabel(0)).toBe(MESSAGES.soldOut);
    expect(seatsLeftLabel(1)).toBe('1 seat left');
    expect(seatsLeftLabel(18)).toBe('18 seats left');
  });

  it('badges a full bus, a nearly full bus and a free bus differently', () => {
    expect(seatsBadgeClass(0)).toContain('badge-danger');
    expect(seatsBadgeClass(4)).toContain('badge-warning');
    expect(seatsBadgeClass(18)).toContain('badge-success');
  });

  it('writes the fare per seat in whole rupees', () => {
    expect(farePerSeatLabel(850)).toMatch(/850 \/ seat$/);
  });

  it('notes an overnight arrival and stays silent on a same-day arrival', () => {
    expect(arrivalDayNote('2024-05-20T16:00:00.000Z', '2024-05-20T23:30:00.000Z')).toBe('+1 day');
    expect(arrivalDayNote('2024-05-20T01:30:00.000Z', '2024-05-20T06:00:00.000Z')).toBe('');
  });

  it('puts the arrival note after the arrival time', () => {
    const label = arrivalLabel(
      tripFixture({ departureAt: '2024-05-20T16:00:00.000Z', arrivalAt: '2024-05-20T23:30:00.000Z' }),
    );
    expect(label).toContain('+1 day');
    expect(label).toContain('5:00');
  });

  it('names the route only once both cities are known', () => {
    expect(routeLabel('Mumbai', 'Pune')).toBe('Mumbai → Pune');
    expect(routeLabel('', 'Pune')).toBe('');
    expect(routeLabel('Mumbai', '')).toBe('');
  });

  it('counts the results in words', () => {
    expect(resultsCountLabel(1)).toBe('1 bus found');
    expect(resultsCountLabel(6)).toBe('6 buses found');
  });
});

describe('results payloads', () => {
  it('names a city from the city list, then from the trips, and never shows an id', () => {
    expect(resolveCityName('city-pune', [MUMBAI, PUNE], [])).toBe('Pune');
    expect(resolveCityName('city-pune', [], [tripFixture()])).toBe('Pune');
    expect(resolveCityName('city-unknown', [], [tripFixture()])).toBe('');
    expect(resolveCityName('', [MUMBAI], [])).toBe('');
  });

  it('keeps only usable trips from a payload', () => {
    const payload: unknown = [tripFixture(), { id: 'broken' }, null, 'nonsense'];
    const trips = toTripList(payload);
    expect(trips).toHaveLength(1);
    expect(trips[0].busName).toBe('Shree Travels');
    expect(toTripList('not a list')).toEqual([]);
  });

  it('recognises a trip summary and rejects a partial one', () => {
    expect(isTripSummaryLike(tripFixture())).toBe(true);
    expect(isTripSummaryLike({ id: 'trip-shree', busName: 'Shree Travels' })).toBe(false);
  });

  it('keeps only usable cities from a payload', () => {
    expect(toCityList([MUMBAI, { id: 7 }, undefined])).toEqual([MUMBAI]);
    expect(toCityList(null)).toEqual([]);
  });
});
