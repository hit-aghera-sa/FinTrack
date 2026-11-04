/**
 * THE FIXED SECURITY QUESTION CATALOGUE of Bus Booking App.
 *
 * There is no free-text question in this product: a traveller picks one of exactly four, at sign-up
 * and whenever they change it, and the same four are offered on the forgot-password screen. The ids
 * are stored on the account; the labels are the only wording any screen shows.
 *
 * Pure data and pure functions — no React, no database, no fetching.
 */

/** The id stored on an account. Immutable set: the app never invents a fifth question. */
export type SecurityQuestionId = 'MOTHER_NAME' | 'FIRST_SCHOOL' | 'FAVOURITE_FOOD' | 'BIRTH_CITY';

/** One entry of the catalogue: the stored id and the sentence shown to the traveller. */
export interface SecurityQuestion {
  readonly id: SecurityQuestionId;
  readonly label: string;
}

/** Every id, in the order the catalogue is offered. */
export const SECURITY_QUESTION_IDS: readonly SecurityQuestionId[] = [
  'MOTHER_NAME',
  'FIRST_SCHOOL',
  'FAVOURITE_FOOD',
  'BIRTH_CITY',
];

/** The approved wording of each question — the one place these four sentences are written. */
export const SECURITY_QUESTION_LABELS: Record<SecurityQuestionId, string> = {
  MOTHER_NAME: "What is your mother's first name?",
  FIRST_SCHOOL: 'What was the name of your first school?',
  FAVOURITE_FOOD: 'What is your favourite food?',
  BIRTH_CITY: 'In which city were you born?',
};

/** The catalogue every signup / profile / forgot-password screen renders as its options. */
export const SECURITY_QUESTIONS: ReadonlyArray<SecurityQuestion> = [
  { id: 'MOTHER_NAME', label: SECURITY_QUESTION_LABELS.MOTHER_NAME },
  { id: 'FIRST_SCHOOL', label: SECURITY_QUESTION_LABELS.FIRST_SCHOOL },
  { id: 'FAVOURITE_FOOD', label: SECURITY_QUESTION_LABELS.FAVOURITE_FOOD },
  { id: 'BIRTH_CITY', label: SECURITY_QUESTION_LABELS.BIRTH_CITY },
];

/** Used when a stored value cannot be recognised at all, so a record still reads sensibly. */
export const DEFAULT_SECURITY_QUESTION_ID: SecurityQuestionId = 'MOTHER_NAME';

/** Whether an unknown value (a request body field, a database column) is one of the four ids. */
export function isSecurityQuestionId(value: unknown): value is SecurityQuestionId {
  if (typeof value !== 'string') return false;
  return (SECURITY_QUESTION_IDS as readonly string[]).includes(value);
}

/** The sentence shown for an id. */
export function securityQuestionLabel(id: SecurityQuestionId): string {
  return SECURITY_QUESTION_LABELS[id];
}

/**
 * Older sample rows (and the seed script) spell the questions as kebab-case slugs rather than as the
 * ids above. They mean the same four questions, so they are accepted on read.
 */
const LEGACY_SECURITY_QUESTION_IDS: Record<string, SecurityQuestionId | undefined> = {
  'mothers-first-name': 'MOTHER_NAME',
  'mother-first-name': 'MOTHER_NAME',
  'mother-name': 'MOTHER_NAME',
  'first-school': 'FIRST_SCHOOL',
  'first-school-name': 'FIRST_SCHOOL',
  'favourite-food': 'FAVOURITE_FOOD',
  'favorite-food': 'FAVOURITE_FOOD',
  'birth-city': 'BIRTH_CITY',
  'city-of-birth': 'BIRTH_CITY',
};

/**
 * Read a stored question value as one of the four ids: the id itself in any case or with spaces or
 * hyphens for underscores, a known legacy slug, or — failing both — the default, so a single odd row
 * never makes an account unreadable.
 */
export function coerceSecurityQuestionId(value: string): SecurityQuestionId {
  const trimmed = value.trim();
  const asId = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (isSecurityQuestionId(asId)) return asId;
  const legacy = LEGACY_SECURITY_QUESTION_IDS[trimmed.toLowerCase()];
  return legacy ?? DEFAULT_SECURITY_QUESTION_ID;
}
