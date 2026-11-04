import { describe, expect, it } from 'vitest';
import type { BookingRecord } from '../../models/bookings/index.js';
import { compareNewestFirst, compareSoonestFirst, isUpcoming, splitBookings } from './split.js';

const NOW = new Date('2024-06-10T06:00:00.000Z');

const BASE: BookingRecord = {
  id: 'BB-10001',
  userId: 'user-asha',
  tripId: 'trip-pune-mumbai',
  busName: 'Sahyadri Travels',
  busType: 'AC_SEATER',
  fromCityName: 'Pune',
  toCityName: 'Mumbai',
  departureAt: '2024-06-12T03:30:00.000Z',
  arrivalAt: '2024-06-12T07:30:00.000Z',
  boardingPointName: 'Shivajinagar',
  seatNumbers: ['A1'],
  passengers: [{ seatNumber: 'A1', name: 'Asha Rao', age: 32, gender: 'FEMALE' }],
  farePerSeat: 650,
  totalFare: 650,
  status: 'BOOKED',
  canCancel: true,
  createdAt: '2024-06-01T05:00:00.000Z',
  cancelledAt: null,
};

function booking(overrides: Partial<BookingRecord>): BookingRecord {
  return { ...BASE, ...overrides };
}

describe('isUpcoming', () => {
  it('is true for a live booking whose bus has not departed', () => {
    expect(isUpcoming(booking({ departureAt: '2024-06-12T03:30:00.000Z' }), NOW)).toBe(true);
  });

  it('is false once the bus has departed', () => {
    const departed = booking({
      departureAt: '2024-06-09T03:30:00.000Z',
      arrivalAt: '2024-06-09T07:30:00.000Z',
      status: 'COMPLETED',
      canCancel: false,
    });
    expect(isUpcoming(departed, NOW)).toBe(false);
  });

  it('is false for a cancelled booking even when its bus is still ahead', () => {
    const cancelled = booking({
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2024-06-05T09:00:00.000Z',
    });
    expect(isUpcoming(cancelled, NOW)).toBe(false);
  });
});

describe('splitBookings', () => {
  const soon = booking({ id: 'BB-20001', departureAt: '2024-06-11T02:00:00.000Z', arrivalAt: '2024-06-11T06:00:00.000Z' });
  const later = booking({ id: 'BB-20002', departureAt: '2024-06-20T02:00:00.000Z', arrivalAt: '2024-06-20T06:00:00.000Z' });
  const completedOld = booking({
    id: 'BB-20003',
    departureAt: '2024-05-02T02:00:00.000Z',
    arrivalAt: '2024-05-02T06:00:00.000Z',
    status: 'COMPLETED',
    canCancel: false,
  });
  const completedRecent = booking({
    id: 'BB-20004',
    departureAt: '2024-06-08T02:00:00.000Z',
    arrivalAt: '2024-06-08T06:00:00.000Z',
    status: 'COMPLETED',
    canCancel: false,
  });
  const cancelledFuture = booking({
    id: 'BB-20005',
    departureAt: '2024-06-25T02:00:00.000Z',
    arrivalAt: '2024-06-25T06:00:00.000Z',
    status: 'CANCELLED',
    canCancel: false,
    cancelledAt: '2024-06-06T11:00:00.000Z',
  });

  it('puts buses that have not departed in upcoming, soonest departure first', () => {
    const split = splitBookings([later, soon, completedRecent, cancelledFuture], NOW);
    expect(split.upcoming.map((entry: BookingRecord) => entry.id)).toEqual(['BB-20001', 'BB-20002']);
  });

  it('puts departed buses and cancelled bookings in past, newest first', () => {
    const split = splitBookings([completedOld, soon, completedRecent, cancelledFuture], NOW);
    expect(split.past.map((entry: BookingRecord) => entry.id)).toEqual(['BB-20005', 'BB-20004', 'BB-20003']);
  });

  it('places every booking in exactly one of the two tabs', () => {
    const all = [later, soon, completedOld, completedRecent, cancelledFuture];
    const split = splitBookings(all, NOW);
    expect(split.upcoming.length + split.past.length).toBe(all.length);
    const ids = [...split.upcoming, ...split.past].map((entry: BookingRecord) => entry.id).sort();
    expect(ids).toEqual(['BB-20001', 'BB-20002', 'BB-20003', 'BB-20004', 'BB-20005']);
  });

  it('does not mutate the list it was given', () => {
    const all = [later, soon, completedOld];
    splitBookings(all, NOW);
    expect(all.map((entry: BookingRecord) => entry.id)).toEqual(['BB-20002', 'BB-20001', 'BB-20003']);
  });

  it('returns two empty tabs for an account with no bookings', () => {
    expect(splitBookings([], NOW)).toEqual({ upcoming: [], past: [] });
  });
});

describe('orderings', () => {
  it('settles an identical departure by booking time', () => {
    const older = booking({ id: 'BB-30001', createdAt: '2024-06-01T05:00:00.000Z' });
    const newer = booking({ id: 'BB-30002', createdAt: '2024-06-03T05:00:00.000Z' });
    expect(compareSoonestFirst(older, newer)).toBeLessThan(0);
    expect(compareNewestFirst(older, newer)).toBeGreaterThan(0);
  });
});
