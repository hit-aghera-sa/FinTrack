/**
 * THE APP'S OWN ADDRESSES — one table of the client route paths.
 *
 * `src/routes.tsx` registers its pages from this table and the shell's navigation is derived from
 * those entries, so a link can never point at an address the router does not register. The `:name`
 * parts are filled in by the small builders below.
 *
 * Pure constants and pure functions: no React, no fetching.
 */
export const APP_PATHS = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  privacy: '/privacy',
  search: '/search',
  searchResults: '/search/results',
  seatSelection: '/trips/:tripId/seats',
  passengerDetails: '/trips/:tripId/passengers',
  myBookings: '/bookings',
  bookingConfirmed: '/bookings/:bookingId/confirmed',
  bookingTicket: '/bookings/:bookingId',
  profile: '/profile',
  profilePassword: '/profile/password',
  deviceSessions: '/profile/sessions',
  deleteAccount: '/profile/delete-account',
} as const;

/** The name of one page in {@link APP_PATHS}. */
export type AppPathName = keyof typeof APP_PATHS;

/** The seat map of one bus. */
export function seatSelectionPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}/seats`;
}

/** The passenger details form for one bus. */
export function passengerDetailsPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}/passengers`;
}

/** One booking's ticket. */
export function bookingTicketPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}`;
}

/** The confirmation screen of one booking, re-openable later. */
export function bookingConfirmedPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/confirmed`;
}
