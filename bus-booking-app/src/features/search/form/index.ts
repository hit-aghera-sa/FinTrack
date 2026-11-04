/**
 * THE BUS SEARCH FORM FEATURE — the screen the app mounts at `/search`.
 *
 * `SearchScreen` renders only its own content (the shell draws any frame around it) and needs no
 * props: it loads the city list from `GET /api/cities` itself. `SearchPage` is the container the
 * approved preview wires up. The pure rules are exported too, so the date window and the same-city
 * guard can be reused and tested without rendering anything.
 */
export { SearchScreen } from './SearchScreen';
export { SearchPage } from './SearchPage';
export { UpcomingDepartures, UPCOMING_TRIPS_PATH, upcomingSeatMapPath } from './UpcomingDepartures';

export { useSearchForm, describeLoadFailure, CITIES_PATH } from './useSearchForm.js';
export type { SearchFormState, CityListStatus } from './useSearchForm.js';

export {
  DATE_OUT_OF_RANGE_MESSAGE,
  DATE_REQUIRED_MESSAGE,
  FROM_REQUIRED_MESSAGE,
  NO_SEARCH_FORM_ERRORS,
  RESULTS_PATH,
  TO_REQUIRED_MESSAGE,
  hasSearchFormErrors,
  resultsPathFor,
  validateSearchForm,
} from './search-form.js';
export type { SearchFormErrors, SearchFormValues } from './search-form.js';

export {
  SEARCH_WINDOW_DAYS,
  dayKeyToUtcMs,
  isDayKey,
  isWithinSearchWindow,
  istDateKey,
  searchDateBounds,
  shiftDayKey,
} from './date-window.js';
export type { SearchDateBounds } from './date-window.js';
