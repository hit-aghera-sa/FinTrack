import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import { SECURITY_QUESTIONS, type AuthUser } from '../../models/accounts/index.js';
import { Link, navigate } from '../../router';
import { refreshSession } from '../../session/index.js';
import { Alert, Button, SelectField, TextField } from '../../ui/index.js';
import { SIGNUP_STYLES } from './styles.js';
import {
  digitsOnly,
  hasErrors,
  isDuplicateMobileError,
  parseSecurityQuestions,
  SIGN_UP_PATHS,
  signUpErrorMessage,
  validateSignUpForm,
  type SignUpErrors,
  type SignUpFormValues,
  type SignUpQuestionOption,
} from './validation.js';

/**
 * ACCOUNT CREATION, END TO END.
 *
 * The picker is filled from `GET /api/auth/security-questions`; the form is submitted to
 * `POST /api/auth/signup`, which creates the account and sets the session cookie. On success the
 * client session is refreshed (so the shell knows who is signed in), the approved welcome sentence is
 * shown, and the traveller lands on Search.
 *
 * The mobile number is the login identifier only: no OTP, no email, no SMS — every confirmation in
 * this product is on screen.
 */

/** How long the welcome sentence stays on screen before Search opens. */
const REDIRECT_DELAY_MS = 900;

/** The four questions the domain already knows, used when the list cannot be fetched. */
const FALLBACK_QUESTIONS: readonly SignUpQuestionOption[] = SECURITY_QUESTIONS.map((question) => ({
  value: question.id,
  label: question.label,
}));

interface SignupResponse {
  readonly user?: Partial<AuthUser>;
}

function firstValue(options: readonly SignUpQuestionOption[]): string {
  const [first] = options;
  return first === undefined ? '' : first.value;
}

function emptyValues(): SignUpFormValues {
  return {
    fullName: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    securityQuestionId: firstValue(FALLBACK_QUESTIONS),
    securityAnswer: '',
  };
}

