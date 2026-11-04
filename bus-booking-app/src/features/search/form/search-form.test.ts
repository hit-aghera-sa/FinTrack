import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../../messages/index.js';
import {
  DATE_OUT_OF_RANGE_MESSAGE,
  DATE_REQUIRED_MESSAGE,
  FROM_REQUIRED_MESSAGE,
  RESULTS_PATH,
  TO_REQUIRED_MESSAGE,
  hasSearchFormErrors,
  resultsPathFor,
  validateSearchForm,
  type SearchFormValues,
} from './search-form.js';

/** 00:15 on 13 June in India, so the window is 13 June .. 13 July. */
const NOW = new Date('2024-06-12T18:45:00Z');

const PUNE = 'city-pune';
const MUMBAI = 'city-mumbai';

function values(overrides: Partial<SearchFormValues> = {}): SearchFormValues {
  return { fromCityId: PUNE, toCityId: MUMBAI, date: '2024-06-13', ...overrides };
}

describe('the bus search form rules', () => {
  it('accepts a route with two different cities and a date inside the window', () => {
    const errors = validateSearchForm(values(), NOW);
    expect(errors).toEqual({ from: null, to: null, date: null, sameCity: false });
    expect(hasSearchFormErrors(errors)).toBe(false);
  });

  it('refuses the same city in From and To with the catalogue sentence', () => {
    const errors = validateSearchForm(values({ toCityId: PUNE }), NOW);
    expect(errors.sameCity).toBe(true);
    expect(errors.to).toBe(MESSAGES.sameCity);
    expect(errors.to).toBe('From and To cannot be the same city.');
    expect(hasSearchFormErrors(errors)).toBe(true);
  });

  it('does not call an empty form a same-city search', () => {
    const errors = validateSearchForm(values({ fromCityId: '', toCityId: '', date: '' }), NOW);
    expect(errors.sameCity).toBe(false);
    expect(errors.from).toBe(FROM_REQUIRED_MESSAGE);
    expect(errors.to).toBe(TO_REQUIRED_MESSAGE);
    expect(errors.date).toBe(DATE_REQUIRED_MESSAGE);
  });

  it('asks for a date inside today .. today + 30 days', () => {
    expect(validateSearchForm(values({ date: '2024-07-13' }), NOW).date).toBeNull();
    expect(validateSearchForm(values({ date: '2024-07-14' }), NOW).date).toBe(DATE_OUT_OF_RANGE_MESSAGE);
    expect(validateSearchForm(values({ date: '2024-06-12' }), NOW).date).toBe(DATE_OUT_OF_RANGE_MESSAGE);
    expect(validateSearchForm(values({ date: '2024-02-30' }), NOW).date).toBe(DATE_REQUIRED_MESSAGE);
  });

  it('hands the chosen route and date to the results screen in the query string', () => {
    expect(RESULTS_PATH).toBe('/search/results');
    expect(resultsPathFor(values())).toBe('/search/results?from=city-pune&to=city-mumbai&date=2024-06-13');
  });
});
