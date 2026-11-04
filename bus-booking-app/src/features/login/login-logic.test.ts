import { describe, expect, it } from 'vitest';
import { ApiError, OFFLINE_CODE, OFFLINE_STATUS } from '../../api/index.js';
import { MESSAGES } from '../../messages/index.js';
import {
  MOBILE_DIGITS,
  classifyLoginFailure,
  isAttemptBlocked,
  isLockedFailure,
  missingCredentials,
  normaliseMobileInput,
} from './login-logic.js';

describe('classifyLoginFailure', () => {
  it('tells a refused credential in the catalogue words, naming neither field', () => {
    const failure = classifyLoginFailure(new ApiError(401, 'invalid_credentials', MESSAGES.loginIncorrect));

    expect(failure.kind).toBe('invalid');
    expect(failure.message).toBe(MESSAGES.loginIncorrect);
  });

  it('treats every refusal status as the same invalid-credentials sentence', () => {
    for (const status of [400, 403, 404, 422]) {
      const failure = classifyLoginFailure(new ApiError(status, 'bad_request', 'Invalid request.'));
      expect(failure.kind).toBe('invalid');
      expect(failure.message).toBe(MESSAGES.loginIncorrect);
    }
  });

  it('recognises the lockout by its code', () => {
    const failure = classifyLoginFailure(new ApiError(429, 'account_locked', 'anything'));

    expect(failure.kind).toBe('locked');
    expect(failure.message).toBe(MESSAGES.accountLocked);
  });

  it('recognises the lockout by its sentence even on a refusal status', () => {
    const failure = classifyLoginFailure(new ApiError(403, 'forbidden', MESSAGES.accountLocked));

    expect(failure.kind).toBe('locked');
    expect(failure.message).toBe(MESSAGES.accountLocked);
  });

  it('reports a request that never reached the backend as the no-internet sentence', () => {
    const failure = classifyLoginFailure(new ApiError(OFFLINE_STATUS, OFFLINE_CODE, MESSAGES.offline));

    expect(failure.kind).toBe('offline');
    expect(failure.message).toBe(MESSAGES.offline);
  });

  it('keeps a server failure as an unexpected one, with the server sentence', () => {
    const failure = classifyLoginFailure(new ApiError(500, 'server_error', 'The server is unwell.'));

    expect(failure.kind).toBe('unexpected');
    expect(failure.message).toBe('The server is unwell.');
  });

  it('survives something that is not an error at all', () => {
    const failure = classifyLoginFailure('nonsense');

    expect(failure.kind).toBe('unexpected');
    expect(failure.message.length).toBeGreaterThan(0);
  });
});

describe('isLockedFailure', () => {
  it('is false for a plain refusal', () => {
    expect(isLockedFailure(new ApiError(401, 'invalid_credentials', MESSAGES.loginIncorrect))).toBe(false);
  });

  it('is false for anything that is not an API failure', () => {
    expect(isLockedFailure(new Error(MESSAGES.accountLocked))).toBe(false);
  });
});

describe('normaliseMobileInput', () => {
  it('keeps digits only', () => {
    expect(normaliseMobileInput(' 98765-43210 ')).toBe('9876543210');
  });

  it('never holds more than a real mobile number', () => {
    expect(normaliseMobileInput('98765432109999')).toHaveLength(MOBILE_DIGITS);
  });

  it('is empty when nothing numeric was typed', () => {
    expect(normaliseMobileInput('abc')).toBe('');
  });
});

describe('missingCredentials', () => {
  it('is true until both fields carry something', () => {
    expect(missingCredentials('', '')).toBe(true);
    expect(missingCredentials('9876543210', '')).toBe(true);
    expect(missingCredentials('', 'Travel@123')).toBe(true);
  });

  it('is false once a number and a password are present', () => {
    expect(missingCredentials('9876543210', 'Travel@123')).toBe(false);
  });
});

describe('isAttemptBlocked', () => {
  it('is false while no account has been locked', () => {
    expect(isAttemptBlocked('9876543210', null)).toBe(false);
  });

  it('blocks the number the API locked, however it is punctuated', () => {
    expect(isAttemptBlocked('98765-43210', '9876543210')).toBe(true);
  });

  it('lets a different number through', () => {
    expect(isAttemptBlocked('9811122233', '9876543210')).toBe(false);
  });
});
