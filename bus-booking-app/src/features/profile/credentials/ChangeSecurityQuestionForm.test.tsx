// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MESSAGES } from '../../../messages/index.js';
import { SECURITY_QUESTIONS } from '../../../models/accounts/index.js';
import { ChangeSecurityQuestionForm } from './ChangeSecurityQuestionForm';
import {
  CURRENT_PASSWORD_REQUIRED_MESSAGE,
  SECURITY_ANSWER_REQUIRED_MESSAGE,
  SECURITY_QUESTION_CHANGED_MESSAGE,
  SECURITY_QUESTION_REQUIRED_MESSAGE,
} from './validation.js';

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly body: string;
}

let calls: RecordedCall[] = [];
let status = 200;
let responseBody = '';
let rejectWith: Error | null = null;

const originalFetch = globalThis.fetch;
const FIRST_QUESTION = SECURITY_QUESTIONS[0];

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
  fireEvent.change(screen.getByLabelText('Security question'), { target: { value: FIRST_QUESTION.id } });
  fireEvent.change(screen.getByLabelText('Security answer'), { target: { value: 'Meera' } });
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Travel@123' } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Save security question' }));
}

beforeEach(() => {
  calls = [];
  status = 200;
  responseBody = JSON.stringify({
    id: 'traveller',
    fullName: 'Aisha Kapoor',
    mobile: '9876543210',
    securityQuestionId: FIRST_QUESTION.id,
  });
  rejectWith = null;
  globalThis.fetch = stubFetch as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe('ChangeSecurityQuestionForm', () => {
  it('guards the change: nothing is posted until the question, answer and password are given', async () => {
    render(<ChangeSecurityQuestionForm />);
    save();

    expect(await screen.findByText(SECURITY_QUESTION_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(SECURITY_ANSWER_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_PASSWORD_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('still asks for the current password when only the question and answer are given', async () => {
    render(<ChangeSecurityQuestionForm />);
    fireEvent.change(screen.getByLabelText('Security question'), { target: { value: FIRST_QUESTION.id } });
    fireEvent.change(screen.getByLabelText('Security answer'), { target: { value: 'Meera' } });
    save();

    expect(await screen.findByText(CURRENT_PASSWORD_REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('posts the new question, confirms it and clears the answer and password', async () => {
    render(<ChangeSecurityQuestionForm />);
    fillValidChange();
    save();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/profile/security-question');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toContain(FIRST_QUESTION.id);

    expect(await screen.findByText(SECURITY_QUESTION_CHANGED_MESSAGE)).toBeInTheDocument();

    const answer = screen.getByLabelText('Security answer') as HTMLInputElement;
    const password = screen.getByLabelText('Current password') as HTMLInputElement;
    const question = screen.getByLabelText('Security question') as HTMLSelectElement;
    expect(answer.value).toBe('');
    expect(password.value).toBe('');
    expect(question.value).toBe(FIRST_QUESTION.id);
  });

  it('surfaces a refusal from the server without claiming success', async () => {
    status = 400;
    responseBody = JSON.stringify({
      error: { code: 'invalid_credentials', message: MESSAGES.currentPasswordIncorrect },
    });

    render(<ChangeSecurityQuestionForm />);
    fillValidChange();
    save();

    const feedback = await screen.findByTestId(
      'profile-screen-profile-credential-change-forms-question-feedback',
    );
    expect(feedback.textContent ?? '').not.toBe('');
    expect(screen.queryByText(SECURITY_QUESTION_CHANGED_MESSAGE)).toBeNull();
  });

  it('shows the no-internet sentence when the request never reaches the API', async () => {
    rejectWith = new TypeError('Failed to fetch');

    render(<ChangeSecurityQuestionForm />);
    fillValidChange();
    save();

    expect(await screen.findByText(MESSAGES.offline)).toBeInTheDocument();
  });
});
