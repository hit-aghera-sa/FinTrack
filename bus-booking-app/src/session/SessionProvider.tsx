import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { navigate } from '../router';
import { Spinner } from '../ui/index';
import type { AuthUser } from '../models/accounts/index.js';
import {
  ensureSessionLoaded,
  getSessionState,
  loginSession,
  logoutSession,
  refreshSession,
  setSessionUser,
  subscribeToSession,
  type SessionStatus,
} from './store.js';

/**
 * THE SESSION CONTEXT OF THE WEB APP.
 *
 * `SessionProvider` starts the one "who is signed in?" call per page load; `useSession` hands any
 * screen the signed-in traveller plus log in / log out / refresh; `RequireAuth` sends a signed-out
 * visitor to the log-in screen. The credential itself is the server's http-only cookie, so the
 * session survives a browser restart and follows the traveller to any other browser they sign in on.
 */

/** Where a signed-out visitor is sent. The app's log-in screen lives here. */
export const LOGIN_PATH = '/login';

export interface SessionValue {
  user: AuthUser | null;
  status: SessionStatus;
  login(mobile: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  setUser(user: AuthUser): void;
}

/** Wraps the app once (from the entry module) so the session is fetched as the app starts. */
export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    void ensureSessionLoaded();
  }, []);
  return <>{children}</>;
}

/** The signed-in traveller and the three things a screen does with a session. */
export function useSession(): SessionValue {
  const state = useSyncExternalStore(subscribeToSession, getSessionState, getSessionState);

  useEffect(() => {
    void ensureSessionLoaded();
  }, []);

  const login = useCallback((mobile: string, password: string): Promise<void> => loginSession(mobile, password), []);
  const logout = useCallback((): Promise<void> => logoutSession(), []);
  const refresh = useCallback((): Promise<void> => refreshSession(), []);
  const setUser = useCallback((user: AuthUser): void => {
    setSessionUser(user);
  }, []);

  return useMemo<SessionValue>(
    () => ({ user: state.user, status: state.status, login, logout, refresh, setUser }),
    [state, login, logout, refresh, setUser],
  );
}

/**
 * Guards a page: the children render only for a signed-in traveller. While the session is still being
 * read there is a spinner (never a flash of the log-in screen), and a signed-out visitor is sent to
 * the log-in screen.
 */
export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'anonymous') navigate(LOGIN_PATH);
  }, [status]);

  if (status === 'authenticated') return <>{children}</>;

  if (status === 'loading') {
    return (
      <div data-testid="web-api-client-session-context-guard">
        <Spinner label="Checking your session…" />
      </div>
    );
  }

  return (
    <div data-testid="web-api-client-session-context-guard">
      <div className="notice">Please log in to continue. Taking you to the log in screen…</div>
    </div>
  );
}

/** What the app shell's account area shows: the person's name, or null/undefined when signed out/unknown. */
export interface AccountUser {
  name: string;
  email?: string;
}

/**
 * The session hook the app shell's route table uses for its account area: `undefined` while the
 * session is still being read, `null` when nobody is signed in.
 */
export function useAccountUser(): AccountUser | null | undefined {
  const { user, status } = useSession();
  if (status === 'loading') return undefined;
  if (user === null) return null;
  return { name: user.fullName };
}

/** Ends the session — the shell's "Log out" entry calls this. */
export async function signOut(): Promise<void> {
  await logoutSession();
}
