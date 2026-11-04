// src/features/login/LoginForm.tsx
//
// THE APPROVED LOOK OF /login — the markup, classes, words and geometry the client signed off, made
// functional. Nothing about the layout has changed: the same auth shell, card, brand block, title,
// two fields, Forgot password? link, primary action and sign-up footnote, in the same order. What was
// added is only what a real form needs — a <form> element so Enter submits, bound inputs, the shared
// Alert for the error and lockout notices, and disabled states while a call is in flight.
//
// It decides nothing: the container beside it (LogInScreen) owns the API call, the messages and the
// navigation.
//
// The file is named LoginForm so it cannot collide with the container's own file name, which differs
// from the old name of this file only in casing — a collision TypeScript refuses to compile.
import { useEffect, useRef, type FormEvent } from 'react';
import { Alert } from '../../ui/index.js';
import { IDENTIFIER_MAX, MOBILE_DIGITS, type LoginFailure } from './login-logic.js';

export interface LoginScreenProps {
  /** Mobile number as typed (digits only). */
  mobile: string;
  password: string;
  onMobileChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  /** Called when the form is submitted — by the button or by Enter in a field. */
  onSubmit: () => void;
  onForgotPassword: () => void;
  onSignUp: () => void;
  /** The sentence to show, or null when nothing has failed. */
  failure: LoginFailure | null;
  /** A log-in call is in flight. */
  submitting: boolean;
  /** The API has locked this account: the form refuses to send until the number changes. */
  blocked: boolean;
}

export function LoginScreen({
  mobile,
  password,
  onMobileChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
  onSignUp,
  failure,
  submitting,
  blocked,
}: LoginScreenProps): JSX.Element {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  // What the box itself must be able to receive in one go. A mobile number is held to ten digits
  // where the value is normalised (see login-logic), so the browser's own cap only has to be long
  // enough for the longest identifier the field accepts — the e-mail address an operator account
  // signs in with, which a ten-character cap would clip as it is typed or pasted in one go.
  const identityBox = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    identityBox.current?.setAttribute('maxlength', String(IDENTIFIER_MAX));
  }, []);

  const marksFields = failure !== null && (failure.kind === 'invalid' || failure.kind === 'locked');
  const invalid = marksFields ? 'true' : undefined;

  return (
    <div data-screen="/login" data-testid="log-in-screen-page">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="sidebar-mark">Bus Booking App</div>
            <span>Bus Booking</span>
          </div>
          <h1 className="auth-title">Log in</h1>
          <form className="form" onSubmit={handleSubmit} noValidate>
            {failure !== null ? (
              <Alert kind="error">
                <span data-testid="log-in-screen-message">{failure.message}</span>
              </Alert>
            ) : null}
            <div className="field">
              <label className="field-label" htmlFor="login-mobile">
                Mobile number
              </label>
              <input
                className="input"
                id="login-mobile"
                name="mobile"
                type={mobile.includes('@') ? 'email' : 'tel'}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={mobile.includes('@') ? undefined : MOBILE_DIGITS}
                ref={identityBox}
                  placeholder="9876543210"
                value={mobile}
                disabled={submitting}
                aria-invalid={invalid}
                data-testid="log-in-screen-mobile"
                onChange={(event) => onMobileChange(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <input
                className="input"
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                disabled={submitting}
                aria-invalid={invalid}
                data-testid="log-in-screen-password"
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
            <div className="form-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                className="text-link"
                data-testid="log-in-screen-forgot-password"
                onClick={onForgotPassword}
              >
                Forgot password?
              </button>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="button button-primary"
                disabled={submitting || blocked}
                data-testid="log-in-screen-submit"
              >
                {submitting ? 'Logging in…' : 'Log in'}
              </button>
            </div>
          </form>
          <p className="auth-footnote">
            New here?{' '}
            <button type="button" className="text-link" data-testid="log-in-screen-signup" onClick={onSignUp}>
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
