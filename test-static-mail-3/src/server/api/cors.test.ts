import { describe, it, expect } from 'vitest';
import {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  DEFAULT_ALLOWED_ORIGINS,
  MAX_AGE_SECONDS,
  VITE_DEV_ORIGINS,
  corsHeaders,
  originsFromEnv,
  resolveAllowedOrigin,
} from './cors.js';

describe('allowed origins', () => {
  it('includes the Vite dev origin by default', () => {
    expect(VITE_DEV_ORIGINS).toContain('http://localhost:5173');
    expect(VITE_DEV_ORIGINS).toContain('http://127.0.0.1:5173');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('http://localhost:5173');
    expect(DEFAULT_ALLOWED_ORIGINS).toContain('http://localhost:4173');
  });

  it('echoes an allowed origin and refuses anything else', () => {
    expect(resolveAllowedOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    expect(resolveAllowedOrigin('http://evil.example')).toBeNull();
    expect(resolveAllowedOrigin(undefined)).toBeNull();
    expect(resolveAllowedOrigin('')).toBeNull();
  });

  it('honours a wildcard list', () => {
    expect(resolveAllowedOrigin(undefined, ['*'])).toBe('*');
    expect(resolveAllowedOrigin('http://anywhere.example', ['*'])).toBe('*');
  });

  it('parses a configured list and falls back to the defaults', () => {
    expect(originsFromEnv('http://localhost:5173, http://studio.local')).toEqual([
      'http://localhost:5173',
      'http://studio.local',
    ]);
    expect(originsFromEnv('   ')).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(originsFromEnv('')).toEqual(DEFAULT_ALLOWED_ORIGINS);
    expect(originsFromEnv(undefined)).toEqual(DEFAULT_ALLOWED_ORIGINS);
  });
});

describe('cors headers', () => {
  it('advertises exactly the methods this API exposes', () => {
    const headers = corsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Methods']).toBe(ALLOWED_METHODS);
    expect(ALLOWED_METHODS).toContain('GET');
    expect(ALLOWED_METHODS).toContain('PUT');
    expect(ALLOWED_METHODS).not.toContain('DELETE');
    expect(ALLOWED_METHODS).not.toContain('PATCH');
    expect(ALLOWED_METHODS).not.toContain('POST');
  });

  it('allows the JSON content type and varies on origin', () => {
    const headers = corsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Headers']).toBe(ALLOWED_HEADERS);
    expect(headers['Access-Control-Max-Age']).toBe(String(MAX_AGE_SECONDS));
    expect(headers.Vary).toBe('Origin');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('omits the allow-origin header when there is nothing to allow', () => {
    const headers = corsHeaders(null);
    expect('Access-Control-Allow-Origin' in headers).toBe(false);
    expect(headers.Vary).toBe('Origin');
  });
});
