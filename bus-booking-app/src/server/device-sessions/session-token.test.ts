import { describe, expect, it } from 'vitest';
import { readSessionTokenFromCookies } from './session-token.js';

const COOKIE_NAME = 'bus_booking_session';

describe('readSessionTokenFromCookies', () => {
  it('reads the token when it is the only cookie', () => {
    expect(readSessionTokenFromCookies(`${COOKIE_NAME}=abc123`, COOKIE_NAME)).toBe('abc123');
  });

  it('finds the token among other cookies', () => {
    const header = `theme=light; ${COOKIE_NAME}=abc123; locale=en-IN`;
    expect(readSessionTokenFromCookies(header, COOKIE_NAME)).toBe('abc123');
  });

  it('decodes a percent-encoded value', () => {
    expect(readSessionTokenFromCookies(`${COOKIE_NAME}=a%2Fb%3Dc`, COOKIE_NAME)).toBe('a/b=c');
  });

  it('keeps a value that is not percent-encoded', () => {
    expect(readSessionTokenFromCookies(`${COOKIE_NAME}=100%`, COOKIE_NAME)).toBe('100%');
  });

  it('is null when there is no cookie header at all', () => {
    expect(readSessionTokenFromCookies(undefined, COOKIE_NAME)).toBeNull();
    expect(readSessionTokenFromCookies('   ', COOKIE_NAME)).toBeNull();
  });

  it('is null when the session cookie is absent or empty', () => {
    expect(readSessionTokenFromCookies('theme=light; locale=en-IN', COOKIE_NAME)).toBeNull();
    expect(readSessionTokenFromCookies(`${COOKIE_NAME}=`, COOKIE_NAME)).toBeNull();
  });

  it('does not mistake a differently named cookie for the session', () => {
    expect(readSessionTokenFromCookies(`other_${COOKIE_NAME}=abc123`, COOKIE_NAME)).toBeNull();
  });
});
