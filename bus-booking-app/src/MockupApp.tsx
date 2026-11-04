// src/MockupApp.tsx — generated from the Mockup Preview the client approved
// (content 6f4e556ba0c4c9c6). Every route below is a screen they signed off, drawn by
// the container beside it; the ones the preview showed inside the sidebar and top bar are wrapped in
// the chrome component.
import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { hasParams, matchPath, navigate, normalisePath, usePathname, type RouteParams } from './router';
import AppShell from './components/AppShell';
import AppShell1 from './components/AppShell1';
import LoginPage from './features/login/LoginPage';
import SignupPage from './features/signup/SignupPage';
import ForgotPasswordPage from './features/forgot-password/ForgotPasswordPage';
import PrivacyPage from './features/privacy/PrivacyPage';
import AuthForgotPasswordQuestionPage from './features/forgot-password/AuthForgotPasswordQuestionPage';
import AuthForgotPasswordVerifyPage from './features/forgot-password/AuthForgotPasswordVerifyPage';
import AuthForgotPasswordResetPage from './features/forgot-password/AuthForgotPasswordResetPage';
import AuthMePage from './session/AuthMePage';
import AuthSecurityQuestionsPage from './ui/AuthSecurityQuestionsPage';
import AuthSessionPage from './session/AuthSessionPage';
import HomePage from './features/my-bookings/list/HomePage';
import BookingsPage from './features/my-bookings/list/BookingsPage';
import BusesPage from './features/search/form/BusesPage';
import CitiesPage from './features/staff-services/fleet/CitiesPage';
import ProfilePage from './features/profile/account/ProfilePage';
import SearchPage from './features/search/form/SearchPage';
import TripsPage from './features/staff-services/trip-editor/TripsPage';
import BookingsDetailPage from './features/my-bookings/ticket/BookingsDetailPage';
import ProfileChangePasswordPage from './features/profile/credentials/ProfileChangePasswordPage';
import ProfileSessionsPage from './features/device-sessions/ProfileSessionsPage';
import SearchResultsPage from './features/search/results/SearchResultsPage';
import TripsDetailPage from './features/staff-services/trip-editor/TripsDetailPage';
import BookingsDetailConfirmedPage from './features/booking-confirmation/BookingsDetailConfirmedPage';
import ProfileDeleteAccountPreviewPage from './features/profile/account/ProfileDeleteAccountPreviewPage';
import TripsDetailPassengersPage from './features/staff-services/trip-editor/TripsDetailPassengersPage';
import TripsDetailSeatsPage from './features/staff-services/trip-editor/TripsDetailSeatsPage';

/** One approved screen: its address, whether the preview drew it inside the chrome, and the page. */
interface MockupRoute {
  readonly path: string;
  /** The frame this screen is drawn inside, or null when the preview drew it bare. */
  readonly chrome: ((props: { children?: ReactNode }) => JSX.Element) | null;
  readonly render: (params: RouteParams) => ReactElement;
}

export const ROUTES: readonly MockupRoute[] = [
  { path: "/login", chrome: AppShell, render: () => <LoginPage /> },
  { path: "/signup", chrome: AppShell, render: () => <SignupPage /> },
  { path: "/forgot-password", chrome: AppShell, render: () => <ForgotPasswordPage /> },
  { path: "/privacy", chrome: AppShell, render: () => <PrivacyPage /> },
  { path: "/auth/forgot-password/question", chrome: AppShell, render: () => <AuthForgotPasswordQuestionPage /> },
  { path: "/auth/forgot-password/verify", chrome: AppShell, render: () => <AuthForgotPasswordVerifyPage /> },
  { path: "/auth/forgot-password/reset", chrome: AppShell, render: () => <AuthForgotPasswordResetPage /> },
  { path: "/auth/me", chrome: AppShell, render: () => <AuthMePage /> },
  { path: "/auth/security-questions", chrome: AppShell, render: () => <AuthSecurityQuestionsPage /> },
  { path: "/auth/session", chrome: AppShell, render: () => <AuthSessionPage /> },
  { path: "/", chrome: AppShell1, render: () => <HomePage /> },
  { path: "/bookings", chrome: AppShell1, render: () => <BookingsPage /> },
  { path: "/buses", chrome: AppShell1, render: () => <BusesPage /> },
  { path: "/cities", chrome: AppShell1, render: () => <CitiesPage /> },
  { path: "/profile", chrome: AppShell1, render: () => <ProfilePage /> },
  { path: "/search", chrome: AppShell1, render: () => <SearchPage /> },
  { path: "/trips", chrome: AppShell1, render: () => <TripsPage /> },
  { path: "/bookings/:bookingId", chrome: AppShell1, render: () => <BookingsDetailPage /> },
  { path: "/profile/change-password", chrome: AppShell1, render: () => <ProfileChangePasswordPage /> },
  { path: "/profile/sessions", chrome: AppShell1, render: () => <ProfileSessionsPage /> },
  { path: "/search/results", chrome: AppShell1, render: () => <SearchResultsPage /> },
  { path: "/trips/:tripId", chrome: AppShell1, render: () => <TripsDetailPage /> },
  { path: "/bookings/:bookingId/confirmed", chrome: AppShell1, render: () => <BookingsDetailConfirmedPage /> },
  { path: "/profile/delete-account/preview", chrome: AppShell1, render: () => <ProfileDeleteAccountPreviewPage /> },
  { path: "/trips/:tripId/passengers", chrome: AppShell1, render: () => <TripsDetailPassengersPage /> },
  { path: "/trips/:tripId/seats", chrome: AppShell1, render: () => <TripsDetailSeatsPage /> },
];

