import { MESSAGES } from '../../../messages/index.js';
import { SEARCH_WINDOW_DAYS, isDayKey, isWithinSearchWindow } from './date-window.js';

/**
 * THE RULES OF THE BUS SEARCH FORM, as pure functions.
 *
 * Everything the screen refuses, and the address it leaves for, is decided here so it can be read and
 * tested without rendering anything:
 *
 *   • a route needs both cities, and they may not be the same city (the catalogue's own sentence,
 *     `MESSAGES.sameCity`, is the one shown — never a second wording);
 *   • the travel date must be a real day inside today..today+30, in India time;
 *   • a valid search becomes `/search/results?from=&to=&date=`, with the chosen city ids and day
 *     encoded, which is exactly what the results screen asks the API for.
 */

/** The screen the form hands over to. */
export const RESULTS_PATH = '/search/results';

export const FROM_REQUIRED_MESSAGE = 'Please choose the city you are travelling from.';
export const TO_REQUIRED_MESSAGE = 'Please choose the city you are travelling to.';
export const DATE_REQUIRED_MESSAGE = 'Please choose a travel date.';
export const DATE_OUT_OF_RANGE_MESSAGE = `Choose a travel date from today up to ${SEARCH_WINDOW_DAYS} days ahead.`;

/** What the traveller has chosen: two city ids and a `YYYY-MM-DD` travel day. */
export interface SearchFormValues {
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly date: string;
}

/** One message per field, plus the same-city refusal the screen also states as a notice. */
export interface SearchFormErrors {
  readonly from: string | null;
  readonly to: string | null;
  readonly date: string | null;
  readonly sameCity: boolean;
}

/** A clean form: nothing to state yet. */
export const NO_SEARCH_FORM_ERRORS: SearchFormErrors = {
  from: null,
  to: null,
  date: null,
  sameCity: false,
};

function dateMessage(date: string, now: Date): string | null {
  if (date === '' || !isDayKey(date)) return DATE_REQUIRED_MESSAGE;
  if (!isWithinSearchWindow(date, now)) return DATE_OUT_OF_RANGE_MESSAGE;
  return null;
}

/** Everything wrong with the current choices, judged against the moment of the search. */
export function validateSearchForm(values: SearchFormValues, now: Date): SearchFormErrors {
  const from = values.fromCityId.trim();
  const to = values.toCityId.trim();
  const date = values.date.trim();
  const sameCity = from !== '' && from === to;

  let toMessage: string | null = null;
  if (to === '') toMessage = TO_REQUIRED_MESSAGE;
  else if (sameCity) toMessage = MESSAGES.sameCity;

  return {
    from: from === '' ? FROM_REQUIRED_MESSAGE : null,
    to: toMessage,
    date: dateMessage(date, now),
    sameCity,
  };
}

/** True when the form may not be submitted. */
export function hasSearchFormErrors(errors: SearchFormErrors): boolean {
  return errors.from !== null || errors.to !== null || errors.date !== null;
}

/** The results address for a valid search, with the chosen values encoded. */
export function resultsPathFor(values: SearchFormValues): string {
  const query = new URLSearchParams({
    from: values.fromCityId,
    to: values.toCityId,
    date: values.date,
  });
  return `${RESULTS_PATH}?${query.toString()}`;
}
