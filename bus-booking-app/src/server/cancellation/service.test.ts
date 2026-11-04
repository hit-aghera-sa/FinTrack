import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import { CANCEL_CUTOFF_MS, type BookingRecord } from '../../models/bookings/index.js';
import {
  BOOKING_NOT_FOUND_MESSAGE,
  createCancellationService,
  httpStatusFor,
  isWithinCancelCutoff,
  msUntilDeparture,
  type CancellationBookingStore,
} from './service.js';

const MINUTE_MS = 60_000;
const NOW = new Date('2024-06-12T06:00:00.000Z');

function departureIn(minutes: number): string {
  return new Date(NOW.getTime() + minutes * MINUTE_MS).toISOString();
}

function bookingFixture(overrides: Partial<BookingRecord> = {}): BookingRecord {
  const base: BookingRecord = {
    id: 'BB-10452',
    userId: 'user-priya',
    tripId: 'trip-deccan',
    busName: 'Deccan Express',
    busType: 'AC_SEATER',
    fromCityName: 'Pune',
    toCityName: 'Mumbai',
    departureAt: departureIn(180),
    arrivalAt: departureIn(420),
    boardingPointName: 'Shivajinagar',
    seatNumbers: ['A1', 'A2'],
    passengers: [
      { seatNumber: 'A1', name: 'Priya Rao', age: 29, gender: 'FEMALE' },
      { seatNumber: 'A2', name: 'Alex QA', age: 31, gender: 'MALE' },
    ],
    farePerSeat: 600,
    totalFare: 1200,
    status: 'BOOKED',
    canCancel: true,
    createdAt: '2024-06-09T04:30:00.000Z',
    cancelledAt: null,
  };
  return { ...base, ...overrides };
}

/**
 * A booking store with a seat pool, so "the seats are freed immediately" is an observable fact of the
 * test rather than a comment: the seats a live booking holds are in `seatsHeld`, and the data layer's
 * cancel is the one thing that removes them.
 */
class FakeBookingStore implements CancellationBookingStore {
  readonly cancelCalls: Array<{ bookingId: string; userId: string }> = [];
  readonly seatsHeld: Set<string>;
  private booking: BookingRecord;

  constructor(booking: BookingRecord) {
    this.booking = booking;
    this.seatsHeld = new Set(booking.seatNumbers);
  }

  findByIdForUser(bookingId: string, userId: string, _now: Date): Promise<BookingRecord | null> {
    if (bookingId !== this.booking.id || userId !== this.booking.userId) return Promise.resolve(null);
    return Promise.resolve(this.booking);
  }

  cancel(bookingId: string, userId: string): Promise<BookingRecord> {
    this.cancelCalls.push({ bookingId, userId });
    for (const seat of this.booking.seatNumbers) this.seatsHeld.delete(seat);
    const cancelled: BookingRecord = {
      ...this.booking,
      status: 'CANCELLED',
      canCancel: false,
      cancelledAt: NOW.toISOString(),
    };
    this.booking = cancelled;
    return Promise.resolve(cancelled);
  }
}

function serviceFor(store: FakeBookingStore): { cancel: (bookingId: string, userId: string) => ReturnType<ReturnType<typeof createCancellationService>['cancel']> } {
  return createCancellationService({ bookings: store, now: () => NOW });
}

describe('cancellation cut-off helpers', () => {
  it('measures the time left before departure', () => {
    expect(msUntilDeparture(departureIn(90), NOW)).toBe(90 * MINUTE_MS);
  });

  it('treats an unreadable departure as inside the cut-off', () => {
    expect(msUntilDeparture('not-a-date', NOW)).toBeNull();
    expect(isWithinCancelCutoff('not-a-date', NOW)).toBe(true);
  });

  it('puts exactly one hour inside the cut-off and a millisecond more outside it', () => {
    const oneHourAway = new Date(NOW.getTime() + CANCEL_CUTOFF_MS).toISOString();
    const justOver = new Date(NOW.getTime() + CANCEL_CUTOFF_MS + 1).toISOString();
    expect(isWithinCancelCutoff(oneHourAway, NOW)).toBe(true);
    expect(isWithinCancelCutoff(justOver, NOW)).toBe(false);
  });

  it('maps each refusal to its HTTP status', () => {
    expect(httpStatusFor('NOT_FOUND')).toBe(404);
    expect(httpStatusFor('TOO_LATE')).toBe(409);
  });
});

