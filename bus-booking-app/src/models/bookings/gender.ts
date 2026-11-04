/**
 * THE PASSENGER GENDER VALUE, declared once.
 *
 * The app stores and sends the three upper-case values; `parseGender` accepts the spellings a
 * datastore or a seed may hold (`Male`, `male`, `M`) so a read never fails on a case difference.
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const GENDERS: readonly Gender[] = ['MALE', 'FEMALE', 'OTHER'];

/** How each value is shown to a traveller. */
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

/** `Male`, `male`, `M`, `MALE` → `MALE`. Anything unrecognised is null. */
export function parseGender(value: unknown): Gender | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toUpperCase();
  if (text === 'M' || text === 'MALE') return 'MALE';
  if (text === 'F' || text === 'FEMALE') return 'FEMALE';
  if (text === 'O' || text === 'OTHER') return 'OTHER';
  return null;
}

export function genderLabel(gender: Gender): string {
  return GENDER_LABELS[gender];
}
