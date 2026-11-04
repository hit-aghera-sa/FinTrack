import { describe, expect, it } from 'vitest';
import { BUS_TYPES, DEFAULT_BUS_TYPE, busTypeLabel, isBusType, parseBusType } from './bus-type.js';

describe('bus types', () => {
  it('names the four kinds of bus exactly once each', () => {
    expect(BUS_TYPES).toEqual(['AC_SEATER', 'AC_SLEEPER', 'NON_AC_SEATER', 'NON_AC_SLEEPER']);
    expect(new Set(BUS_TYPES).size).toBe(4);
  });

  it('recognises its own spellings', () => {
    expect(isBusType('AC_SLEEPER')).toBe(true);
    expect(isBusType('AC Sleeper')).toBe(false);
    expect(isBusType(undefined)).toBe(false);
  });

  it('parses every reasonable stored spelling', () => {
    expect(parseBusType('AC Sleeper')).toBe('AC_SLEEPER');
    expect(parseBusType('ac_sleeper')).toBe('AC_SLEEPER');
    expect(parseBusType('Non-AC Seater')).toBe('NON_AC_SEATER');
    expect(parseBusType('non ac sleeper')).toBe('NON_AC_SLEEPER');
    expect(parseBusType('AC Seater')).toBe('AC_SEATER');
  });

  it('returns null for text that names no bus type', () => {
    expect(parseBusType('Luxury Coach')).toBeNull();
    expect(parseBusType('')).toBeNull();
    expect(parseBusType(42)).toBeNull();
  });

  it('labels each type the way a traveller reads it', () => {
    expect(busTypeLabel('AC_SLEEPER')).toBe('AC Sleeper');
    expect(busTypeLabel('NON_AC_SEATER')).toBe('Non-AC Seater');
    expect(busTypeLabel(DEFAULT_BUS_TYPE)).toBe('Non-AC Seater');
  });
});
