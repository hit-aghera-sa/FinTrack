// src/session/AuthSessionPage.tsx
//
// THE BEHAVIOUR OF /auth/session: the live session this browser holds, and logging out of it.
//
// The session comes from the shared session context (one GET /api/auth/me per page load); logging out
// is a real POST /api/auth/logout, after which the traveller is taken to the log in screen. While the
// session is still being read there is a spinner; with nobody signed in there is a notice and a way in;
// a failed log out keeps the normal view and shows the error above it.
import { useState } from 'react';
import { isOfflineError } from '../api/index.js';
import { MESSAGES } from '../messages/index.js';
import { navigate } from '../router';
import { Alert, Spinner } from '../ui/index';
import AuthSessionScreen from './AuthSessionScreen';
import { describeThisDevice } from './device.js';
import { LOGIN_PATH, useSession } from './SessionProvider';

const PAGE_TEST_ID = 'web-api-client-session-context-page';

const SESSION_NOTE = 'Kept in a server-backed cookie, so it survives a browser restart.';

function messageFor(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (error instanceof Error && error.message !== '') return error.message;
  return MESSAGES.offline;
}

export function AuthSessionPage(): JSX.Element {
  const { user, status, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogOut = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await logout();
      navigate(LOGIN_PATH);
    } catch (caught: unknown) {
      setError(messageFor(caught));
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div data-testid={PAGE_TEST_ID}>
        <Spinner label="Checking your session…" />
      </div>
    );
  }

  if (user === null) {
    return (
      <div data-testid={PAGE_TEST_ID}>
        <div className="notice">No session on this browser. Log in to pick up your bookings where you left them.</div>
        <div className="form-actions">
          <button type="button" className="button button-primary" onClick={() => navigate(LOGIN_PATH)}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={PAGE_TEST_ID}>
      <AuthSessionScreen
        fullName={user.fullName}
        mobile={user.mobile}
        device={describeThisDevice()}
        sessionNote={SESSION_NOTE}
        busy={busy}
        banner={error === null ? undefined : <Alert kind="error">{error}</Alert>}
        onViewDevices={() => navigate('/profile/sessions')}
        onLogOut={() => {
          void handleLogOut();
        }}
      />
    </div>
  );
}

export default AuthSessionPage;
