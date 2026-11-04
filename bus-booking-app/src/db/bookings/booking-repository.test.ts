import { describe, expect, it } from 'vitest';
import {
  BookingNotCancellableError,
  BookingNotFoundError,
  BookingTripNotFoundError,
  type CreateBookingCommand,
  type PassengerInput,
} from '../../models/bookings/index.js';
import type { SeatInfo, TripDetail } from '../../models/catalogue/index.js';
import { createBookingRepository, randomBookingId } from './booking-repository.js';
import type {
  BookingDataSource,
  BookingRow,
  InsertBookingResult,
  NewBookingRow,
  TripReader,
} from './source.js';

/** The trip every booking in these specs is made on: Pune → Mumbai, ₹600 a seat. */
const DEPARTURE = '2024-06-12T16:00:00.000Z';
const ARRIVAL = '2024-06-12T21:00:00.000Z';

function seatMap(booked: readonly string[]): SeatInfo[] {
  return ['A1', 'A2', 'A3', 'A4'].map((number, index) => ({
    number,
    row: index + 1,
    column: 1,
    isBooked: booked.includes(number),
  }));
}

function tripDetail(booked: readonly string[] = []): TripDetail {
  return {
    id: 'trip-pune-mumbai',
    busName: 'Shree Travels',
    busType: 'AC_SLEEPER',
    fromCity: { id: 'city-pune', name: 'Pune' },
    toCity: { id: 'city-mumbai', name: 'Mumbai' },
    departureAt: DEPARTURE,
    arrivalAt: ARRIVAL,
    farePerSeat: 600,
    seatsLeft: 4 - booked.length,
    totalSeats: 4,
    seats: seatMap(booked),
    boardingPoints: [
      { id: 'bp-dadar', name: 'Dadar', pickupAt: '2024-06-12T16:30:00.000Z' },
      { id: 'bp-sion', name: 'Sion', pickupAt: '2024-06-12T16:50:00.000Z' },
    ],
  };
}

function tripReader(trip: TripDetail): TripReader {
  return {
    async findDetail(tripId: string): Promise<TripDetail | null> {
      return tripId === trip.id ? trip : null;
    },
  };
}

interface MemorySource extends BookingDataSource {
  readonly rows: Map<string, BookingRow>;
  readonly held: Map<string, string>;
}

/** The booking tables in memory: seats are held atomically, exactly as the transaction does. */
function createMemorySource(): MemorySource {
  const rows = new Map<string, BookingRow>();
  const held = new Map<string, string>();
  const key = (tripId: string, seatNumber: string): string => `${tripId}#${seatNumber}`;

  return {
    rows,
    held,

    async existsById(bookingId: string): Promise<boolean> {
      return rows.has(bookingId);
    },

    async insert(row: NewBookingRow): Promise<InsertBookingResult> {
      for (const passenger of row.passengers) {
        if (held.has(key(row.tripId, passenger.seatNumber))) {
          return { ok: false, conflictSeat: passenger.seatNumber };
        }
      }
      for (const passenger of row.passengers) held.set(key(row.tripId, passenger.seatNumber), row.id);
      const stored: BookingRow = {
        rowId: row.id,
        id: row.id,
        userId: row.userId,
        tripId: row.tripId,
        boardingPointId: row.boardingPointId,
        statusText: 'Booked',
        createdAt: row.createdAt,
        cancelledAt: null,
        passengers: row.passengers.map((passenger) => ({
          seatNumber: passenger.seatNumber,
          name: passenger.name,
          age: passenger.age,
          gender: passenger.gender,
        })),
      };
      rows.set(row.id, stored);
      return { ok: true, booking: stored };
    },

    async listByUser(userId: string): Promise<BookingRow[]> {
      return [...rows.values()].filter((row) => row.userId === userId);
    },

    async findByIdForUser(bookingId: string, userId: string): Promise<BookingRow | null> {
      const row = rows.get(bookingId);
      return row !== undefined && row.userId === userId ? row : null;
    },

    async markCancelled(bookingId: string, userId: string, cancelledAt: Date): Promise<BookingRow | null> {
      const row = rows.get(bookingId);
      if (row === undefined || row.userId !== userId) return null;
      const next: BookingRow = { ...row, statusText: 'Cancelled', cancelledAt };
      rows.set(bookingId, next);
      for (const [seatKey, owner] of [...held.entries()]) {
        if (owner === bookingId) held.delete(seatKey);
      }
      return next;
    },
  };
}

