/**
 * THE PASSENGER DETAILS & BOOKING SUMMARY FEATURE.
 *
 * `PassengerDetailsScreen` is what the app shell's route table mounts at `/trips/:tripId/passengers`.
 * It takes no props: the bus comes from the URL's path, the chosen seats and boarding point from the
 * same URL's query string (`?seats=A1,A2&boarding=bp-shivaji`), and the trip's own details from
 * `GET /api/trips/:tripId`. Confirming creates the booking with `POST /api/bookings` and lands the
 * traveller on `/bookings/:bookingId/confirmed`.
 *
 * The screen renders only its own content — the shell draws whatever frame the route asks for.
 */
export { PassengerDetailsScreen } from './PassengerDetailsScreen';

export {
  BOOKINGS_REQUEST_PATH,
  PASSENGER_DETAILS_ROUTE,
  SEAT_MAP_ROUTE,
  SEARCH_PATH,
  bookingConfirmedPath,
  currentSearch,
  parsePassengerQuery,
  passengerDetailsPath,
  seatMapPath,
  tripDetailRequestPath,
  type PassengerDetailsQuery,
} from './query.js';

export {
  AGE_RANGE_MESSAGE,
  AGE_REQUIRED_MESSAGE,
  GENDER_REQUIRED_MESSAGE,
  GENDER_SELECT_OPTIONS,
  NAME_LENGTH_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  PASSENGER_AGE_MAX,
  PASSENGER_AGE_MIN,
  PASSENGER_NAME_MAX_LENGTH,
  PASSENGER_NAME_MIN_LENGTH,
  emptyPassengerForm,
  hasPassengerErrors,
  noPassengerErrors,
  toPassengerInputs,
  validateAge,
  validateGender,
  validateName,
  validatePassenger,
  type PassengerField,
  type PassengerFormErrors,
  type PassengerFormValues,
} from './validation.js';

export {
  SEAT_TAKEN_PATTERN,
  boardingPointFor,
  boardingPointLabel,
  conflictSeatFrom,
  describeBookingError,
  isSeatTakenError,
  seatTakenMessage,
  summaryRows,
  totalFare,
  type SummaryRow,
} from './summary.js';

export { PASSENGER_DETAILS_STYLES } from './styles.js';