export function SignupForm(): JSX.Element {
  const [values, setValues] = useState<SignUpFormValues>(emptyValues);
  const [questions, setQuestions] = useState<readonly SignUpQuestionOption[]>(FALLBACK_QUESTIONS);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mobileApiError, setMobileApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const redirectRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const payload = await apiFetch<unknown>(SIGN_UP_PATHS.questions, { signal: controller.signal });
        if (cancelled) return;
        const parsed = parseSecurityQuestions(payload);
        if (parsed.length === 0) return;
        setQuestions(parsed);
        setValues((current) =>
          parsed.some((option) => option.value === current.securityQuestionId)
            ? current
            : { ...current, securityQuestionId: firstValue(parsed) },
        );
      } catch {
        // The list could not be reached: the four questions the domain already knows are offered,
        // and the server re-validates the chosen one on submit.
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(
    () => () => {
      if (redirectRef.current !== null) window.clearTimeout(redirectRef.current);
    },
    [],
  );

  const questionValues = useMemo<readonly string[]>(
    () => questions.map((option) => option.value),
    [questions],
  );

  const liveErrors = useMemo<SignUpErrors>(
    () => validateSignUpForm(values, questionValues),
    [values, questionValues],
  );

  // Before the first submit only the mismatch is called out, and only once something was typed into
  // Confirm password; afterwards every rule is reflected as the traveller corrects it.
  const visible: SignUpErrors = submitted
    ? liveErrors
    : values.confirmPassword !== '' && liveErrors.confirmPassword !== undefined
      ? { confirmPassword: liveErrors.confirmPassword }
      : {};

  const locked = submitting || success !== null;

  const patch = (next: Partial<SignUpFormValues>): void => {
    setValues((current) => ({ ...current, ...next }));
    setFormError(null);
  };

  const createAccount = async (): Promise<void> => {
    try {
      const created = await apiFetch<SignupResponse | undefined>(SIGN_UP_PATHS.signup, {
        method: 'POST',
        body: {
          fullName: values.fullName.trim(),
          mobile: values.mobile.trim(),
          password: values.password,
          confirmPassword: values.confirmPassword,
          securityQuestionId: values.securityQuestionId,
          securityAnswer: values.securityAnswer.trim(),
        },
      });

      const serverName = created?.user?.fullName;
      const name =
        typeof serverName === 'string' && serverName.trim() !== '' ? serverName.trim() : values.fullName.trim();
      setSuccess(MESSAGES.welcome(name));

      try {
        await refreshSession();
      } catch {
        // The session cookie is already set by the server; the shell loads the account on arrival.
      }

      redirectRef.current = window.setTimeout(() => {
        navigate('/search');
      }, REDIRECT_DELAY_MS);
    } catch (error: unknown) {
      setFormError(signUpErrorMessage(error));
      if (isDuplicateMobileError(error)) setMobileApiError(MESSAGES.duplicateMobile);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    if (locked) return;
    setFormError(null);
    if (hasErrors(validateSignUpForm(values, questionValues))) return;
    setSubmitting(true);
    void createAccount();
  };

  return (
    <form className="signup-form" data-testid="sign-up-screen-page" noValidate onSubmit={handleSubmit}>
      <style>{SIGNUP_STYLES}</style>

      <h1 className="signup-form-heading">Sign up</h1>
      <p className="signup-form-intro">
        Create your Bus Booking App account. Your 10-digit mobile number is how you log in, and you pay
        the bus staff in cash or UPI when boarding.
      </p>

      {success !== null ? (
        <div data-testid="sign-up-screen-success">
          <Alert kind="success">{success}</Alert>
        </div>
      ) : null}

      {formError !== null ? (
        <div data-testid="sign-up-screen-error">
          <Alert kind="error">{formError}</Alert>
        </div>
      ) : null}

      <TextField
        label="Full name"
        name="fullName"
        value={values.fullName}
        onChange={(value: string) => {
          patch({ fullName: value });
        }}
        type="text"
        placeholder="e.g. Aisha Kapoor"
        maxLength={60}
        required
        disabled={locked}
        error={visible.fullName ?? null}
      />

      <TextField
        label="Mobile number"
        name="mobile"
        value={values.mobile}
        onChange={(value: string) => {
          setMobileApiError(null);
          patch({ mobile: digitsOnly(value).slice(0, 10) });
        }}
        type="tel"
        placeholder="10-digit mobile number"
        maxLength={10}
        required
        disabled={locked}
        error={visible.mobile ?? mobileApiError}
      />

      <div className="signup-form-grid">
        <TextField
          label="Password"
          name="password"
          value={values.password}
          onChange={(value: string) => {
            patch({ password: value });
          }}
          type="password"
          placeholder="At least 8 characters"
          required
          disabled={locked}
          error={visible.password ?? null}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          value={values.confirmPassword}
          onChange={(value: string) => {
            patch({ confirmPassword: value });
          }}
          type="password"
          placeholder="Re-enter password"
          required
          disabled={locked}
          error={visible.confirmPassword ?? null}
        />
      </div>

      <SelectField
        label="Security question"
        name="securityQuestionId"
        value={values.securityQuestionId}
        onChange={(value: string) => {
          patch({ securityQuestionId: value });
        }}
        options={questions}
        required
        disabled={locked}
        error={visible.securityQuestionId ?? null}
      />

      <p className="signup-form-hint">
        Your security question is the only way to reset a forgotten password. The answer is compared
        without regard to capitals.
      </p>

      <TextField
        label="Security answer"
        name="securityAnswer"
        value={values.securityAnswer}
        onChange={(value: string) => {
          patch({ securityAnswer: value });
        }}
        type="text"
        placeholder="Your answer"
        maxLength={50}
        required
        disabled={locked}
        error={visible.securityAnswer ?? null}
      />

      <div className="signup-form-actions">
        <span data-testid="sign-up-screen-submit">
          <Button type="submit" variant="primary" loading={submitting} disabled={locked}>
            Sign up
          </Button>
        </span>
        {success !== null ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              navigate('/search');
            }}
          >
            Search buses
          </Button>
        ) : null}
      </div>

      <p className="signup-form-footnote">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}

export default SignupForm;
