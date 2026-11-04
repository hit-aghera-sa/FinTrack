import { describe, expect, it } from 'vitest';
import {
  CANCEL_CUTOFF_MINUTES,
  CANCEL_CUTOFF_MS,
  canCancelBooking,
  deriveBookingStatus,
  isCancelledText,
  type BookingTimeline,
} from './status.js';

const DEPARTURE = '2024-06-12T16:00:00.000Z';
const ARRIVAL = '2024-06-12T21:00:00.000Z';

function timeline(cancelledAt: string | null): BookingTimeline {
  return { cancelledAt, departureAt: DEPARTURE, arrivalAt: ARRIVAL };
}

describe('deriveBookingStatus', () => {
  it('is BOOKED while the bus has not arrived yet', () => {
    expect(deriveBookingStatus(timeline(null), new Date('2024-06-12T10:00:00.000Z'))).toBe('BOOKED');
  });

  it('is still BOOKED one minute before arrival', () => {
    expect(deriveBookingStatus(timeline(null), new Date('2024-06-12T20:59:00.000Z'))).toBe('BOOKED');
  });

  it('is COMPLETED at the arrival instant and after it', () => {
    expect(deriveBookingStatus(timeline(null), new Date(ARRIVAL))).toBe('COMPLETED');
    expect(deriveBookingStatus(timeline(null), new Date('2024-06-13T06:00:00.000Z'))).toBe('COMPLETED');
  });

  it('is CANCELLED once cancelled, whatever the clock says', () => {
    const cancelled = timeline('2024-06-11T08:00:00.000Z');
    expect(deriveBookingStatus(cancelled, new Date('2024-06-12T10:00:00.000Z'))).toBe('CANCELLED');
    expect(deriveBookingStatus(cancelled, new Date('2024-06-20T10:00:00.000Z'))).toBe('CANCELLED');
  });
});

describe('canCancelBooking', () => {
  it('allows cancellation more than one hour before departure', () => {
    expect(canCancelBooking('BOOKED', DEPARTURE, new Date('2024-06-12T14:00:00.000Z'))).toBe(true);
    expect(canCancelBooking('BOOKED', DEPARTURE, new Date('2024-06-12T14:59:59.000Z'))).toBe(true);
  });

  it('refuses cancellation at exactly one hour and inside it', () => {
    expect(canCancelBooking('BOOKED', DEPARTURE, new Date('2024-06-12T15:00:00.000Z'))).toBe(false);
    expect(canCancelBooking('BOOKED', DEPARTURE, new Date('2024-06-12T15:30:00.000Z'))).toBe(false);
  });

  it('refuses cancellation for a terminal booking', () => {
    const early = new Date('2024-06-12T10:00:00.000Z');
    expect(canCancelBooking('CANCELLED', DEPARTURE, early)).toBe(false);
    expect(canCancelBooking('COMPLETED', DEPARTURE, early)).toBe(false);
  });

  it('states the cut-off once, in minutes and milliseconds', () => {
    expect(CANCEL_CUTOFF_MINUTES).toBe(60);
    expect(CANCEL_CUTOFF_MS).toBe(3_600_000);
  });
});

describe('isCancelledText', () => {
  it('recognises the stored cancellation words', () => {
    expect(isCancelledText('Cancelled')).toBe(true);
    expect(isCancelledText(' canceled ')).toBe(true);
    expect(isCancelledText('CANCELLED')).toBe(true);
  });

  it('does not treat any other word as cancelled', () => {
    expect(isCancelledText('Booked')).toBe(false);
    expect(isCancelledText('Completed')).toBe(false);
    expect(isCancelledText(null)).toBe(false);
  });
});
