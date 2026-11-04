/**
 * THE MY BOOKINGS LIST FEATURE.
 *
 * `MyBookingsScreen` is what the app shell's route table mounts at `/bookings`: it renders only its
 * own content, loads the traveller's bookings itself from `GET /api/bookings`, splits them into
 * **Upcoming** (soonest departure first) and **Past & cancelled** (newest first), and links each row
 * through to that booking's ticket at `/bookings/:bookingId`.
 *
 * The pure rules are exported too, so the tab split, the sorts and the row wording can be reused and
 * tested without rendering anything.
 */
export { MyBookingsScreen, MY_BOOKINGS_TEST_ID } from './MyBookingsScreen';
export { BookingsPage } from './BookingsPage';

export { useMyBookings, describeListError, LOAD_FAILED_MESSAGE } from './useMyBookings.js';
export type { MyBookingsState, MyBookingsStatus } from './useMyBookings.js';

export {
  MY_BOOKINGS_API_PATH,
  MY_BOOKINGS_PATH,
  MY_BOOKINGS_TABS,
  SEARCH_PATH,
  TAB_QUERY_KEY,
  bookingSubline,
  bookingTitle,
  compareNewestFirst,
  compareSoonestFirst,
  instantMs,
  isBookingRecordLike,
  isUpcomingBooking,
  normaliseMyBookings,
  partitionBookings,
  passengerNamesLabel,
  pastSortKeyMs,
  routeLabel,
  seatListLabel,
  statusBadgeClass,
  statusLabel,
  tabFromSearch,
  ticketPathFor,
  toBookingList,
} from './my-bookings-list.js';
export type { MyBookingsSplit, MyBookingsTab, MyBookingsTabId } from './my-bookings-list.js';

export { MY_BOOKINGS_STYLES } from './styles.js';
