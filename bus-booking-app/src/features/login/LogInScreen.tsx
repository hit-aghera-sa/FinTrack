// src/features/login/LogInScreen.tsx
//
// THE BEHAVIOUR OF /login.
//
//   • an already-signed-in visitor never sees the form: the session is restored by the session lane
//     and this screen sends them straight to /search;
//   • a submitted form calls the real API through the session (POST /api/auth/login), so the session
//     cookie the server issues is what keeps the traveller signed in across restarts;
//   • a refused credential shows "Mobile number or password is incorrect." without saying which field
//     was wrong; the API's lockout shows the 15-minute sentence and stops this screen attempting that
//     number again until it is changed or the API accepts a new attempt;
//   • a backend that cannot be reached shows the no-internet sentence.
import { useEffect, useState } from 'react';
import { navigate } from '../../router';
import { useSession } from '../../session/index.js';
import { MESSAGES } from '../../messages/index.js';
import { LoginScreen } from './LoginForm';
import {
  classifyLoginFailure,
  isAttemptBlocked,
  missingCredentials,
  normaliseMobileInput,
  type LoginFailure,
} from './login-logic.js';

/** Where a signed-in traveller belongs, and the two other addresses this screen offers. */
const SEARCH_PATH = '/search';
const FORGOT_PASSWORD_PATH = '/forgot-password';
const SIGN_UP_PATH = '/signup';

export function LogInScreen(): JSX.Element {
  const session = useSession();
  const status = session.status;

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<LoginFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedMobile, setLockedMobile] = useState<string | null>(null);

  // A restored session means the traveller is already signed in: open Search instead of the form.
  useEffect(() => {
    if (status === 'authenticated') navigate(SEARCH_PATH);
  }, [status]);

  const blocked = isAttemptBlocked(mobile, lockedMobile);

  const handleMobileChange = (value: string): void => {
    const next = normaliseMobileInput(value);
    setMobile(next);
    // Typing a different number lifts the lockout block, and with it the lockout notice.
    if (!isAttemptBlocked(next, lockedMobile)) setFailure(null);
  };

  const handlePasswordChange = (value: string): void => {
    setPassword(value);
    if (!blocked) setFailure(null);
  };

  const handleSubmit = (): void => {
    if (submitting) return;

    if (blocked) {
      setFailure({ kind: 'locked', message: MESSAGES.accountLocked });
      return;
    }

    if (missingCredentials(mobile, password)) {
      setFailure({ kind: 'invalid', message: MESSAGES.loginIncorrect });
      return;
    }

    setSubmitting(true);
    setFailure(null);

    void session
      .login(mobile, password)
      .then(() => {
        setSubmitting(false);
        setLockedMobile(null);
        setPassword('');
        navigate(SEARCH_PATH);
      })
      .catch((error: unknown) => {
        const next = classifyLoginFailure(error);
        setSubmitting(false);
        setFailure(next);
        setLockedMobile(next.kind === 'locked' ? mobile : null);
      });
  };

  return (
    <LoginScreen
      mobile={mobile}
      password={password}
      onMobileChange={handleMobileChange}
      onPasswordChange={handlePasswordChange}
      onSubmit={handleSubmit}
      onForgotPassword={() => navigate(FORGOT_PASSWORD_PATH)}
      onSignUp={() => navigate(SIGN_UP_PATH)}
      failure={failure}
      submitting={submitting}
      blocked={blocked}
    />
  );
}

export default LogInScreen;