/** Where a click says it goes: the attributes the preview's own chrome already carries. */
function routeFromClickTarget(start: Element | null): string | null {
  for (let el = start; el !== null; el = el.parentElement) {
    const declared =
      el.getAttribute('data-route') ?? el.getAttribute('data-goto') ?? el.getAttribute('data-nav');
    if (declared !== null && declared.startsWith('/')) return declared;
    const href = el.getAttribute('href');
    if (href !== null && href.startsWith('#/')) return href.slice(1);
    // A real link out of the application: left alone.
    if (href !== null && href !== '' && !href.startsWith('#')) return null;
  }
  return null;
}

if (typeof document !== 'undefined') {
  // No cast: letting addEventListener infer from 'click' gives the DOM MouseEvent. Casting to
  // MouseEvent here would pick up React's type of that name if this file ever imports it, which
  // 'tsc --noEmit' refuses (TS2352) and the build's type-check gate would fail on.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    // A new-tab or new-window click is the browser's to handle, not ours.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const to = routeFromClickTarget(event.target as Element | null);
    if (to === null) return;
    event.preventDefault();
    navigate(to);
  });
}

/** Where an unknown address lands: the first screen of the approved preview. */
const HOME: MockupRoute = ROUTES[0] ?? { path: '/', chrome: null, render: () => <div /> };

function resolve(pathname: string): { route: MockupRoute; params: RouteParams } | null {
  const exact = ROUTES.find((r) => !hasParams(r.path) && normalisePath(r.path) === pathname);
  if (exact !== undefined) return { route: exact, params: {} };
  for (const r of ROUTES) {
    if (!hasParams(r.path)) continue;
    const params = matchPath(r.path, pathname);
    if (params !== null) return { route: r, params };
  }
  return null;
}

/** Which nav item belongs to which route — the preview's own NAV_MAP. */
const NAV_MAP: Readonly<Record<string, string>> = {
  "/": "/search",
  "/bookings": "/bookings",
  "/buses": "/buses",
  "/cities": "/cities",
  "/privacy": "/privacy",
  "/profile": "/profile",
  "/search": "/search",
  "/trips": "/trips",
  "/bookings/:bookingId": "/bookings",
  "/profile/change-password": "/profile",
  "/profile/sessions": "/profile",
  "/search/results": "/search",
  "/trips/:tripId": "/trips",
  "/bookings/:bookingId/confirmed": "/bookings",
  "/profile/delete-account/preview": "/profile",
  "/trips/:tripId/passengers": "/trips",
  "/trips/:tripId/seats": "/trips",
  "/login": "/login",
  "/signup": "/signup",
  "/forgot-password": "/forgot-password",
  "/auth/me": "/login",
  "/auth/security-questions": "/signup",
  "/auth/session": "/login",
  "/auth/forgot-password/question": "/forgot-password",
  "/auth/forgot-password/verify": "/forgot-password",
  "/auth/forgot-password/reset": "/forgot-password"
};

/**
 * Put the approved "is-active" class on the nav item for the page you are on.
 *
 * The preview did this from its own script, which the application does not carry. The class and
 * the map are both the preview's; this only applies them.
 */
function useActiveNav(pathname: string): void {
  useEffect(() => {
    const target = NAV_MAP[pathname] ?? pathname;
    for (const el of Array.from(document.querySelectorAll('[data-nav]'))) {
      el.classList.toggle("is-active", el.getAttribute('data-nav') === target);
    }
  }, [pathname]);
}

export function MockupApp(): ReactElement {
  const pathname = usePathname();
  const found = resolve(pathname);
  const route = found === null ? HOME : found.route;
  const page = route.render(found === null ? {} : found.params);
  const Frame = route.chrome;
  useActiveNav(pathname);
  return Frame === null ? page : <Frame>{page}</Frame>;
}

export default MockupApp;
