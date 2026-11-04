import { describe, expect, it } from 'vitest';
import { GENDERS } from '../../models/bookings/index.js';
import {
  AGE_RANGE_MESSAGE,
  AGE_REQUIRED_MESSAGE,
  GENDER_REQUIRED_MESSAGE,
  GENDER_SELECT_OPTIONS,
  NAME_LENGTH_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  emptyPassengerForm,
  hasPassengerErrors,
  noPassengerErrors,
  toPassengerInputs,
  validateAge,
  validateGender,
  validateName,
  validatePassenger,
} from './validation.js';

describe('passenger field rules', () => {
  it('requires a name', () => {
    expect(validateName('   ')).toBe(NAME_REQUIRED_MESSAGE);
  });

  it('refuses a one letter name', () => {
    expect(validateName('A')).toBe(NAME_LENGTH_MESSAGE);
  });

  it('accepts a real name', () => {
    expect(validateName(' Priya Nair ')).toBeNull();
  });

  it('requires an age', () => {
    expect(validateAge('')).toBe(AGE_REQUIRED_MESSAGE);
  });

  it('refuses an age that is not whole years in range', () => {
    expect(validateAge('abc')).toBe(AGE_RANGE_MESSAGE);
    expect(validateAge('0')).toBe(AGE_RANGE_MESSAGE);
    expect(validateAge('121')).toBe(AGE_RANGE_MESSAGE);
  });

  it('accepts an age in range', () => {
    expect(validateAge('34')).toBeNull();
  });

  it('requires a gender from the shared list', () => {
    expect(validateGender('')).toBe(GENDER_REQUIRED_MESSAGE);
    expect(validateGender('ROBOT')).toBe(GENDER_REQUIRED_MESSAGE);
    expect(validateGender(GENDERS[0])).toBeNull();
  });
});

describe('one seat form', () => {
  it('starts empty for its seat', () => {
    expect(emptyPassengerForm('A1')).toEqual({ seatNumber: 'A1', name: '', age: '', gender: '' });
  });

  it('reports every missing field at once', () => {
    const errors = validatePassenger(emptyPassengerForm('A1'));
    expect(errors.name).toBe(NAME_REQUIRED_MESSAGE);
    expect(errors.age).toBe(AGE_REQUIRED_MESSAGE);
    expect(errors.gender).toBe(GENDER_REQUIRED_MESSAGE);
    expect(hasPassengerErrors(errors)).toBe(true);
  });

  it('is happy with a complete form', () => {
    const errors = validatePassenger({ seatNumber: 'A1', name: 'Alex QA', age: '29', gender: GENDERS[0] });
    expect(hasPassengerErrors(errors)).toBe(false);
    expect(hasPassengerErrors(noPassengerErrors())).toBe(false);
  });
});

describe('gender options', () => {
  it('opens with a deliberate choice and then every shared gender', () => {
    expect(GENDER_SELECT_OPTIONS[0]?.value).toBe('');
    expect(GENDER_SELECT_OPTIONS).toHaveLength(GENDERS.length + 1);
  });
});

describe('toPassengerInputs', () => {
  it('turns the typed forms into the domain shape', () => {
    const passengers = toPassengerInputs([
      { seatNumber: 'A1', name: ' Alex QA ', age: ' 29 ', gender: 'FEMALE' },
      { seatNumber: 'A2', name: 'Priya Nair', age: '7', gender: 'MALE' },
    ]);
    expect(passengers).toEqual([
      { seatNumber: 'A1', name: 'Alex QA', age: 29, gender: 'FEMALE' },
      { seatNumber: 'A2', name: 'Priya Nair', age: 7, gender: 'MALE' },
    ]);
  });
});
