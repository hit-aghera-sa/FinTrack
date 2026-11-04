// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MESSAGES } from '../../../messages/index.js';
import { ChangePasswordForm } from './ChangePasswordForm';
import { CURRENT_PASSWORD_REQUIRED_MESSAGE, PASSWORD_RULE_MESSAGE } from './validation.js';

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string;
}

let calls: RecordedCall[] = [];
let status = 204;
let responseBody = '';
let rejectWith: Error | null = null;

const originalFetch = globalThis.fetch;

function stubFetch(input: string | URL | Request, init?: RequestInit): Promise<unknown> {
  const url = typeof input === 'string' ? input : String(input);
  const body = typeof init?.body === 'string' ? init.body : '';
  calls.push({ url, method: init?.method ?? 'GET', body });
  if (rejectWith !== null) return Promise.reject(rejectWith);
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(responseBody),
  });
}

function fillValidChange(): void {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Travel@123' } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Travel1234' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Travel1234' } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
}

beforeEach(() => {
  calls = [];
  status = 204;
  responseBody = '';
  rejectWith = null;
  globalThis.fetch = stubFetch as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe('ChangePasswordForm', () => {
  it('asks for the current password and never calls the API when it is missing', async () => {
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Travel1234' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Travel1234' } });
    save();

    expect(await screen.findByText(CURRENT_PASSWORD_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('shows the catalogue mismatch sentence when the two new passwords differ', async () => {
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Travel@123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Travel1234' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Travel9999' } });
    save();

    expect(await screen.findByText(MESSAGES.passwordMismatch)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('refuses a new password that cannot satisfy the rule', async () => {
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Travel@123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'travel' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'travel' } });
    save();

    expect(await screen.findByText(PASSWORD_RULE_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('posts the change, confirms it and empties the form', async () => {
    render(<ChangePasswordForm />);
    fillValidChange();
    save();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/profile/password');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toContain('Travel1234');

    expect(await screen.findByText(MESSAGES.passwordChanged)).toBeInTheDocument();

    const current = screen.getByLabelText('Current password') as HTMLInputElement;
    const next = screen.getByLabelText('New password') as HTMLInputElement;
    const confirm = screen.getByLabelText('Confirm new password') as HTMLInputElement;
    expect(current.value).toBe('');
    expect(next.value).toBe('');
    expect(confirm.value).toBe('');
  });

  it('surfaces a refusal from the server and keeps the success line away', async () => {
    status = 400;
    responseBody = JSON.stringify({
      error: { code: 'invalid_credentials', message: MESSAGES.currentPasswordIncorrect },
    });

    render(<ChangePasswordForm />);
    fillValidChange();
    save();

    const feedback = await screen.findByTestId(
      'profile-screen-profile-credential-change-forms-password-feedback',
    );
    expect(feedback.textContent ?? '').not.toBe('');
    expect(screen.queryByText(MESSAGES.passwordChanged)).toBeNull();
  });

  it('shows the no-internet sentence when the request never reaches the API', async () => {
    rejectWith = new TypeError('Failed to fetch');

    render(<ChangePasswordForm />);
    fillValidChange();
    save();

    expect(await screen.findByText(MESSAGES.offline)).toBeInTheDocument();
  });
});
