import { describe, expect, it } from 'vitest';
import { DEFAULT_BUS_TYPE } from '../../../models/catalogue/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import {
  MY_BOOKINGS_TABS,
  bookingTitle,
  isUpcomingBooking,
  normaliseMyBookings,
  partitionBookings,
  passengerNamesLabel,
  seatListLabel,
  statusBadgeClass,
  statusLabel,
  tabFromSearch,
  ticketPathFor,
} from './my-bookings-list.js';

const NOW_MS = Date.parse('2024-06-10T06:00:00.000Z');

function booking(overrides: Partial<BookingRecord> & { id: string }): BookingRecord {
  return {
    userId: 'traveller-a',
    tripId: 'trip-a',
    busName: 'Deccan Express',
    busType: DEFAULT_BUS_TYPE,
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: '2024-06-12T16:00:00.000Z',
    arrivalAt: '2024-06-12T20:00:00.000Z',
    boardingPointName: 'Dadar',
    seatNumbers: ['A1'],
    passengers: [{ seatNumber: 'A1', name: 'Asha Patil', age: 31, gender: 'FEMALE' }],
    farePerSeat: 600,
    totalFare: 600,
    status: 'BOOKED',
    canCancel: true,
    createdAt: '2024-06-01T05:00:00.000Z',
    cancelledAt: null,
    ...overrides,
    id: overrides.id,
  };
}

describe('my bookings tabs', () => {
  it('names the two tabs exactly as the design does', () => {
    expect(MY_BOOKINGS_TABS.map((tab) => tab.label)).toEqual(['Upcoming', 'Past & cancelled']);
  });

  it('reads the tab asked for in the URL, defaulting to Upcoming', () => {
    expect(tabFromSearch('?tab=past')).toBe('past');
    expect(tabFromSearch('?tab=upcoming')).toBe('upcoming');
    expect(tabFromSearch('')).toBe('upcoming');
    expect(tabFromSearch('?tab=anything-else')).toBe('upcoming');
  });
});

describe('the tab split', () => {
  it('keeps a bus that has not departed under Upcoming', () => {
    const future = booking({ id: 'BB-10452', departureAt: '2024-06-12T16:00:00.000Z' });
    expect(isUpcomingBooking(future, NOW_MS)).toBe(true);
  });

  it('moves a departed bus to Past & cancelled', () => {
    const departed = booking({
      id: 'BB-10400',
      departureAt: '2024-06-01T16:00:00.000Z',
      arrivalAt: '2024-06-01T20:00:00.000Z',
      status: 'COMPLETED',
    });
    expect(isUpcomingBooking(departed, NOW_MS)).toBe(false);
  });

  it('moves a cancelled booking to Past & cancelled even when its bus has not left', () => {
    const cancelled = booking({
      id: 'BB-10460',
      departureAt: '2024-06-20T16:00:00.000Z',
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2024-06-09T10:00:00.000Z',
    });
    expect(isUpcomingBooking(cancelled, NOW_MS)).toBe(false);

    const split = partitionBookings([cancelled], NOW_MS);
    expect(split.upcoming).toHaveLength(0);
    expect(split.past.map((entry) => entry.id)).toEqual(['BB-10460']);
  });

  it('sorts Upcoming by soonest departure first', () => {
    const later = booking({ id: 'BB-10470', departureAt: '2024-06-20T16:00:00.000Z' });
    const sooner = booking({ id: 'BB-10455', departureAt: '2024-06-11T00:45:00.000Z' });
    const middle = booking({ id: 'BB-10452', departureAt: '2024-06-12T16:00:00.000Z' });

    const split = partitionBookings([later, sooner, middle], NOW_MS);
    expect(split.upcoming.map((entry) => entry.id)).toEqual(['BB-10455', 'BB-10452', 'BB-10470']);
  });

  it('sorts Past & cancelled newest first, cancellations by when they were cancelled', () => {
    const oldTrip = booking({
      id: 'BB-10300',
      departureAt: '2024-05-01T16:00:00.000Z',
      arrivalAt: '2024-05-01T20:00:00.000Z',
      status: 'COMPLETED',
    });
    const recentTrip = booking({
      id: 'BB-10400',
      departureAt: '2024-06-08T16:00:00.000Z',
      arrivalAt: '2024-06-08T20:00:00.000Z',
      status: 'COMPLETED',
    });
    const cancelledYesterday = booking({
      id: 'BB-10460',
      departureAt: '2024-06-20T16:00:00.000Z',
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: '2024-06-09T10:00:00.000Z',
    });

    const split = partitionBookings([oldTrip, cancelledYesterday, recentTrip], NOW_MS);
    expect(split.past.map((entry) => entry.id)).toEqual(['BB-10460', 'BB-10400', 'BB-10300']);
  });
});

describe('normalising what the API returned', () => {
  it('re-partitions the server split against the moment of the read', () => {
    const stale = booking({
      id: 'BB-10405',
      departureAt: '2024-06-09T16:00:00.000Z',
      arrivalAt: '2024-06-09T20:00:00.000Z',
    });
    const future = booking({ id: 'BB-10452', departureAt: '2024-06-12T16:00:00.000Z' });

    const split = normaliseMyBookings({ upcoming: [stale, future], past: [] }, NOW_MS);
    expect(split.upcoming.map((entry) => entry.id)).toEqual(['BB-10452']);
    expect(split.past.map((entry) => entry.id)).toEqual(['BB-10405']);
  });

  it('accepts a flat list and ignores anything that is not a booking', () => {
    const future = booking({ id: 'BB-10452' });
    const split = normaliseMyBookings([future, { nonsense: true }, null], NOW_MS);
    expect(split.upcoming.map((entry) => entry.id)).toEqual(['BB-10452']);
    expect(split.past).toHaveLength(0);
  });

  it('treats an unusable payload as no bookings at all', () => {
    const split = normaliseMyBookings('nothing useful', NOW_MS);
    expect(split.upcoming).toHaveLength(0);
    expect(split.past).toHaveLength(0);
  });
});

describe('row wording', () => {
  it('states the booking reference and the route', () => {
    expect(bookingTitle(booking({ id: 'BB-10452' }))).toBe('BB-10452 · Pune – Mumbai');
  });

  it('names one seat singular and several plural', () => {
    expect(seatListLabel(['B3'])).toBe('Seat B3');
    expect(seatListLabel(['A1', 'A2'])).toBe('Seats A1, A2');
    expect(seatListLabel([])).toBe('No seats');
  });

  it('lists the passengers by name', () => {
    const twoSeats = booking({
      id: 'BB-10452',
      seatNumbers: ['A1', 'A2'],
      passengers: [
        { seatNumber: 'A1', name: 'Ramesh Kulkarni', age: 42, gender: 'MALE' },
        { seatNumber: 'A2', name: 'Sita Kulkarni', age: 38, gender: 'FEMALE' },
      ],
    });
    expect(passengerNamesLabel(twoSeats.passengers)).toBe('Ramesh Kulkarni, Sita Kulkarni');
  });

  it('labels every status in words and marks it with a class', () => {
    expect(statusLabel('BOOKED')).toBe('Booked');
    expect(statusLabel('CANCELLED')).toBe('Cancelled');
    expect(statusLabel('COMPLETED')).toBe('Completed');
    expect(statusBadgeClass('CANCELLED')).toContain('is-cancelled');
  });

  it("links a row through to that booking's ticket", () => {
    expect(ticketPathFor('BB-10452')).toBe('/bookings/BB-10452');
  });
});
