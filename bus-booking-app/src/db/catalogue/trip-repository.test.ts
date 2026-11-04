import { describe, expect, it } from 'vitest';
import { createTripRepository } from './trip-repository.js';
import type {
  BoardingPointRow,
  CatalogueDataSource,
  CityRow,
  SeatRow,
  TripRow,
  TripSearchQuery,
} from './source.js';

const PUNE: CityRow = { id: 'city-pune', name: 'Pune' };
const MUMBAI: CityRow = { id: 'city-mumbai', name: 'Mumbai' };
const NASHIK: CityRow = { id: 'city-nashik', name: 'Nashik' };

/** 12 June 2024 in India time runs from 18:30Z on 11 June to 18:30Z on 12 June. */
const TRAVEL_DAY = '2024-06-12';

interface TripOptions {
  readonly id: string;
  readonly departureAt: string;
  readonly arrivalAt?: string;
  readonly busName?: string;
  readonly busType?: string;
  readonly farePerSeat?: number;
  readonly from?: CityRow;
  readonly to?: CityRow;
}

function makeTrip(options: TripOptions): TripRow {
  const departureAt = new Date(options.departureAt);
  return {
    id: options.id,
    busName: options.busName ?? 'Shree Travels',
    busType: options.busType ?? 'AC Sleeper',
    fromCity: options.from ?? PUNE,
    toCity: options.to ?? MUMBAI,
    departureAt,
    arrivalAt: options.arrivalAt === undefined ? new Date(departureAt.getTime() + 7_200_000) : new Date(options.arrivalAt),
    farePerSeat: options.farePerSeat ?? 600,
  };
}

function makeSeats(tripId: string, rows: number, columns: number, booked: readonly string[] = []): SeatRow[] {
  const seats: SeatRow[] = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const number = `${String.fromCharCode(64 + row)}${column}`;
      seats.push({ tripId, number, row, column, isBooked: booked.includes(number) });
    }
  }
  return seats;
}

interface FakeCatalogue {
  readonly source: CatalogueDataSource;
  readonly seatCalls: string[][];
}

function createFakeSource(data: {
  readonly cities?: readonly CityRow[];
  readonly trips?: readonly TripRow[];
  readonly seats?: readonly SeatRow[];
  readonly boardingPoints?: Readonly<Record<string, readonly BoardingPointRow[]>>;
}): FakeCatalogue {
  const cities = data.cities ?? [];
  const trips = data.trips ?? [];
  const seats = data.seats ?? [];
  const boardingPoints = data.boardingPoints ?? {};
  const seatCalls: string[][] = [];

  const source: CatalogueDataSource = {
    async listCities(): Promise<CityRow[]> {
      return cities.map((city) => ({ id: city.id, name: city.name }));
    },
    async listTrips(query: TripSearchQuery): Promise<TripRow[]> {
      return trips.filter((trip) => trip.fromCity.id === query.fromCityId && trip.toCity.id === query.toCityId);
    },
    async findTrip(tripId: string): Promise<TripRow | null> {
      return trips.find((trip) => trip.id === tripId) ?? null;
    },
    async listSeats(tripIds: readonly string[]): Promise<SeatRow[]> {
      seatCalls.push([...tripIds]);
      return seats.filter((seat) => tripIds.includes(seat.tripId));
    },
    async listBoardingPoints(tripId: string): Promise<BoardingPointRow[]> {
      return [...(boardingPoints[tripId] ?? [])];
    },
  };

  return { source, seatCalls };
}

describe('tripRepository.listCities', () => {
  it('lists every city by name', async () => {
    const { source } = createFakeSource({ cities: [MUMBAI, NASHIK, PUNE] });
    const repository = createTripRepository(source);

    await expect(repository.listCities()).resolves.toEqual([
      { id: 'city-mumbai', name: 'Mumbai' },
      { id: 'city-nashik', name: 'Nashik' },
      { id: 'city-pune', name: 'Pune' },
    ]);
  });
});