describe('createCancellationService', () => {
  it('cancels the whole booking and frees every seat when the bus leaves in more than an hour', async () => {
    const store = new FakeBookingStore(bookingFixture({ departureAt: departureIn(61) }));
    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.booking.status).toBe('CANCELLED');
      expect(result.booking.canCancel).toBe(false);
      expect(result.booking.cancelledAt).toBe(NOW.toISOString());
      expect(result.booking.seatNumbers).toEqual(['A1', 'A2']);
    }
    expect(store.cancelCalls).toEqual([{ bookingId: 'BB-10452', userId: 'user-priya' }]);
    expect([...store.seatsHeld]).toEqual([]);
  });

  it('still cancels a millisecond beyond the one-hour boundary', async () => {
    const departureAt = new Date(NOW.getTime() + CANCEL_CUTOFF_MS + 1).toISOString();
    const store = new FakeBookingStore(bookingFixture({ departureAt }));

    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(true);
    expect(store.cancelCalls).toHaveLength(1);
    expect(store.seatsHeld.size).toBe(0);
  });

  it('refuses exactly one hour before departure and keeps the seats held', async () => {
    const departureAt = new Date(NOW.getTime() + CANCEL_CUTOFF_MS).toISOString();
    const store = new FakeBookingStore(bookingFixture({ departureAt }));

    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TOO_LATE');
      expect(result.message).toBe(MESSAGES.cancelNotAllowed);
    }
    expect(store.cancelCalls).toEqual([]);
    expect([...store.seatsHeld]).toEqual(['A1', 'A2']);
  });

  it('refuses inside the last hour before departure', async () => {
    const store = new FakeBookingStore(bookingFixture({ departureAt: departureIn(59) }));

    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LATE');
    expect(store.cancelCalls).toEqual([]);
    expect(store.seatsHeld.size).toBe(2);
  });

  it('refuses a booking that is already cancelled', async () => {
    const store = new FakeBookingStore(
      bookingFixture({
        departureAt: departureIn(600),
        status: 'CANCELLED',
        canCancel: false,
        cancelledAt: '2024-06-10T05:00:00.000Z',
      }),
    );

    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TOO_LATE');
      expect(result.message).toBe(MESSAGES.cancelNotAllowed);
    }
    expect(store.cancelCalls).toEqual([]);
  });

  it('refuses a booking whose bus has already run', async () => {
    const store = new FakeBookingStore(
      bookingFixture({ departureAt: departureIn(-300), arrivalAt: departureIn(-60), status: 'COMPLETED', canCancel: false }),
    );

    const result = await serviceFor(store).cancel('BB-10452', 'user-priya');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LATE');
    expect(store.cancelCalls).toEqual([]);
  });

  it('does not find another traveller\u2019s booking', async () => {
    const store = new FakeBookingStore(bookingFixture({ departureAt: departureIn(600) }));

    const result = await serviceFor(store).cancel('BB-10452', 'user-rahul');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NOT_FOUND');
      expect(result.message).toBe(BOOKING_NOT_FOUND_MESSAGE);
    }
    expect(store.cancelCalls).toEqual([]);
    expect(store.seatsHeld.size).toBe(2);
  });

  it('does not find an unknown booking reference', async () => {
    const store = new FakeBookingStore(bookingFixture({ departureAt: departureIn(600) }));

    const result = await serviceFor(store).cancel('BB-99999', 'user-priya');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });
});