function passenger(seatNumber: string, name: string): PassengerInput {
  return { seatNumber, name, age: 34, gender: 'FEMALE' };
}

function command(seats: readonly PassengerInput[], userId = 'user-aisha'): CreateBookingCommand {
  return { userId, tripId: 'trip-pune-mumbai', boardingPointId: 'bp-sion', passengers: [...seats] };
}

function fixedIds(ids: readonly string[]): () => string {
  let index = 0;
  return (): string => {
    const id = ids[Math.min(index, ids.length - 1)] ?? 'BB-10000';
    index += 1;
    return id;
  };
}

const BOOKED_AT = new Date('2024-06-10T09:00:00.000Z');

describe('randomBookingId', () => {
  it('is the app prefix and five digits', () => {
    expect(randomBookingId(() => 0)).toMatch(/^BB-\d{5}$/);
    expect(randomBookingId(() => 0.999_99)).toMatch(/^BB-\d{5}$/);
  });
});

describe('bookingRepository.create', () => {
  it('persists the booking with its passengers, seats and total fare', async () => {
    const source = createMemorySource();
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => BOOKED_AT,
      newBookingId: fixedIds(['BB-10452']),
    });

    const result = await repository.create(command([passenger('A1', 'Aisha Kapoor'), passenger('A2', 'Ramesh Kulkarni')]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.id).toBe('BB-10452');
    expect(result.booking.seatNumbers).toEqual(['A1', 'A2']);
    expect(result.booking.farePerSeat).toBe(600);
    expect(result.booking.totalFare).toBe(1200);
    expect(result.booking.busName).toBe('Shree Travels');
    expect(result.booking.fromCityName).toBe('Pune');
    expect(result.booking.toCityName).toBe('Mumbai');
    expect(result.booking.boardingPointName).toBe('Sion');
    expect(result.booking.status).toBe('BOOKED');
    expect(result.booking.canCancel).toBe(true);
    expect(result.booking.passengers.map((entry) => entry.name)).toEqual(['Aisha Kapoor', 'Ramesh Kulkarni']);
  });

  it('refuses a seat the seat map already shows as taken', async () => {
    const repository = createBookingRepository({
      bookings: createMemorySource(),
      trips: tripReader(tripDetail(['A2'])),
      now: () => BOOKED_AT,
      newBookingId: fixedIds(['BB-10500']),
    });

    const result = await repository.create(command([passenger('A2', 'Nikhil Rao')]));

    expect(result).toEqual({ ok: false, conflictSeat: 'A2' });
  });

  it('lets only one of two concurrent bookings take the same seat', async () => {
    const source = createMemorySource();
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => BOOKED_AT,
      newBookingId: fixedIds(['BB-10601', 'BB-10602']),
    });

    const [first, second] = await Promise.all([
      repository.create(command([passenger('A1', 'Aisha Kapoor')], 'user-aisha')),
      repository.create(command([passenger('A1', 'Nikhil Rao')], 'user-nikhil')),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    const refused = outcomes.find((outcome) => !outcome.ok);
    expect(refused).toEqual({ ok: false, conflictSeat: 'A1' });
    expect(source.rows.size).toBe(1);
  });

  it('skips a booking reference that is already in use', async () => {
    const source = createMemorySource();
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => BOOKED_AT,
      newBookingId: fixedIds(['BB-10701', 'BB-10701', 'BB-10702']),
    });

    const first = await repository.create(command([passenger('A1', 'Aisha Kapoor')]));
    const second = await repository.create(command([passenger('A2', 'Ramesh Kulkarni')]));

    expect(first.ok && first.booking.id).toBe('BB-10701');
    expect(second.ok && second.booking.id).toBe('BB-10702');
  });

  it('refuses to book a trip the catalogue does not have', async () => {
    const repository = createBookingRepository({
      bookings: createMemorySource(),
      trips: tripReader(tripDetail()),
      now: () => BOOKED_AT,
    });

    await expect(
      repository.create({
        userId: 'user-aisha',
        tripId: 'trip-gone',
        boardingPointId: 'bp-sion',
        passengers: [passenger('A1', 'Aisha Kapoor')],
      }),
    ).rejects.toBeInstanceOf(BookingTripNotFoundError);
  });
});