describe('tripRepository.search', () => {
  it('leaves out a trip that has already departed and keeps the ones still to come', async () => {
    const departed = makeTrip({ id: 'trip-departed', departureAt: '2024-06-12T08:00:00.000Z' });
    const soon = makeTrip({ id: 'trip-soon', departureAt: '2024-06-12T12:00:00.000Z' });
    const later = makeTrip({ id: 'trip-later', departureAt: '2024-06-12T16:00:00.000Z' });
    const { source } = createFakeSource({
      trips: [later, departed, soon],
      seats: [
        ...makeSeats('trip-departed', 2, 2),
        ...makeSeats('trip-soon', 2, 2),
        ...makeSeats('trip-later', 2, 2),
      ],
    });

    const found = await createTripRepository(source).search({
      fromCityId: PUNE.id,
      toCityId: MUMBAI.id,
      date: TRAVEL_DAY,
      now: new Date('2024-06-12T10:00:00.000Z'),
    });

    expect(found.map((trip) => trip.id)).toEqual(['trip-soon', 'trip-later']);
  });

  it('leaves out a trip on another India-time calendar day', async () => {
    const sameDay = makeTrip({ id: 'trip-same-day', departureAt: '2024-06-12T16:00:00.000Z' });
    const justAfterMidnight = makeTrip({ id: 'trip-next-day', departureAt: '2024-06-12T19:00:00.000Z' });
    const { source } = createFakeSource({
      trips: [sameDay, justAfterMidnight],
      seats: [...makeSeats('trip-same-day', 1, 2), ...makeSeats('trip-next-day', 1, 2)],
    });

    const found = await createTripRepository(source).search({
      fromCityId: PUNE.id,
      toCityId: MUMBAI.id,
      date: TRAVEL_DAY,
      now: new Date('2024-06-12T06:00:00.000Z'),
    });

    expect(found.map((trip) => trip.id)).toEqual(['trip-same-day']);
  });

  it('counts the seats left from the booked seats, and reports zero for a sold-out trip', async () => {
    const open = makeTrip({ id: 'trip-open', departureAt: '2024-06-12T13:00:00.000Z' });
    const soldOut = makeTrip({ id: 'trip-sold-out', departureAt: '2024-06-12T15:00:00.000Z' });
    const soldOutSeats = makeSeats('trip-sold-out', 2, 2).map((seat) => ({ ...seat, isBooked: true }));
    const { source } = createFakeSource({
      trips: [open, soldOut],
      seats: [...makeSeats('trip-open', 2, 2, ['A1', 'B2']), ...soldOutSeats],
    });

    const found = await createTripRepository(source).search({
      fromCityId: PUNE.id,
      toCityId: MUMBAI.id,
      date: TRAVEL_DAY,
      now: new Date('2024-06-12T06:00:00.000Z'),
    });

    expect(found[0]).toMatchObject({ id: 'trip-open', seatsLeft: 2, totalSeats: 4 });
    expect(found[1]).toMatchObject({ id: 'trip-sold-out', seatsLeft: 0, totalSeats: 4 });
  });

  it('states each trip the way the API does', async () => {
    const trip = makeTrip({
      id: 'trip-pune-mumbai',
      departureAt: '2024-06-12T16:00:00.000Z',
      arrivalAt: '2024-06-12T23:30:00.000Z',
      busName: 'Shree Travels',
      busType: 'AC Sleeper',
      farePerSeat: 600,
    });
    const { source } = createFakeSource({ trips: [trip], seats: makeSeats('trip-pune-mumbai', 1, 3, ['A3']) });

    const found = await createTripRepository(source).search({
      fromCityId: PUNE.id,
      toCityId: MUMBAI.id,
      date: TRAVEL_DAY,
      now: new Date('2024-06-12T06:00:00.000Z'),
    });

    expect(found).toEqual([
      {
        id: 'trip-pune-mumbai',
        busName: 'Shree Travels',
        busType: 'AC_SLEEPER',
        fromCity: { id: 'city-pune', name: 'Pune' },
        toCity: { id: 'city-mumbai', name: 'Mumbai' },
        departureAt: '2024-06-12T16:00:00.000Z',
        arrivalAt: '2024-06-12T23:30:00.000Z',
        farePerSeat: 600,
        seatsLeft: 2,
        totalSeats: 3,
      },
    ]);
  });

  it('asks for no seats at all when the route has nothing on offer that day', async () => {
    const { source, seatCalls } = createFakeSource({
      trips: [makeTrip({ id: 'trip-departed', departureAt: '2024-06-12T04:00:00.000Z' })],
      seats: makeSeats('trip-departed', 1, 2),
    });

    const found = await createTripRepository(source).search({
      fromCityId: PUNE.id,
      toCityId: MUMBAI.id,
      date: TRAVEL_DAY,
      now: new Date('2024-06-12T10:00:00.000Z'),
    });

    expect(found).toEqual([]);
    expect(seatCalls).toEqual([]);
  });

  it('finds nothing when the date is not a real calendar day', async () => {
    const { source } = createFakeSource({
      trips: [makeTrip({ id: 'trip-open', departureAt: '2024-06-12T16:00:00.000Z' })],
    });

    await expect(
      createTripRepository(source).search({
        fromCityId: PUNE.id,
        toCityId: MUMBAI.id,
        date: '12/06/2024',
        now: new Date('2024-06-12T06:00:00.000Z'),
      }),
    ).resolves.toEqual([]);
  });
});

