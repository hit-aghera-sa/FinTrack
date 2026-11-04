/**
 * THE SEARCH RESULTS FEATURE — everything the app needs to show the buses on a route and date.
 *
 * `SearchResultsScreen` is the screen the route table mounts at `/search/results`; it renders only its
 * own content, so the shell keeps drawing the frame around it.
 */
export { SearchResultsScreen } from './SearchResultsScreen';
export { SearchResultsPage } from './SearchResultsPage';
export { TripResultCard } from './TripResultCard';
export type { TripResultCardProps } from './TripResultCard';
export { describeSearchError, useSearchResults } from './useSearchResults.js';
export type { SearchResultsState, SearchResultsStatus } from './useSearchResults.js';
export {
  CITIES_PATH,
  TRIPS_PATH,
  currentSearch,
  formatTravelDate,
  isCompleteQuery,
  parseResultsQuery,
  tripsRequestPath,
} from './results-query.js';
export type { SearchResultsQuery } from './results-query.js';
export {
  SEATS_LOW_THRESHOLD,
  arrivalDayNote,
  arrivalLabel,
  compareByDeparture,
  farePerSeatLabel,
  isSoldOut,
  isTripSummaryLike,
  resolveCityName,
  resultsCountLabel,
  routeLabel,
  seatsBadgeClass,
  seatsLeftLabel,
  toCityList,
  toTripList,
  tripDepartureMs,
  upcomingEarliestFirst,
} from './results-order.js';
