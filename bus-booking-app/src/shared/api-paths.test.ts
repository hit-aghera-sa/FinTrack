import { describe, it, expect } from 'vitest';
import { API_BASE_PATH, API_PATHS, apiUrl, isApiPath } from './api-paths.js';

describe('the API address table', () => {
  it('prefixes a lane path with the API base', () => {
    expect(apiUrl(API_PATHS.me)).toBe('/api/auth/me');
    expect(apiUrl(API_PATHS.bookings)).toBe('/api/bookings');
  });

  it('never prefixes a path that already carries the base', () => {
    expect(apiUrl('/api/trips')).toBe('/api/trips');
    expect(apiUrl(API_BASE_PATH)).toBe('/api');
  });

  it('roots a path that was written without a leading slash', () => {
    expect(apiUrl('cities')).toBe('/api/cities');
  });

  it('recognises the addresses the API owns', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/bookings/BB-10042')).toBe(true);
  });

  it('leaves the client its own addresses', () => {
    expect(isApiPath('/')).toBe(false);
    expect(isApiPath('/search')).toBe(false);
    expect(isApiPath('/apifoo')).toBe(false);
  });

  it('declares every lane path exactly once, rooted', () => {
    const paths = Object.values(API_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith('/')).toBe(true);
  });
});
