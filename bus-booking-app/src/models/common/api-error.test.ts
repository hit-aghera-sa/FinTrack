import { describe, expect, it } from 'vitest';
import { apiErrorBody, isApiErrorBody } from './api-error.js';

describe('apiErrorBody', () => {
  it('wraps a code and message in the app error envelope', () => {
    expect(apiErrorBody('seat_taken', 'That seat has just been booked.')).toEqual({
      error: { code: 'seat_taken', message: 'That seat has just been booked.' },
    });
  });
});

describe('isApiErrorBody', () => {
  it('accepts a well-formed error body', () => {
    expect(isApiErrorBody(apiErrorBody('invalid_credentials', 'Mobile number or password is wrong.'))).toBe(true);
  });

  it('rejects bodies that are missing the code or the message', () => {
    expect(isApiErrorBody({ error: { code: 'x' } })).toBe(false);
    expect(isApiErrorBody({ error: { message: 'x' } })).toBe(false);
    expect(isApiErrorBody({ error: { code: 1, message: 'x' } })).toBe(false);
  });

  it('rejects values that are not error bodies at all', () => {
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody('error')).toBe(false);
    expect(isApiErrorBody({})).toBe(false);
    expect(isApiErrorBody({ error: null })).toBe(false);
  });
});
