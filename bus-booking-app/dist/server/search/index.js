/**
 * THE BUS SEARCH LANE'S PUBLIC SURFACE.
 *
 * The composition root mounts `searchRouter` under `/api` (`app.use('/api', searchRouter)`), which
 * gives the app `GET /api/cities` and `GET /api/trips?from=&to=&date=`. Clients take those two
 * addresses from `SEARCH_API_PATHS` rather than retyping them.
 */
export { createSearchRouter, searchRouter, SEARCH_API_PATHS, SEARCH_UNAVAILABLE_MESSAGE } from './router.js';
export { createSearchService, onlyUpcoming, } from './service.js';
export { dayOffsetFromToday, isWithinSearchWindow, parseSearchQuery, readQueryString, DATE_OUT_OF_RANGE_MESSAGE, INVALID_DATE_MESSAGE, MISSING_SEARCH_FIELDS_MESSAGE, SEARCH_WINDOW_DAYS, } from './validation.js';
