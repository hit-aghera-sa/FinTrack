/**
 * THE NAME RULE OF THE PROFILE SCREEN.
 *
 * Pure functions only: no React, no fetching. The server is still the authority on what it accepts —
 * when it refuses a name the screen shows the sentence the API returned — but checking the obvious
 * cases here means a traveller is told at once instead of after a round trip.
 */

/** A name shorter than this is not a name. */
export const FULL_NAME_MIN_LENGTH = 2;

/** The longest name the profile form will send. */
export const FULL_NAME_MAX_LENGTH = 50;

/** What a traveller reads when the name typed cannot be sent. */
export const FULL_NAME_RULE_MESSAGE = 'Please enter your full name (2 to 50 characters).';

/**
 * The name as it is sent and compared: no surrounding whitespace, and one space between words, so
 * `"  Priya   Menon "` and `"Priya Menon"` are the same name.
 */
export function normaliseFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** The problem with this name, or null when it can be saved. */
export function validateFullName(value: string): string | null {
  const name = normaliseFullName(value);
  if (name.length < FULL_NAME_MIN_LENGTH) return FULL_NAME_RULE_MESSAGE;
  if (name.length > FULL_NAME_MAX_LENGTH) return FULL_NAME_RULE_MESSAGE;
  return null;
}
