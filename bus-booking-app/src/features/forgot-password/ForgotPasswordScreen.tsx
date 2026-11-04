// src/features/forgot-password/ForgotPasswordScreen.tsx
//
// THE FORGOT PASSWORD FLOW — one route, /forgot-password, three in-screen steps:
//
//   1. the mobile number            2. the security question the API reads back, answered
//   3. the new password, which is set and signs the traveller straight in on Search
//
// The approved auth-page look is kept exactly as the client signed it off (auth-shell / auth-card /
// auth-brand / auth-title / notice / form / field / input / form-actions / button-* / auth-footnote),
// with the shared Alert for a refusal. No colour, class or stylesheet of its own.
//
// Because the API answers with a security question for ANY well-formed number, nothing on this screen
// ever tells a visitor whether a number has an account.
import { useState, type FormEvent } from 'react';
import { Alert } from '../../ui/index.js';
import { navigate } from '../../router';
import { LOGIN_PATH, setSessionUser } from '../../session/index.js';
import {
  createResetApi,
  describeResetError,
  isAnswerRejected,
  type SecurityQuestionPrompt,
} from './reset-flow.js';
import {
  normaliseMobileInput,
  validateAnswer,
  validateMobile,
  validateNewPassword,
} from './validation.js';

/** Where a completed reset lands: the authenticated Search screen. */
export const SEARCH_PATH = '/search';

type Step = 'mobile' | 'question' | 'password';

const STEP_ORDER: readonly Step[] = ['mobile', 'question', 'password'];

const STEP_LABELS: Record<Step, string> = {
  mobile: 'Mobile number',
  question: 'Security question',
  password: 'New password',
};

const STEP_NOTICES: Record<Step, string> = {
  mobile: 'Enter the mobile number of the account. Your security question comes next.',
  question: 'Answer your security question to continue. Answers are not case-sensitive.',
  password: 'Choose a new password. Your answer is checked when you save it.',
};

const resetApi = createResetApi();

export function ForgotPasswordScreen(): JSX.Element {
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState<string>('');
  const [question, setQuestion] = useState<SecurityQuestionPrompt | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const mobileDigits = normaliseMobileInput(mobile);
  const questionLabel = question === null ? 'Security question' : question.label;
  const stepNumber = STEP_ORDER.indexOf(step) + 1;

  async function askQuestion(): Promise<void> {
    const refusal = validateMobile(mobile);
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await resetApi.question(mobileDigits);
      setQuestion(next);
      setAnswer('');
      setStep('question');
    } catch (failure: unknown) {
      setError(describeResetError(failure));
    } finally {
      setBusy(false);
    }
  }

  function goToPasswordStep(): void {
    const refusal = validateAnswer(answer);
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setError(null);
    setStep('password');
  }

  async function savePassword(): Promise<void> {
    const refusal = validateNewPassword(password, confirmPassword);
    if (refusal !== null) {
      setError(refusal);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await resetApi.verify({
        mobile: mobileDigits,
        answer: answer.trim(),
        newPassword: password,
        confirmPassword,
      });
      setSessionUser(user);
      navigate(SEARCH_PATH);
    } catch (failure: unknown) {
      const message = describeResetError(failure);
      setError(message);
      if (isAnswerRejected(message)) {
        setAnswer('');
        setPassword('');
        setConfirmPassword('');
        setStep('question');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (step === 'mobile') {
      await askQuestion();
      return;
    }
    if (step === 'question') {
      goToPasswordStep();
      return;
    }
    await savePassword();
  }

  function goBack(): void {
    setError(null);
    if (step === 'password') {
      setStep('question');
      return;
    }
    setStep('mobile');
  }

  const submitLabel = busy
    ? 'Working…'
    : step === 'password'
      ? 'Set password & log in'
      : 'Continue';

  return (
    <div data-screen="/forgot-password" data-testid="forgot-password-screen-page">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="sidebar-mark">Bus Booking App</div>
            <span>Bus Booking</span>
          </div>
          <h1 className="auth-title">Forgot password</h1>
          <p className="field-hint" data-testid="forgot-password-screen-step">
            Step {stepNumber} of 3 — {STEP_LABELS[step]}
          </p>
          <div className="notice">
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4m0-4h.01"></path>
            </svg>
            {STEP_NOTICES[step]}
          </div>
          {error !== null ? (
            <div data-testid="forgot-password-screen-error">
              <Alert kind="error">{error}</Alert>
            </div>
          ) : null}
          <form
            className="form"
            noValidate
            aria-busy={busy}
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            {step === 'mobile' ? (
              <div className="field">
                <label className="field-label" htmlFor="forgot-password-mobile">
                  Mobile number
                </label>
                <input
                  className="input"
                  id="forgot-password-mobile"
                  data-testid="forgot-password-screen-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  disabled={busy}
                  onChange={(event) => setMobile(normaliseMobileInput(event.target.value))}
                />
                <span className="field-hint">We will show your security question next.</span>
              </div>
            ) : null}

            {step !== 'mobile' ? (
              <div className="field">
                <label className="field-label" htmlFor="forgot-password-mobile-entered">
                  Mobile number
                </label>
                <input
                  className="input"
                  id="forgot-password-mobile-entered"
                  value={mobileDigits}
                  readOnly
                  disabled
                />
              </div>
            ) : null}

            {step === 'question' ? (
              <div className="field">
                <label className="field-label" htmlFor="forgot-password-answer">
                  {questionLabel}
                </label>
                <input
                  className="input"
                  id="forgot-password-answer"
                  data-testid="forgot-password-screen-answer"
                  type="text"
                  autoComplete="off"
                  placeholder="Your answer"
                  value={answer}
                  disabled={busy}
                  onChange={(event) => setAnswer(event.target.value)}
                />
              </div>
            ) : null}

            {step === 'password' ? (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="forgot-password-new">
                    New password
                  </label>
                  <input
                    className="input"
                    id="forgot-password-new"
                    data-testid="forgot-password-screen-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters, letters and numbers"
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="forgot-password-confirm">
                    Confirm new password
                  </label>
                  <input
                    className="input"
                    id="forgot-password-confirm"
                    data-testid="forgot-password-screen-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    disabled={busy}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div className="form-actions">
              <button
                type="submit"
                className="button button-primary"
                data-testid="forgot-password-screen-submit"
                disabled={busy}
              >
                {submitLabel}
              </button>
              {step === 'mobile' ? (
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={busy}
                  onClick={() => navigate(LOGIN_PATH)}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-secondary"
                  data-testid="forgot-password-screen-back"
                  disabled={busy}
                  onClick={goBack}
                >
                  Back
                </button>
              )}
            </div>
          </form>
          <p className="auth-footnote">
            Remembered your password?{' '}
            <button type="button" className="text-link" onClick={() => navigate(LOGIN_PATH)}>
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordScreen;
