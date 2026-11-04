import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../messages/index.js';
import {
  ApiError,
  OFFLINE_CODE,
  UNEXPECTED_MESSAGE,
  errorFromBody,
  isApiError,
  isOfflineError,
  offlineError,
  readErrorBody,
} from './errors.js';

describe('ApiError', () => {
  it('carries the status, the code and the server sentence', () => {
    const error = new ApiError(401, 'invalid_credentials', MESSAGES.loginIncorrect);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(401);
    expect(error.code).toBe('invalid_credentials');
    expect(error.message).toBe(MESSAGES.loginIncorrect);
    expect(isApiError(error)).toBe(true);
    expect(isApiError(new Error('nope'))).toBe(false);
  });
});

describe('readErrorBody', () => {
  it('accepts the shared error body', () => {
    expect(readErrorBody({ error: { code: 'account_locked', message: MESSAGES.accountLocked } })).toEqual({
      error: { code: 'account_locked', message: MESSAGES.accountLocked },
    });
  });

  it('rejects anything else', () => {
    expect(readErrorBody(null)).toBeNull();
    expect(readErrorBody('<html>502 Bad Gateway</html>')).toBeNull();
    expect(readErrorBody({ error: 'account_locked' })).toBeNull();
    expect(readErrorBody({ error: { code: 'x' } })).toBeNull();
    expect(readErrorBody({ error: { code: '', message: '' } })).toBeNull();
  });
});

describe('errorFromBody', () => {
  it('prefers the server code and message', () => {
    const error = errorFromBody(409, JSON.stringify({ error: { code: 'duplicate_mobile', message: MESSAGES.duplicateMobile } }));
    expect(error.status).toBe(409);
    expect(error.code).toBe('duplicate_mobile');
    expect(error.message).toBe(MESSAGES.duplicateMobile);
  });

  it('falls back to the status when the body is not the shared shape', () => {
    const error = errorFromBody(500, '<html>Internal Server Error</html>');
    expect(error.code).toBe('http_500');
    expect(error.message).toBe(UNEXPECTED_MESSAGE);
  });

  it('treats a gateway answer for an unreachable backend as no connection', () => {
    const error = errorFromBody(503, '');
    expect(error.code).toBe(OFFLINE_CODE);
    expect(error.message).toBe('No internet connection. Please check and try again.');
    expect(isOfflineError(error)).toBe(true);
  });
});

describe('isOfflineError', () => {
  it('is true for the offline error and its message is the catalogue sentence', () => {
    const error = offlineError();
    expect(error.status).toBe(0);
    expect(error.code).toBe(OFFLINE_CODE);
    expect(error.message).toBe('No internet connection. Please check and try again.');
    expect(isOfflineError(error)).toBe(true);
  });

  it('is true for the TypeError a browser rejects a dead fetch with', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isOfflineError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isOfflineError(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toBe(true);
  });

  it('is false for a real server answer, an abort and a non-error', () => {
    expect(isOfflineError(new ApiError(401, 'not_signed_in', 'Please log in.'))).toBe(false);
    const aborted = new Error('The user aborted a request.');
    aborted.name = 'AbortError';
    expect(isOfflineError(aborted)).toBe(false);
    expect(isOfflineError('offline')).toBe(false);
    expect(isOfflineError(null)).toBe(false);
  });
});
