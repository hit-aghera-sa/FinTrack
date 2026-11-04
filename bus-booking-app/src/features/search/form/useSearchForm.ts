import { useCallback, useEffect, useMemo, useState } from 'react';
import { UNEXPECTED_MESSAGE, apiFetch, isOfflineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import type { City } from '../../../models/catalogue/index.js';
import { navigate } from '../../../router';
import { istDateKey, searchDateBounds, type SearchDateBounds } from './date-window.js';
import {
  NO_SEARCH_FORM_ERRORS,
  hasSearchFormErrors,
  resultsPathFor,
  validateSearchForm,
  type SearchFormErrors,
  type SearchFormValues,
} from './search-form.js';

/**
 * THE BEHAVIOUR OF THE BUS SEARCH FORM.
 *
 * The city list is the real one: `GET /api/cities` of this app's own search API, through the shared
 * API client, so the form can never offer a route the catalogue does not have. Nothing is cached in
 * device storage and nothing is invented locally.
 *
 * The clock is a parameter with a working default, so the 30-day window can be exercised at a fixed
 * instant without a setter being shipped into production.
 */

/** Where the city list comes from. */
export const CITIES_PATH = '/cities';

export type CityListStatus = 'loading' | 'ready' | 'empty' | 'failed';

export interface SearchFormState {
  readonly cities: readonly City[];
  readonly status: CityListStatus;
  /** The sentence to show when the city list could not be loaded. */
  readonly loadError: string | null;
  readonly values: SearchFormValues;
  /** Everything currently wrong with the form. */
  readonly errors: SearchFormErrors;
  /** What the screen actually states: the same-city refusal at once, the rest after a first attempt. */
  readonly visibleErrors: SearchFormErrors;
  readonly bounds: SearchDateBounds;
  readonly setFromCity: (cityId: string) => void;
  readonly setToCity: (cityId: string) => void;
  readonly setDate: (date: string) => void;
  readonly submit: () => void;
  readonly reload: () => void;
}

const systemNow = (): Date => new Date();

/** The one sentence a traveller is told when the city list cannot be read. */
export function describeLoadFailure(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return UNEXPECTED_MESSAGE;
}

export function useSearchForm(now: () => Date = systemNow): SearchFormState {
  const [cities, setCities] = useState<readonly City[]>([]);
  const [status, setStatus] = useState<CityListStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fromCityId, setFromCityId] = useState('');
  const [toCityId, setToCityId] = useState('');
  const [date, setDateValue] = useState<string>(() => istDateKey(now()));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setStatus('loading');
    setLoadError(null);

    apiFetch<City[]>(CITIES_PATH, { signal: controller.signal })
      .then((list: City[]) => {
        if (!live) return;
        setCities(list);
        setStatus(list.length === 0 ? 'empty' : 'ready');
      })
      .catch((error: unknown) => {
        if (!live) return;
        setCities([]);
        setLoadError(describeLoadFailure(error));
        setStatus('failed');
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [attempt]);

  const values = useMemo<SearchFormValues>(() => ({ fromCityId, toCityId, date }), [fromCityId, toCityId, date]);

  const bounds = useMemo<SearchDateBounds>(() => searchDateBounds(now()), [now]);

  const errors = useMemo<SearchFormErrors>(() => validateSearchForm(values, now()), [values, now]);

  const visibleErrors = useMemo<SearchFormErrors>(() => {
    if (submitted) return errors;
    // Before the first attempt only the same-city refusal is worth saying: "please choose a city"
    // before anything has been chosen is noise.
    if (!errors.sameCity) return NO_SEARCH_FORM_ERRORS;
    return { from: null, to: errors.to, date: null, sameCity: true };
  }, [errors, submitted]);

  const setFromCity = useCallback((cityId: string): void => {
    setFromCityId(cityId);
  }, []);

  const setToCity = useCallback((cityId: string): void => {
    setToCityId(cityId);
  }, []);

  const setDate = useCallback((next: string): void => {
    setDateValue(next);
  }, []);

  const submit = useCallback((): void => {
    setSubmitted(true);
    const checked = validateSearchForm(values, now());
    if (hasSearchFormErrors(checked)) return;
    navigate(resultsPathFor(values));
  }, [values, now]);

  const reload = useCallback((): void => {
    setAttempt((previous) => previous + 1);
  }, []);

  return {
    cities,
    status,
    loadError,
    values,
    errors,
    visibleErrors,
    bounds,
    setFromCity,
    setToCity,
    setDate,
    submit,
    reload,
  };
}
