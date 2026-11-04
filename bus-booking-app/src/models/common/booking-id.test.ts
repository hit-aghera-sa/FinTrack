import { describe, expect, it } from 'vitest';
import { BOOKING_ID_PREFIX, formatBookingId, isBookingId } from './booking-id.js';

describe('formatBookingId', () => {
  it('renders a serial as a five-digit BB id', () => {
    expect(formatBookingId(10452)).toBe('BB-10452');
    expect(formatBookingId(7)).toBe(`${BOOKING_ID_PREFIX}00007`);
  });

  it('refuses serials it cannot show as five digits', () => {
    expect(() => formatBookingId(0)).toThrow(RangeError);
    expect(() => formatBookingId(100000)).toThrow(RangeError);
    expect(() => formatBookingId(12.5)).toThrow(RangeError);
  });
});

describe('isBookingId', () => {
  it('accepts the app booking id shape only', () => {
    expect(isBookingId('BB-10452')).toBe(true);
    expect(isBookingId('BB-1045')).toBe(false);
    expect(isBookingId('bb-10452')).toBe(false);
    expect(isBookingId('10452')).toBe(false);
    expect(isBookingId(10452)).toBe(false);
  });
});
