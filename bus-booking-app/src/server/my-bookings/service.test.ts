import { describe, expect, it } from 'vitest';
import type { BookingRecord } from '../../models/bookings/index.js';
import { createMyBookingsService, type MyBookingsStore } from './service.js';

const NOW = new Date('2024-06-10T06:00:00.000Z');

const BASE: BookingRecord = {
  id: 'BB-40001',
  userId: 'user-asha',
  tripId: 'trip-pune-mumbai',
  busName: 'Sahyadri Travels',
  busType: 'AC_SLEEPER',
  fromCityName: 'Pune',
  toCityName: 'Mumbai',
  departureAt: '2024-06-12T03:30:00.000Z',
  arrivalAt: '2024-06-12T07:30:00.000Z',
  boardingPointName: 'Shivajinagar',
  seatNumbers: ['A1', 'A2'],
  passengers: [
    { seatNumber: 'A1', name: 'Asha Rao', age: 32, gender: 'FEMALE' },
    { seatNumber: 'A2', name: 'Vikram Rao', age: 35, gender: 'MALE' },
  ],
  farePerSeat: 650,
  totalFare: 1300,
  status: 'BOOKED',
  canCancel: true,
  createdAt: '2024-06-01T05:00:00.000Z',
  cancelledAt: null,
};

function booking(overrides: Partial<BookingRecord>): BookingRecord {
  return { ...BASE, ...overrides };
}

/** The booking data layer's read surface, in memory: a booking belongs to exactly one account. */
function storeOf(rows: readonly BookingRecord[]): MyBookingsStore {
  return {
    async listByUser(userId: string): Promise<BookingRecord[]> {
      return rows.filter((row: BookingRecord) => row.userId === userId);
    },
    async findByIdForUser(bookingId: string, userId: string): Promise<BookingRecord | null> {
      const match = rows.find((row: BookingRecord) => row.id === bookingId && row.userId === userId);
      return match ?? null;
    },
  };
}

const ashaUpcoming = booking({ id: 'BB-40001', departureAt: '2024-06-12T03:30:00.000Z' });
const ashaSoonest = booking({ id: 'BB-40002', departureAt: '2024-06-11T01:00:00.000Z' });
const ashaCompleted = booking({
  id: 'BB-40003',
  departureAt: '2024-06-02T03:30:00.000Z',
  arrivalAt: '2024-06-02T07:30:00.000Z',
  status: 'COMPLETED',
  canCancel: false,
});
const ashaCancelled = booking({
  id: 'BB-40004',
  departureAt: '2024-06-18T03:30:00.000Z',
  arrivalAt: '2024-06-18T07:30:00.000Z',
  status: 'CANCELLED',
  canCancel: false,
  cancelledAt: '2024-06-07T04:00:00.000Z',
});
const priyaUpcoming = booking({
  id: 'BB-40005',
  userId: 'user-priya',
  departureAt: '2024-06-13T03:30:00.000Z',
  passengers: [{ seatNumber: 'B4', name: 'Priya Nair', age: 29, gender: 'FEMALE' }],
  seatNumbers: ['B4'],
  farePerSeat: 650,
  totalFare: 650,
});

const ALL: readonly BookingRecord[] = [ashaUpcoming, ashaSoonest, ashaCompleted, ashaCancelled, priyaUpcoming];

describe('createMyBookingsService.list', () => {
  it('splits the traveller’s own bookings into upcoming and past & cancelled', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    const result = await service.list('user-asha');
    expect(result.upcoming.map((entry: BookingRecord) => entry.id)).toEqual(['BB-40002', 'BB-40001']);
    expect(result.past.map((entry: BookingRecord) => entry.id)).toEqual(['BB-40004', 'BB-40003']);
  });

  it('never includes another traveller’s booking', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    const result = await service.list('user-asha');
    const ids = [...result.upcoming, ...result.past].map((entry: BookingRecord) => entry.id);
    expect(ids).not.toContain('BB-40005');
  });

  it('returns two empty tabs for an account with no bookings', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    expect(await service.list('user-nobody')).toEqual({ upcoming: [], past: [] });
  });

  it('reads the clock once per call so the split follows time', async () => {
    const later = new Date('2024-06-15T06:00:00.000Z');
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => later });
    const result = await service.list('user-asha');
    expect(result.upcoming).toEqual([]);
    expect(result.past.map((entry: BookingRecord) => entry.id)).toEqual(['BB-40004', 'BB-40001', 'BB-40002', 'BB-40003']);
  });
});

describe('createMyBookingsService.ticket', () => {
  it('returns the traveller’s own booking in full', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    const outcome = await service.ticket('BB-40001', 'user-asha');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.booking.boardingPointName).toBe('Shivajinagar');
      expect(outcome.booking.seatNumbers).toEqual(['A1', 'A2']);
      expect(outcome.booking.passengers.map((passenger) => passenger.name)).toEqual(['Asha Rao', 'Vikram Rao']);
      expect(outcome.booking.totalFare).toBe(1300);
    }
  });

  it('does not find another traveller’s booking id (the router answers 404)', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    expect(await service.ticket('BB-40005', 'user-asha')).toEqual({ ok: false, code: 'not_found' });
  });

  it('does not find an unknown booking id', async () => {
    const service = createMyBookingsService({ bookings: storeOf(ALL), now: () => NOW });
    expect(await service.ticket('BB-99999', 'user-asha')).toEqual({ ok: false, code: 'not_found' });
  });
});
