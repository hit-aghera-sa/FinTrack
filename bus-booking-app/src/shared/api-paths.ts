/**
 * THE API ADDRESS TABLE — declared ONCE for the whole product.
 *
 * The server composition root mounts the feature routers under {@link API_BASE_PATH} and answers any
 * other `/api` path with a 404 JSON body; the web client reaches the same surface through
 * `apiFetch`, whose base prefix is this same `/api`. Nothing here is a second spelling of an
 * address: a path appears in exactly one place and both sides read it from here.
 *
 * Pure constants and pure functions — no Express, no fetch, no state — so the client bundle, the
 * server build and a unit test can all import it.
 */

/** Every endpoint of this app lives under this prefix, served by the same host as the client. */
export const API_BASE_PATH = '/api';

/**
 * The app's endpoints, written WITHOUT the `/api` prefix — exactly as the feature routers declare
 * them, so `app.use(API_BASE_PATH, router)` puts each one at the address named here.
 */
export const API_PATHS = {
  /** Liveness, used by the platform and by the dev proxy. */
  health: '/health',

  login: '/auth/login',
  logout: '/auth/logout',
  me: '/auth/me',
  signup: '/auth/signup',
  securityQuestions: '/auth/security-questions',
  passwordResetQuestion: '/auth/password-reset/question',
  passwordResetVerify: '/auth/password-reset/verify',

  profile: '/profile',
  profilePassword: '/profile/password',
  profileSecurityQuestion: '/profile/security-question',
  profileSessions: '/profile/sessions',
  profileSessionsRevokeAll: '/profile/sessions/revoke-all',
  deleteAccountPreview: '/profile/delete-account/preview',
  deleteAccount: '/profile/delete-account',

  cities: '/cities',
  trips: '/trips',
  bookings: '/bookings',
} as const;

/** The name of one endpoint in {@link API_PATHS}. */
export type ApiPathName = keyof typeof API_PATHS;

/**
 * The full address of an endpoint: `apiUrl('/auth/me')` and `apiUrl('/api/auth/me')` both give
 * `/api/auth/me`, so a path that already carries the prefix is never prefixed twice.
 */
export function apiUrl(path: string): string {
  const rooted = path.startsWith('/') ? path : `/${path}`;
  if (rooted === API_BASE_PATH || rooted.startsWith(`${API_BASE_PATH}/`)) return rooted;
  return `${API_BASE_PATH}${rooted}`;
}

/**
 * True for a request address the API owns. `/api` and `/api/trips` are the API's; `/apifoo` and
 * `/search` are the client's, which is what keeps the single-page fallback off the API's ground.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === API_BASE_PATH || pathname.startsWith(`${API_BASE_PATH}/`);
}
