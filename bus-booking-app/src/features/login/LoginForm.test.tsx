// @vitest-environment jsdom
//
// THE APPROVED /login MARKUP, UNDER TEST.
//
// `LoginScreen` (in LoginForm.tsx) is the presentation half of this feature: it takes everything it
// shows as props and decides nothing, so it can be rendered on its own — no session, no API, no
// router. What is checked here is exactly what the client signed off and what the acceptance suite
// looks for: the words on the screen, the test hooks, the two catalogue sentences, and the states
// that stop a traveller sending a call that cannot succeed.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MESSAGES } from '../../messages/index.js';
import { LoginScreen, type LoginScreenProps } from './LoginForm';

afterEach(() => {
  cleanup();
});

/** The screen with every prop supplied, so no required field is ever left undefined. */
function renderForm(overrides: Partial<LoginScreenProps> = {}): LoginScreenProps {
  const props: LoginScreenProps = {
    mobile: '',
    password: '',
    onMobileChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSubmit: vi.fn(),
    onForgotPassword: vi.fn(),
    onSignUp: vi.fn(),
    failure: null,
    submitting: false,
    blocked: false,
    ...overrides,
  };
  render(<LoginScreen {...props} />);
  return props;
}

describe('LoginScreen anchors', () => {
  it('carries the page test hook the acceptance suite waits for', () => {
    renderForm();

    expect(screen.getByTestId('log-in-screen-page')).toBeInTheDocument();
  });

  it('shows the title, both field labels and the two links', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByTestId('log-in-screen-forgot-password')).toHaveTextContent('Forgot password?');
    expect(screen.getByTestId('log-in-screen-signup')).toHaveTextContent('Sign up');
  });

  it('keeps the mobile field on a numeric keypad and no longer than an identifier', () => {
    renderForm();
    const field = screen.getByTestId('log-in-screen-mobile');

    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveAttribute('maxlength', '160');
  });

  it('says nothing has failed until something has', () => {
    renderForm();

    expect(screen.queryByTestId('log-in-screen-message')).toBeNull();
  });
});

describe('LoginScreen failures', () => {
  it('shows the refused-credential sentence without naming a field', () => {
    renderForm({ failure: { kind: 'invalid', message: MESSAGES.loginIncorrect } });

    expect(screen.getByTestId('log-in-screen-message')).toHaveTextContent(MESSAGES.loginIncorrect);
  });

  it('shows the 15-minute lockout sentence and refuses to send again', () => {
    renderForm({ failure: { kind: 'locked', message: MESSAGES.accountLocked }, blocked: true });

    expect(screen.getByTestId('log-in-screen-message')).toHaveTextContent(MESSAGES.accountLocked);
    expect(screen.getByTestId('log-in-screen-submit')).toBeDisabled();
  });

  it('shows the no-internet sentence when the backend was never reached', () => {
    renderForm({ failure: { kind: 'offline', message: MESSAGES.offline } });

    expect(screen.getByTestId('log-in-screen-message')).toHaveTextContent(MESSAGES.offline);
  });

  it('marks both fields as invalid for a refusal, so neither is singled out', () => {
    renderForm({ failure: { kind: 'invalid', message: MESSAGES.loginIncorrect } });

    expect(screen.getByTestId('log-in-screen-mobile')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('log-in-screen-password')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('LoginScreen interaction', () => {
  it('reports what was typed in each field', () => {
    const props = renderForm();

    fireEvent.change(screen.getByTestId('log-in-screen-mobile'), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByTestId('log-in-screen-password'), { target: { value: 'Travel@123' } });

    expect(props.onMobileChange).toHaveBeenCalledWith('9876543210');
    expect(props.onPasswordChange).toHaveBeenCalledWith('Travel@123');
  });

  it('submits once when the form is sent', () => {
    const props = renderForm({ mobile: '9876543210', password: 'Travel@123' });

    fireEvent.click(screen.getByTestId('log-in-screen-submit'));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('offers the way to the reset flow and to sign up', () => {
    const props = renderForm();

    fireEvent.click(screen.getByTestId('log-in-screen-forgot-password'));
    fireEvent.click(screen.getByTestId('log-in-screen-signup'));

    expect(props.onForgotPassword).toHaveBeenCalledTimes(1);
    expect(props.onSignUp).toHaveBeenCalledTimes(1);
  });

  it('locks the form down while a log-in call is in flight', () => {
    renderForm({ mobile: '9876543210', password: 'Travel@123', submitting: true });

    expect(screen.getByTestId('log-in-screen-submit')).toBeDisabled();
    expect(screen.getByTestId('log-in-screen-mobile')).toBeDisabled();
    expect(screen.getByTestId('log-in-screen-password')).toBeDisabled();
  });

  it('can be sent once both fields carry something and nothing is locked', () => {
    renderForm({ mobile: '9876543210', password: 'Travel@123' });

    expect(screen.getByTestId('log-in-screen-submit')).toBeEnabled();
  });
});
