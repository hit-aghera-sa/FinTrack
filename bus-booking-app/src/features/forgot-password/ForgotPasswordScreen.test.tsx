// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MESSAGES } from '../../messages/index.js';
import { ForgotPasswordScreen, SEARCH_PATH } from './ForgotPasswordScreen';
import { MOBILE_RULE_MESSAGE } from './validation.js';

const QUESTION_LABEL = 'What is your mother first name?';

const QUESTION_BODY = { securityQuestionId: 'MOTHER_NAME', label: QUESTION_LABEL };

const USER_BODY = {
  user: {
    id: 'user-a1',
    fullName: 'Priya Sharma',
    mobile: '9876543210',
    securityQuestionId: 'MOTHER_NAME',
  },
};

/** The three members of `Response` the shared API client reads. */
interface ResponseShim {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
  const shim: ResponseShim = {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
  return Promise.resolve(shim as unknown as Response);
}

function installFetch(handler: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => handler(String(input)));
}

async function reachTheAnswerStep(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText(QUESTION_LABEL);
}

beforeEach(() => {
  window.history.pushState({}, '', '/forgot-password');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ForgotPasswordScreen', () => {
  it('walks the three steps and lands the traveller on the search screen', async () => {
    installFetch((url) => {
      if (url.includes('/auth/password-reset/question')) return jsonResponse(200, QUESTION_BODY);
      if (url.includes('/auth/password-reset/verify')) return jsonResponse(200, USER_BODY);
      return jsonResponse(404, { error: { code: 'not_found', message: 'No such endpoint.' } });
    });

    render(<ForgotPasswordScreen />);
    expect(screen.getByRole('heading', { name: 'Forgot password' })).toBeInTheDocument();

    await reachTheAnswerStep();

    fireEvent.change(screen.getByLabelText(QUESTION_LABEL), { target: { value: 'Meera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'Yatra2024' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Yatra2024' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password & log in' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe(SEARCH_PATH);
    });
  });

  it('shows the wrong-answer sentence and returns to the question step', async () => {
    installFetch((url) => {
      if (url.includes('/auth/password-reset/question')) return jsonResponse(200, QUESTION_BODY);
      return jsonResponse(400, {
        error: { code: 'wrong_answer', message: MESSAGES.wrongSecurityAnswer },
      });
    });

    render(<ForgotPasswordScreen />);
    await reachTheAnswerStep();

    fireEvent.change(screen.getByLabelText(QUESTION_LABEL), { target: { value: 'Mango' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'Yatra2024' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'Yatra2024' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set password & log in' }));

    expect(await screen.findByText(MESSAGES.wrongSecurityAnswer)).toBeInTheDocument();
    expect(await screen.findByLabelText(QUESTION_LABEL)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/forgot-password');
  });

  it('refuses a badly formed mobile number without calling the API', async () => {
    const stub = vi.fn(() => jsonResponse(200, QUESTION_BODY));
    vi.stubGlobal('fetch', stub);

    render(<ForgotPasswordScreen />);
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(MOBILE_RULE_MESSAGE)).toBeInTheDocument();
    expect(stub).not.toHaveBeenCalled();
  });
});
