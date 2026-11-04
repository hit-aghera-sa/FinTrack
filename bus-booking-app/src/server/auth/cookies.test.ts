import { describe, expect, it } from 'vitest';
import {
  clearedSessionCookie,
  parseCookieHeader,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  sessionCookie,
} from './cookies.js';
import { isLoopbackAddress } from './trusted-client.js';

describe('cookie header parsing', () => {
  it('reads a single pair', () => {
    expect(parseCookieHeader(`${SESSION_COOKIE_NAME}=abc123`)).toEqual({
      [SESSION_COOKIE_NAME]: 'abc123',
    });
  });

  it('reads several pairs and ignores surrounding spaces', () => {
    expect(parseCookieHeader(` theme=dark; ${SESSION_COOKIE_NAME}=abc123 `)).toEqual({
      theme: 'dark',
      [SESSION_COOKIE_NAME]: 'abc123',
    });
  });

  it('is empty for a missing or blank header', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader('   ')).toEqual({});
  });

  it('skips a malformed segment rather than refusing the rest', () => {
    expect(parseCookieHeader(`broken; =nameless; ${SESSION_COOKIE_NAME}=abc123`)).toEqual({
      [SESSION_COOKIE_NAME]: 'abc123',
    });
  });
});

describe('the session cookie', () => {
  it('is http-only, site-scoped and long-lived, so a browser restart keeps the session', () => {
    const header = sessionCookie('abc123', false);
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=abc123`)).toBe(true);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Path=/');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain(`Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
    expect(header).not.toContain('Secure');
  });

  it('adds Secure behind HTTPS', () => {
    expect(sessionCookie('abc123', true)).toContain('Secure');
  });

  it('expires immediately when the session ends', () => {
    const header = clearedSessionCookie(false);
    expect(header.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('HttpOnly');
  });
});

describe('loopback detection for the trusted test client', () => {
  it('recognises the machine itself', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('rejects anything else, including an absent address', () => {
    expect(isLoopbackAddress('203.0.113.9')).toBe(false);
    expect(isLoopbackAddress('')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
    expect(isLoopbackAddress(null)).toBe(false);
  });
});
