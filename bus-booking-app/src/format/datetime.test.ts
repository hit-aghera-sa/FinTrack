import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatTime,
  istPartsOf,
  IST_OFFSET_MINUTES,
  IST_TIME_ZONE,
} from './datetime.js';

describe('India time constants', () => {
  it('names the business time zone and its fixed offset', () => {
    expect(IST_TIME_ZONE).toBe('Asia/Kolkata');
    expect(IST_OFFSET_MINUTES).toBe(330);
  });
});

describe('formatDate', () => {
  it('renders DD/MM/YYYY', () => {
    expect(formatDate('2024-06-12T16:00:00.000Z')).toBe('12/06/2024');
  });

  it('reads a plain ISO date as that calendar day', () => {
    expect(formatDate('2024-06-12')).toBe('12/06/2024');
  });

  it('rolls over to the next Indian day for a late-UTC instant', () => {
    // 19:00 UTC is 00:30 the next day in India.
    expect(formatDate('2024-06-12T19:00:00.000Z')).toBe('13/06/2024');
  });

  it('pads single-digit days and months', () => {
    expect(formatDate('2024-01-05T06:00:00.000Z')).toBe('05/01/2024');
  });

  it('renders nothing for an unreadable value', () => {
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatTime', () => {
  it('renders a 12-hour evening time with PM', () => {
    expect(formatTime('2024-06-12T16:00:00.000Z')).toBe('9:30 PM');
  });

  it('renders a morning time with AM', () => {
    expect(formatTime('2024-06-14T00:45:00.000Z')).toBe('6:15 AM');
  });

  it('renders Indian midnight as 12:00 AM', () => {
    expect(formatTime('2024-06-12T18:30:00.000Z')).toBe('12:00 AM');
  });

  it('renders Indian noon as 12:00 PM', () => {
    expect(formatTime('2024-06-12T06:30:00.000Z')).toBe('12:00 PM');
  });

  it('pads minutes but not hours', () => {
    expect(formatTime('2024-06-12T03:35:00.000Z')).toBe('9:05 AM');
  });

  it('renders nothing for an unreadable value', () => {
    expect(formatTime('')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('joins the date and the time with a comma', () => {
    expect(formatDateTime('2024-05-12T03:44:00.000Z')).toBe('12/05/2024, 9:14 AM');
  });

  it('renders nothing for an unreadable value', () => {
    expect(formatDateTime('tomorrow')).toBe('');
  });
});

describe('istPartsOf', () => {
  it('returns the calendar fields as a clock in India reads them', () => {
    expect(istPartsOf('2024-06-12T16:00:00.000Z')).toEqual({
      day: 12,
      month: 6,
      year: 2024,
      hour: 21,
      minute: 30,
    });
  });

  it('returns null for an unreadable value', () => {
    expect(istPartsOf('12-06-2024 maybe')).toBeNull();
  });
});
