import { describe, expect, it } from 'vitest';
import { istDayKey, istDayWindow, normalisePickupAt, parseClockMinutes, toDate, toInstant } from './instant.js';

describe('catalogue time handling', () => {
  it('reads timestamps, epochs and ISO text', () => {
    const fromDate = toDate(new Date('2024-06-12T16:00:00.000Z'));
    expect(fromDate?.toISOString()).toBe('2024-06-12T16:00:00.000Z');
    expect(toDate('2024-06-12T16:00:00.000Z')?.toISOString()).toBe('2024-06-12T16:00:00.000Z');
    expect(toDate('2024-06-12 16:00:00')?.toISOString()).toBe('2024-06-12T16:00:00.000Z');
    expect(toDate('2024-06-12')?.toISOString()).toBe('2024-06-12T00:00:00.000Z');
    expect(toDate('9:30 PM')).toBeNull();
    expect(toDate(null)).toBeNull();
  });

  it('parses clock times in both 24-hour and 12-hour form', () => {
    expect(parseClockMinutes('21:30')).toBe(21 * 60 + 30);
    expect(parseClockMinutes('9:30 PM')).toBe(21 * 60 + 30);
    expect(parseClockMinutes('12:05 AM')).toBe(5);
    expect(parseClockMinutes('12:05 PM')).toBe(12 * 60 + 5);
    expect(parseClockMinutes('06:15:00')).toBe(6 * 60 + 15);
    expect(parseClockMinutes('25:00')).toBeNull();
    expect(parseClockMinutes('Dadar')).toBeNull();
  });

  it('names the India-time day of an instant', () => {
    // 00:30 IST on 13 June is still 19:00 UTC on 12 June.
    expect(istDayKey(new Date('2024-06-12T19:00:00.000Z'))).toBe('2024-06-13');
    expect(istDayKey(new Date('2024-06-12T16:00:00.000Z'))).toBe('2024-06-12');
  });

  it('turns a calendar day into the India-time instant range', () => {
    const day = istDayWindow('2024-06-12');
    expect(day?.start.toISOString()).toBe('2024-06-11T18:30:00.000Z');
    expect(day?.end.toISOString()).toBe('2024-06-12T18:30:00.000Z');
  });

  it('refuses text that is not a real calendar day', () => {
    expect(istDayWindow('12/06/2024')).toBeNull();
    expect(istDayWindow('2024-02-31')).toBeNull();
    expect(istDayWindow('2024-13-01')).toBeNull();
  });

  it('places a bare clock time on the travel day in India time', () => {
    const base = new Date('2024-06-12T16:00:00.000Z');
    expect(toInstant('9:00 PM', base)?.toISOString()).toBe('2024-06-12T15:30:00.000Z');
    expect(toInstant('21:00', base)?.toISOString()).toBe('2024-06-12T15:30:00.000Z');
    expect(toInstant('9:00 PM', null)).toBeNull();
  });

  it('normalises a pickup time, keeping the stored text when it cannot be placed', () => {
    const base = new Date('2024-06-12T16:00:00.000Z');
    expect(normalisePickupAt(new Date('2024-06-12T15:30:00.000Z'), base)).toBe('2024-06-12T15:30:00.000Z');
    expect(normalisePickupAt('9:00 PM', base)).toBe('2024-06-12T15:30:00.000Z');
    expect(normalisePickupAt('Before departure', base)).toBe('Before departure');
    expect(normalisePickupAt(null, base)).toBe('');
  });
});
