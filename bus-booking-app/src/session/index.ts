/**
 * THE SESSION OF THE WEB APP — one import path for every screen that needs the signed-in traveller.
 *
 * The entry module wraps the app in `SessionProvider`; screens read `useSession()`; a guarded page is
 * wrapped in `RequireAuth`; the shell's account area takes `useAccountUser` / `signOut` /
 * `LOGIN_PATH`. Nothing here keeps the credential in device-only storage: it is the server's
 * http-only cookie, so one account follows the traveller between any phone browser and any desktop.
 */
export { LOGIN_PATH, RequireAuth, SessionProvider, signOut, useAccountUser, useSession } from './SessionProvider';
export type { AccountUser, SessionValue } from './SessionProvider';
export {
  SESSION_PATHS,
  clearSessionUser,
  ensureSessionLoaded,
  getSessionState,
  loginSession,
  logoutSession,
  refreshSession,
  setSessionUser,
  subscribeToSession,
} from './store.js';
export type { SessionState, SessionStatus } from './store.js';
export { describeDevice, describeThisDevice } from './device.js';
