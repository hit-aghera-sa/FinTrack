import { describe, expect, it } from 'vitest';
import { ApiError, UNEXPECTED_MESSAGE, type ApiRequestInit } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import {
  QUESTION_PATH,
  VERIFY_PATH,
  createResetApi,
  describeResetError,
  isAnswerRejected,
  type ApiCall,
} from './reset-flow.js';

interface RecordedCall {
  path: string;
  method: string | undefined;
  body: unknown;
}

function recordingCall(result: unknown, calls: RecordedCall[]): ApiCall {
  return <T,>(path: string, init?: ApiRequestInit): Promise<T> => {
    calls.push({ path, method: init?.method, body: init?.body });
    return Promise.resolve(result as T);
  };
}

describe('password reset API calls', () => {
  it('asks the question endpoint for the mobile number that was entered', async () => {
    const calls: RecordedCall[] = [];
    const api = createResetApi(
      recordingCall({ securityQuestionId: 'MOTHER_NAME', label: 'Mother name?' }, calls),
    );

    const prompt = await api.question('9876543210');

    expect(prompt.label).toBe('Mother name?');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(QUESTION_PATH);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({ mobile: '9876543210' });
  });

  it('sends the answer and both password fields to the verify endpoint and returns the traveller', async () => {
    const calls: RecordedCall[] = [];
    const api = createResetApi(
      recordingCall(
        {
          user: {
            id: 'user-a1',
            fullName: 'Priya Sharma',
            mobile: '9876543210',
            securityQuestionId: 'MOTHER_NAME',
          },
        },
        calls,
      ),
    );

    const user = await api.verify({
      mobile: '9876543210',
      answer: 'Meera',
      newPassword: 'Yatra2024',
      confirmPassword: 'Yatra2024',
    });

    expect(user.fullName).toBe('Priya Sharma');
    expect(calls[0]?.path).toBe(VERIFY_PATH);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toEqual({
      mobile: '9876543210',
      answer: 'Meera',
      newPassword: 'Yatra2024',
      confirmPassword: 'Yatra2024',
    });
  });
});

describe('describeResetError', () => {
  it('shows the server sentence for a refused reset', () => {
    const failure = new ApiError(400, 'wrong_answer', MESSAGES.wrongSecurityAnswer);
    expect(describeResetError(failure)).toBe(MESSAGES.wrongSecurityAnswer);
  });

  it('shows the no-internet sentence when the request never reached the backend', () => {
    expect(describeResetError(new ApiError(0, 'offline', MESSAGES.offline))).toBe(MESSAGES.offline);
  });

  it('falls back to the generic sentence for something unrecognisable', () => {
    expect(describeResetError({ unexpected: true })).toBe(UNEXPECTED_MESSAGE);
  });
});

describe('isAnswerRejected', () => {
  it('is true for the wrong-answer and the blocked sentences only', () => {
    expect(isAnswerRejected(MESSAGES.wrongSecurityAnswer)).toBe(true);
    expect(isAnswerRejected(MESSAGES.resetBlocked)).toBe(true);
    expect(isAnswerRejected(MESSAGES.passwordMismatch)).toBe(false);
  });
});