describe('tripRepository.findDetail', () => {
  it('returns the seat map in layout order with the booked seats flagged', async () => {
    const trip = makeTrip({ id: 'trip-pune-mumbai', departureAt: '2024-06-12T16:00:00.000Z' });
    const shuffled: SeatRow[] = [
      { tripId: 'trip-pune-mumbai', number: 'B2', row: 2, column: 2, isBooked: false },
      { tripId: 'trip-pune-mumbai', number: 'A2', row: 1, column: 2, isBooked: true },
      { tripId: 'trip-pune-mumbai', number: 'B1', row: 2, column: 1, isBooked: false },
      { tripId: 'trip-pune-mumbai', number: 'A1', row: 1, column: 1, isBooked: false },
      { tripId: 'trip-other', number: 'A1', row: 1, column: 1, isBooked: true },
    ];
    const { source } = createFakeSource({ trips: [trip], seats: shuffled });

    const detail = await createTripRepository(source).findDetail('trip-pune-mumbai');

    expect(detail?.seats).toEqual([
      { number: 'A1', row: 1, column: 1, isBooked: false },
      { number: 'A2', row: 1, column: 2, isBooked: true },
      { number: 'B1', row: 2, column: 1, isBooked: false },
      { number: 'B2', row: 2, column: 2, isBooked: false },
    ]);
    expect(detail?.totalSeats).toBe(4);
    expect(detail?.seatsLeft).toBe(3);
  });

  it('reports zero seats left on a sold-out trip and still returns the whole map', async () => {
    const trip = makeTrip({ id: 'trip-sold-out', departureAt: '2024-06-12T16:00:00.000Z' });
    const seats = makeSeats('trip-sold-out', 2, 2).map((seat) => ({ ...seat, isBooked: true }));
    const { source } = createFakeSource({ trips: [trip], seats });

    const detail = await createTripRepository(source).findDetail('trip-sold-out');

    expect(detail?.seatsLeft).toBe(0);
    expect(detail?.seats).toHaveLength(4);
    expect(detail?.seats.every((seat) => seat.isBooked)).toBe(true);
  });

  it('carries the boarding points and their pickup times', async () => {
    const trip = makeTrip({ id: 'trip-pune-mumbai', departureAt: '2024-06-12T16:00:00.000Z' });
    const { source } = createFakeSource({
      trips: [trip],
      seats: makeSeats('trip-pune-mumbai', 1, 2),
      boardingPoints: {
        'trip-pune-mumbai': [
          { id: 'bp-dadar', name: 'Dadar, near TT Circle', pickupAt: '2024-06-12T15:30:00.000Z' },
          { id: 'bp-borivali', name: 'Borivali check naka', pickupAt: '2024-06-12T16:15:00.000Z' },
        ],
      },
    });

    const detail = await createTripRepository(source).findDetail('trip-pune-mumbai');

    expect(detail?.boardingPoints).toEqual([
      { id: 'bp-dadar', name: 'Dadar, near TT Circle', pickupAt: '2024-06-12T15:30:00.000Z' },
      { id: 'bp-borivali', name: 'Borivali check naka', pickupAt: '2024-06-12T16:15:00.000Z' },
    ]);
  });

  it('returns null for a trip that does not exist', async () => {
    const { source } = createFakeSource({ trips: [] });

    await expect(createTripRepository(source).findDetail('trip-missing')).resolves.toBeNull();
  });
});
