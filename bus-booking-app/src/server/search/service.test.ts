import { describe, expect, it } from 'vitest';
import type {
  City,
  TripDetail,
  TripRepository,
  TripSearchParams,
  TripSummary,
} from '../../models/catalogue/index.js';
import { MESSAGES } from '../../messages/index.js';
import { createSearchService, onlyUpcoming } from './service.js';

/** 12 June 2024, 09:30 IST. */
const NOW = new Date('2024-06-12T04:00:00.000Z');

const PUNE: City = { id: 'city-pune', name: 'Pune' };
const MUMBAI: City = { id: 'city-mumbai', name: 'Mumbai' };

function trip(id: string, departureAt: string, seatsLeft = 12): TripSummary {
  return {
    id,
    busName: `Shree Travels ${id}`,
    busType: 'AC_SLEEPER',
    fromCity: PUNE,
    toCity: MUMBAI,
    departureAt,
    arrivalAt: '2024-06-13T00:30:00.000Z',
    farePerSeat: 600,
    seatsLeft,
    totalSeats: 36,
  };
}

interface FakeRepository extends TripRepository {
  readonly calls: TripSearchParams[];
}

function fakeRepository(trips: readonly TripSummary[], cities: readonly City[] = [PUNE, MUMBAI]): FakeRepository {
  const calls: TripSearchParams[] = [];
  return {
    calls,
    async listCities(): Promise<City[]> {
      return [...cities];
    },
    async search(params: TripSearchParams): Promise<TripSummary[]> {
      calls.push(params);
      return [...trips];
    },
    async listUpcoming(): Promise<TripSummary[]> {
      return [...trips];
    },
    async findDetail(_tripId: string): Promise<TripDetail | null> {
      return null;
    },
  };
}

describe('onlyUpcoming', () => {
  it('drops the buses that have already departed and orders the rest earliest first', () => {
    const departed = trip('trip-gone', '2024-06-12T03:00:00.000Z');
    const soon = trip('trip-soon', '2024-06-12T05:00:00.000Z');
    const later = trip('trip-later', '2024-06-12T14:00:00.000Z');

    const result = onlyUpcoming([later, departed, soon], NOW);

    expect(result.map((entry) => entry.id)).toEqual(['trip-soon', 'trip-later']);
  });

  it('treats a bus leaving exactly now as departed', () => {
    const leavingNow = trip('trip-now', NOW.toISOString());
    expect(onlyUpcoming([leavingNow], NOW)).toEqual([]);
  });
});

describe('createSearchService.listCities', () => {
  it('returns the catalogue city list for the From/To pickers', async () => {
    const service = createSearchService({ trips: fakeRepository([]), now: () => NOW });
    await expect(service.listCities()).resolves.toEqual([PUNE, MUMBAI]);
  });
});

describe('createSearchService.searchTrips', () => {
  it('refuses identical From and To cities without reading the catalogue', async () => {
    const repository = fakeRepository([trip('trip-soon', '2024-06-12T05:00:00.000Z')]);
    const service = createSearchService({ trips: repository, now: () => NOW });

    const result = await service.searchTrips({ from: PUNE.id, to: PUNE.id, date: '2024-06-12' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('same_city');
    expect(result.failure.message).toBe(MESSAGES.sameCity);
    expect(repository.calls).toEqual([]);
  });

  it('refuses a date outside today..today+30 without reading the catalogue', async () => {
    const repository = fakeRepository([]);
    const service = createSearchService({ trips: repository, now: () => NOW });

    const result = await service.searchTrips({ from: PUNE.id, to: MUMBAI.id, date: '2024-07-13' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('date_out_of_range');
    expect(repository.calls).toEqual([]);
  });

  it('asks the catalogue for the route, the day and the moment of the search', async () => {
    const repository = fakeRepository([]);
    const service = createSearchService({ trips: repository, now: () => NOW });

    const result = await service.searchTrips({ from: ` ${PUNE.id} `, to: MUMBAI.id, date: '2024-06-12' });

    expect(result.ok).toBe(true);
    expect(repository.calls).toEqual([
      { fromCityId: PUNE.id, toCityId: MUMBAI.id, date: '2024-06-12', now: NOW },
    ]);
  });

  it('never offers a bus that has already departed, earliest departure first', async () => {
    const repository = fakeRepository([
      trip('trip-late', '2024-06-12T16:00:00.000Z'),
      trip('trip-departed', '2024-06-12T02:30:00.000Z'),
      trip('trip-next', '2024-06-12T04:30:00.000Z'),
    ]);
    const service = createSearchService({ trips: repository, now: () => NOW });

    const result = await service.searchTrips({ from: PUNE.id, to: MUMBAI.id, date: '2024-06-12' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trips.map((entry) => entry.id)).toEqual(['trip-next', 'trip-late']);
  });

  it('keeps a sold-out bus in the results so the screen can mark it', async () => {
    const repository = fakeRepository([trip('trip-full', '2024-06-12T05:00:00.000Z', 0)]);
    const service = createSearchService({ trips: repository, now: () => NOW });

    const result = await service.searchTrips({ from: PUNE.id, to: MUMBAI.id, date: '2024-06-12' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0]?.seatsLeft).toBe(0);
  });

  it('returns an empty list when the route has nothing on that day', async () => {
    const service = createSearchService({ trips: fakeRepository([]), now: () => NOW });

    const result = await service.searchTrips({ from: PUNE.id, to: MUMBAI.id, date: '2024-06-20' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trips).toEqual([]);
  });
});
