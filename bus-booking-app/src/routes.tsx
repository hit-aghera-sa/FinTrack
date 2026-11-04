import type { ReactElement } from 'react';
import type { RouteParams } from './router';
import { RequireAuth, signOut, useAccountUser } from './session/index.js';
import { APP_PATHS } from './shell/paths.js';
import { HomePage } from './features/my-bookings/list/HomePage';
import { LogInScreen } from './features/login/index.js';
import { SignUpScreen } from './features/signup/index.js';
import { ForgotPasswordScreen } from './features/forgot-password/index.js';
import { PrivacyPolicyScreen } from './features/privacy/index.js';
import { SearchPage } from './features/search/form/index.js';
import { SearchResultsScreen } from './features/search/results/index.js';
import { SeatSelectionScreen } from './features/seat-selection/index.js';
import { PassengerDetailsScreen } from './features/passenger-details/index.js';
import { MyBookingsScreen } from './features/my-bookings/list/index.js';
import { BookingTicketScreen } from './features/my-bookings/ticket/index.js';
import { BookingConfirmedScreen } from './features/booking-confirmation/index.js';
import { ProfileScreen, ProfileDeleteAccountPreviewScreen } from './features/profile/account/index.js';
import { ProfileChangePasswordScreen } from './features/profile/credentials/index.js';
import { DeviceSessionsScreen } from './features/device-sessions/index.js';

/** One page of the app: its URL, its name, and what to draw. */
export interface AppRoute {
  /**
   * The URL path, starting with "/". The first route's path should be "/".
   *
   * A part written `:name` stands for a value in the URL: `/bookings/:bookingId` is the page for
   * `/bookings/BB-10042`. A fixed path wins over a pattern, so `/bookings/:bookingId/confirmed` and
   * `/bookings/:bookingId` can both be listed.
   */
  path: string;
  /** The page heading, and the sidebar link's text when the page is in the navigation. */
  label: string;
  /**
   * Whether the page has a sidebar link. Defaults to true. Set it to false for a page reached from
   * another page rather than from the navigation.
   */
  nav?: boolean;
  /**
   * What surrounds the page. Defaults to 'app'.
   *   'app'   — the app frame: the navigation beside it, the heading, then the page.
   *   'panel' — a centred card with the app's name and the label as its heading, and NO navigation.
   *   'none'  — nothing at all: the page draws the whole screen itself.
   */
  frame?: 'app' | 'panel' | 'none';
  /**
   * Whether the shell draws the page heading. Defaults to true. Set it to false when the page draws
   * its own with `<PageHeader>`.
   */
  heading?: boolean;
  /**
   * Whether the page can be opened without signing in. Only matters when {@link ACCOUNT} is set.
   */
  public?: boolean;
  /** Draws the page. Receives the values of the path's `:name` parts. */
  render: (params: RouteParams) => ReactElement;
}

/** A signed-in person, as the frame shows them. */
export interface AppUser {
  name: string;
  email?: string;
}

/** How the frame learns who is signed in. See {@link ACCOUNT}. */
export interface AppAccount {
  /**
   * The signed-in person; `null` when nobody is signed in; `undefined` while that is still being
   * worked out (the frame waits instead of bouncing to sign-in).
   */
  useUser: () => AppUser | null | undefined;
  /** Ends the session. The frame then goes to `signInPath`. */
  signOut: () => void | Promise<void>;
  /** The path of the app's own sign-in page. */
  signInPath: string;
  /** Account links shown above "Log out". */
  menu?: ReadonlyArray<{ label: string; to: string }>;
  /** The frame's two words about accounts. */
  labels?: { signIn?: string; signOut?: string };
}

/** The app's name, shown at the top of the navigation and in the browser tab. */
export const APP_NAME = 'Bus Booking App';

/**
 * ACCOUNTS — this app has one role, the traveller, and one session: the server's http-only cookie,
 * read through the session lane. The frame shows the signed-in traveller's name, the account links
 * and "Log out" at the foot of the navigation, shows only the public pages to someone signed out,
 * and sends them to the log-in page when they open any other page.
 */
export const ACCOUNT: AppAccount | null = {
  useUser: useAccountUser,
  signOut,
  signInPath: APP_PATHS.login,
  menu: [
    { label: 'Profile', to: APP_PATHS.profile },
    { label: 'Active devices', to: APP_PATHS.deviceSessions },
  ],
  labels: { signIn: 'Log in', signOut: 'Log out' },
};

/** Every signed-in page is drawn behind the session guard as well as the frame's own check. */
function guarded(screen: ReactElement): ReactElement {
  return <RequireAuth>{screen}</RequireAuth>;
}

/**
 * THE PAGE LIST — the one place a page is added to this app. The shell (`App.tsx`) and the
 * navigation (`components/Sidebar.tsx`) read it for the URL matching, the headings, the sidebar and
 * (because {@link ACCOUNT} is set) who may open what.
 */
export const ROUTES: AppRoute[] = [
  {
    path: APP_PATHS.home,
    label: 'Home',
    nav: false,
    public: true,
    heading: false,
    render: () => <HomePage />,
  },
  {
    path: APP_PATHS.login,
    label: 'Log in',
    frame: 'panel',
    public: true,
    render: () => <LogInScreen />,
  },
  {
    path: APP_PATHS.signup,
    label: 'Sign up',
    frame: 'panel',
    public: true,
    render: () => <SignUpScreen />,
  },
  {
    path: APP_PATHS.forgotPassword,
    label: 'Forgot password',
    frame: 'panel',
    public: true,
    render: () => <ForgotPasswordScreen />,
  },
  {
    path: APP_PATHS.search,
    label: 'Search',
    render: () => guarded(<SearchPage />),
  },
  {
    path: APP_PATHS.searchResults,
    label: 'Search results',
    nav: false,
    render: () => guarded(<SearchResultsScreen />),
  },
  {
    path: APP_PATHS.seatSelection,
    label: 'Select seats',
    render: () => guarded(<SeatSelectionScreen />),
  },
  {
    path: APP_PATHS.passengerDetails,
    label: 'Passenger details',
    render: () => guarded(<PassengerDetailsScreen />),
  },
  {
    path: APP_PATHS.myBookings,
    label: 'My bookings',
    render: () => guarded(<MyBookingsScreen />),
  },
  {
    path: APP_PATHS.bookingConfirmed,
    label: 'Booking confirmed',
    render: () => guarded(<BookingConfirmedScreen />),
  },
  {
    path: APP_PATHS.bookingTicket,
    label: 'Ticket',
    heading: false,
    render: () => guarded(<BookingTicketScreen />),
  },
  {
    path: APP_PATHS.profile,
    label: 'Profile',
    render: () => guarded(<ProfileScreen />),
  },
  {
    path: APP_PATHS.profilePassword,
    label: 'Change password',
    nav: false,
    render: () => guarded(<ProfileChangePasswordScreen />),
  },
  {
    path: APP_PATHS.deviceSessions,
    label: 'Active devices',
    nav: false,
    heading: false,
    render: () => guarded(<DeviceSessionsScreen />),
  },
  {
    path: APP_PATHS.deleteAccount,
    label: 'Delete account',
    nav: false,
    heading: false,
    render: () => guarded(<ProfileDeleteAccountPreviewScreen />),
  },
  {
    path: APP_PATHS.privacy,
    label: 'Privacy policy',
    public: true,
    render: () => <PrivacyPolicyScreen />,
  },
];
