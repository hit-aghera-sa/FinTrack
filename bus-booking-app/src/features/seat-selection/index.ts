/**
 * THE SEAT SELECTION FEATURE — the screen the app mounts at `/trips/:tripId/seats`.
 *
 * `SeatSelectionScreen` needs no props: it reads the trip from its own address and loads the seat map
 * fresh from `GET /api/trips/:tripId` through the shared API client. It renders only its own content,
 * so the shell keeps drawing whatever frame the route table asks for.
 *
 * The rules are exported beside it, so the grey-seat rule, the six-seat ceiling and the Continue
 * address can be read and tested without rendering anything.
 */
export { SeatSelectionScreen } from './SeatSelectionScreen';
export {
  BOARDING_PLACEHOLDER_LABEL,
  BOARDING_REQUIRED_NOTICE,
  MAX_SEATS,
  MIN_SEATS,
  NO_BOARDING_POINTS_NOTICE,
  NO_SEATS_MESSAGE,
  NO_SEATS_TITLE,
  PASSENGERS_ROUTE,
  SEAT_BOOKED_NOTICE,
  SEAT_LIMIT_NOTICE,
  SEAT_ROUTE,
  SEAT_STATE_LABELS,
  SEAT_STATE_MARKS,
  SELECT_SEATS_NOTICE,
  TRIP_LOAD_FAILED_MESSAGE,
  TRIP_NOT_FOUND_MESSAGE,
  boardingOptions,
  boardingPointLabel,
  describeTripError,
  initialBoardingPointId,
  initialSelection,
  orderedSelection,
  parseSeatsParam,
  passengersPath,
  readTripDetail,
  seatCountLabel,
  seatRows,
  seatStateOf,
  seatTakenNotice,
  toggleSeat,
  totalFare,
  tripIdFromPath,
  type BoardingOption,
  type SeatCellState,
  type SeatRow,
  type SeatToggleResult,
} from './selection.js';
