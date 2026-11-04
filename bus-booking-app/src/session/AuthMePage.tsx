// src/session/AuthMePage.tsx
//
// THE BEHAVIOUR OF /auth/me: what the session context knows about the signed-in traveller.
//
// There is nothing device-specific to fetch here — the session is already in memory, read once from
// GET /api/auth/me through the session store — so this container only chooses between the three
// states: still reading the session, nobody signed in, and the approved screen with real values.
import { SECURITY_QUESTIONS } from '../models/accounts/index.js';
import type { SecurityQuestion } from '../models/accounts/index.js';
import { navigate } from '../router';
import { Spinner } from '../ui/index';
import AuthMeScreen from './AuthMeScreen';
import { LOGIN_PATH, useSession } from './SessionProvider';

/** The page's test hook, shared by every state so the suite can wait for the page itself. */
const PAGE_TEST_ID = 'web-api-client-session-context-page';

const SESSION_NOTE = 'Signed in on this browser, kept in a server-backed cookie until you log out.';

export function AuthMePage(): JSX.Element {
  const { user, status } = useSession();

  if (status === 'loading') {
    return (
      <div data-testid={PAGE_TEST_ID}>
        <Spinner label="Loading your session…" />
      </div>
    );
  }

  if (user === null) {
    return (
      <div data-testid={PAGE_TEST_ID}>
        <div className="notice">
          You are not logged in on this browser. Log in and your account, bookings and session appear here.
        </div>
        <div className="form-actions">
          <button type="button" className="button button-primary" onClick={() => navigate(LOGIN_PATH)}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  const question = SECURITY_QUESTIONS.find(
    (candidate: SecurityQuestion) => candidate.id === user.securityQuestionId,
  );

  return (
    <div data-testid={PAGE_TEST_ID}>
      <AuthMeScreen
        fullName={user.fullName}
        mobile={user.mobile}
        securityQuestion={question === undefined ? 'Not set' : question.label}
        sessionNote={SESSION_NOTE}
        onGoToProfile={() => navigate('/profile')}
      />
    </div>
  );
}

export default AuthMePage;
