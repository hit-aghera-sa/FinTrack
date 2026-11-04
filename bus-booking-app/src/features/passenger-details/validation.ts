import { GENDERS, GENDER_LABELS, parseGender, type PassengerInput } from '../../models/bookings/index.js';

/**
 * THE PASSENGER FORM RULES — one traveller per chosen seat, checked field by field.
 *
 * The form holds what was typed (strings), so an age half-entered is still a valid form state; the
 * conversion to the domain's `PassengerInput` happens only once every field passes.
 */

export const PASSENGER_NAME_MIN_LENGTH = 2;
export const PASSENGER_NAME_MAX_LENGTH = 60;
export const PASSENGER_AGE_MIN = 1;
export const PASSENGER_AGE_MAX = 120;

export const NAME_REQUIRED_MESSAGE = 'Enter the passenger name.';
export const NAME_LENGTH_MESSAGE = `Name must be ${PASSENGER_NAME_MIN_LENGTH} to ${PASSENGER_NAME_MAX_LENGTH} characters.`;
export const AGE_REQUIRED_MESSAGE = 'Enter the passenger age.';
export const AGE_RANGE_MESSAGE = `Age must be a whole number between ${PASSENGER_AGE_MIN} and ${PASSENGER_AGE_MAX}.`;
export const GENDER_REQUIRED_MESSAGE = 'Select the passenger gender.';

/** One seat's form, as typed. */
export interface PassengerFormValues {
  readonly seatNumber: string;
  readonly name: string;
  readonly age: string;
  readonly gender: string;
}

/** The three messages shown under that seat's fields; null where the field is fine. */
export interface PassengerFormErrors {
  readonly name: string | null;
  readonly age: string | null;
  readonly gender: string | null;
}

/** The fields a passenger form has. */
export type PassengerField = 'name' | 'age' | 'gender';

/** An untouched form for one seat. */
export function emptyPassengerForm(seatNumber: string): PassengerFormValues {
  return { seatNumber, name: '', age: '', gender: '' };
}

/** No complaint about any field. */
export function noPassengerErrors(): PassengerFormErrors {
  return { name: null, age: null, gender: null };
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (name === '') return NAME_REQUIRED_MESSAGE;
  if (name.length < PASSENGER_NAME_MIN_LENGTH || name.length > PASSENGER_NAME_MAX_LENGTH) {
    return NAME_LENGTH_MESSAGE;
  }
  return null;
}

export function validateAge(value: string): string | null {
  const age = value.trim();
  if (age === '') return AGE_REQUIRED_MESSAGE;
  if (!/^\d{1,3}$/.test(age)) return AGE_RANGE_MESSAGE;
  const years = Number(age);
  if (years < PASSENGER_AGE_MIN || years > PASSENGER_AGE_MAX) return AGE_RANGE_MESSAGE;
  return null;
}

export function validateGender(value: string): string | null {
  return parseGender(value.trim()) === null ? GENDER_REQUIRED_MESSAGE : null;
}

/** Every field of one seat's form, checked at once (what pressing Confirm does). */
export function validatePassenger(values: PassengerFormValues): PassengerFormErrors {
  return {
    name: validateName(values.name),
    age: validateAge(values.age),
    gender: validateGender(values.gender),
  };
}

/** True when at least one field of that seat still needs attention. */
export function hasPassengerErrors(errors: PassengerFormErrors): boolean {
  return errors.name !== null || errors.age !== null || errors.gender !== null;
}

/** The gender picker's options, with a first entry that forces a deliberate choice. */
export const GENDER_SELECT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Select gender' },
  ...GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] })),
];

/** The forms as the domain states them — call only once `validatePassenger` is happy with each. */
export function toPassengerInputs(forms: readonly PassengerFormValues[]): PassengerInput[] {
  return forms.map((form) => ({
    seatNumber: form.seatNumber,
    name: form.name.trim(),
    age: Number(form.age.trim()),
    gender: parseGender(form.gender.trim()) ?? 'OTHER',
  }));
}
