import { describe, expect, it } from 'vitest';
import { GENDERS, genderLabel, isGender, parseGender } from './gender.js';

describe('parseGender', () => {
  it('reads every spelling a datastore may hold', () => {
    expect(parseGender('MALE')).toBe('MALE');
    expect(parseGender('Male')).toBe('MALE');
    expect(parseGender(' male ')).toBe('MALE');
    expect(parseGender('M')).toBe('MALE');
    expect(parseGender('Female')).toBe('FEMALE');
    expect(parseGender('f')).toBe('FEMALE');
    expect(parseGender('Other')).toBe('OTHER');
    expect(parseGender('O')).toBe('OTHER');
  });

  it('is null for anything it does not recognise', () => {
    expect(parseGender('')).toBeNull();
    expect(parseGender('unknown')).toBeNull();
    expect(parseGender(null)).toBeNull();
    expect(parseGender(7)).toBeNull();
  });
});

describe('isGender and genderLabel', () => {
  it('accepts exactly the three stored values', () => {
    expect(GENDERS).toEqual(['MALE', 'FEMALE', 'OTHER']);
    expect(isGender('MALE')).toBe(true);
    expect(isGender('Male')).toBe(false);
    expect(isGender(undefined)).toBe(false);
  });

  it('shows each value the way a traveller reads it', () => {
    expect(genderLabel('MALE')).toBe('Male');
    expect(genderLabel('FEMALE')).toBe('Female');
    expect(genderLabel('OTHER')).toBe('Other');
  });
});
