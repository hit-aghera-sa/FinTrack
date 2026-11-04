import { ApiError, apiFetch } from '../api/index.js';
import type { AuthUser } from '../models/accounts/index.js';

/**
 * THE SIGNED-IN TRAVELLER, held in one place for the whole browser tab.
 *
 * The session itself lives in the server's http-only cookie — nothing here is written to
 * localStorage, sessionStorage or any other device-only store, so signing in on a desktop browser
 * shows the same account and the same bookings as the phone browser.
 *
 * This module is a plain observable store, so it can be exercised without React and so `useSession`
 * works on any screen whether or not a provider happens to sit above it.
 */

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionState {
  readonly user: AuthUser | null;
  readonly status: SessionStatus;
}

/** The three endpoints of the session, as the auth router serves them under `/api`. */
export const SESSION_PATHS = {
  me: '/auth/me',
  login: '/auth/login',
  logout: '/auth/logout',
} as const;

type SessionListener = (state: SessionState) => void;

const ANONYMOUS: SessionState = { user: null, status: 'anonymous' };

let state: SessionState = { user: null, status: 'loading' };
const listeners = new Set<SessionListener>();
let bootstrap: Promise<void> | null = null;

function publish(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

/** The current session, as a stable object reference until it actually changes. */
export function getSessionState(): SessionState {
  return state;
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Adopt an account the server just confirmed (sign-up, a completed password reset, a profile edit). */
export function setSessionUser(user: AuthUser): void {
  bootstrap = Promise.resolve();
  publish({ user, status: 'authenticated' });
}

/** Forget the signed-in traveller in this tab. The server cookie is cleared by `logoutSession`. */
export function clearSessionUser(): void {
  publish(ANONYMOUS);
}

/**
 * Ask the server who is signed in. A 401 — and an unreachable backend — leave this browser
 * "anonymous", which is what the guard needs in order to send the visitor to the log-in screen.
 * Never rejects: the status is the answer.
 */
export async function refreshSession(): Promise<void> {
  try {
    const user = await apiFetch<AuthUser>(SESSION_PATHS.me);
    publish({ user, status: 'authenticated' });
  } catch (error: unknown) {
    if (error instanceof ApiError || error instanceof Error) {
      publish(ANONYMOUS);
      return;
    }
    publish(ANONYMOUS);
  }
}

/** Start the one "who is signed in?" call per page load, however many screens ask for it. */
export function ensureSessionLoaded(): Promise<void> {
  bootstrap ??= refreshSession();
  return bootstrap;
}

/**
 * Log in with a mobile number and password. The server answers with the account and sets the session
 * cookie; a wrong password or a locked account rejects with the catalogue's sentence as the
 * `ApiError` message, which the log-in screen shows as-is.
 */
export async function loginSession(mobile: string, password: string): Promise<void> {
  const user = await apiFetch<AuthUser>(SESSION_PATHS.login, {
    method: 'POST',
    body: { mobile, password },
  });
  bootstrap = Promise.resolve();
  publish({ user, status: 'authenticated' });
}

/** End the session on the server, then forget it here — even if the call itself failed. */
export async function logoutSession(): Promise<void> {
  try {
    await apiFetch<void>(SESSION_PATHS.logout, { method: 'POST' });
  } finally {
    bootstrap = Promise.resolve();
    publish(ANONYMOUS);
  }
}