describe('bookingRepository reads', () => {
  async function seeded(): Promise<{ source: MemorySource; repository: ReturnType<typeof createBookingRepository> }> {
    const source = createMemorySource();
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => BOOKED_AT,
      newBookingId: fixedIds(['BB-10801']),
    });
    await repository.create(command([passenger('A1', 'Aisha Kapoor')]));
    return { source, repository };
  }

  it('never shows one traveller the bookings of another', async () => {
    const { repository } = await seeded();
    const now = new Date('2024-06-12T10:00:00.000Z');

    expect(await repository.listByUser('user-aisha', now)).toHaveLength(1);
    expect(await repository.listByUser('user-nikhil', now)).toEqual([]);
    expect(await repository.findByIdForUser('BB-10801', 'user-nikhil', now)).toBeNull();
    expect(await repository.findByIdForUser('BB-99999', 'user-aisha', now)).toBeNull();
  });

  it('derives BOOKED and canCancel more than an hour before departure', async () => {
    const { repository } = await seeded();
    const record = await repository.findByIdForUser('BB-10801', 'user-aisha', new Date('2024-06-12T14:00:00.000Z'));
    expect(record?.status).toBe('BOOKED');
    expect(record?.canCancel).toBe(true);
  });

  it('drops canCancel at exactly one hour before departure', async () => {
    const { repository } = await seeded();
    const record = await repository.findByIdForUser('BB-10801', 'user-aisha', new Date('2024-06-12T15:00:00.000Z'));
    expect(record?.status).toBe('BOOKED');
    expect(record?.canCancel).toBe(false);
  });

  it('derives COMPLETED once the bus has arrived', async () => {
    const { repository } = await seeded();
    const record = await repository.findByIdForUser('BB-10801', 'user-aisha', new Date(ARRIVAL));
    expect(record?.status).toBe('COMPLETED');
    expect(record?.canCancel).toBe(false);
  });
});

describe('bookingRepository.cancel', () => {
  it('cancels the booking and frees its seats straight away', async () => {
    const source = createMemorySource();
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => new Date('2024-06-12T10:00:00.000Z'),
      newBookingId: fixedIds(['BB-10901', 'BB-10902']),
    });
    await repository.create(command([passenger('A1', 'Aisha Kapoor')]));
    expect(source.held.size).toBe(1);

    const cancelled = await repository.cancel('BB-10901', 'user-aisha');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.canCancel).toBe(false);
    expect(cancelled.cancelledAt).toBe('2024-06-12T10:00:00.000Z');
    expect(source.held.size).toBe(0);

    const reused = await repository.create(command([passenger('A1', 'Nikhil Rao')], 'user-nikhil'));
    expect(reused.ok).toBe(true);
  });

  it('refuses to cancel another traveller\'s booking', async () => {
    const repository = createBookingRepository({
      bookings: createMemorySource(),
      trips: tripReader(tripDetail()),
      now: () => new Date('2024-06-12T10:00:00.000Z'),
      newBookingId: fixedIds(['BB-11001']),
    });
    await repository.create(command([passenger('A1', 'Aisha Kapoor')]));

    await expect(repository.cancel('BB-11001', 'user-nikhil')).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it('refuses to cancel inside the last hour, keeping the seats held', async () => {
    const source = createMemorySource();
    let now = new Date('2024-06-12T10:00:00.000Z');
    const repository = createBookingRepository({
      bookings: source,
      trips: tripReader(tripDetail()),
      now: () => now,
      newBookingId: fixedIds(['BB-11101']),
    });
    await repository.create(command([passenger('A1', 'Aisha Kapoor')]));

    now = new Date('2024-06-12T15:30:00.000Z');
    await expect(repository.cancel('BB-11101', 'user-aisha')).rejects.toBeInstanceOf(BookingNotCancellableError);
    expect(source.held.size).toBe(1);
  });

  it('refuses to cancel a booking twice', async () => {
    const repository = createBookingRepository({
      bookings: createMemorySource(),
      trips: tripReader(tripDetail()),
      now: () => new Date('2024-06-12T10:00:00.000Z'),
      newBookingId: fixedIds(['BB-11201']),
    });
    await repository.create(command([passenger('A1', 'Aisha Kapoor')]));
    await repository.cancel('BB-11201', 'user-aisha');

    await expect(repository.cancel('BB-11201', 'user-aisha')).rejects.toBeInstanceOf(BookingNotCancellableError);
  });
});
