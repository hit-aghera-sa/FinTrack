/**
 * Render-surface guard for the state/HTTP hook lane.
 *
 * The hook renders nothing: it owns state and the two HTTP calls, and the ONLY string
 * it ever puts on screen is the single error line. This test pins that surface so the
 * lane can never contribute to a rendered-secret or typography finding:
 *
 *  - every message it can surface is a non-empty, human sentence taken from the shared
 *    COPY contract in `src/models`;
 *  - none of them carries a `sk-…` token (the shape the QA secret scanner flags);
 *  - none of them carries markup, a class attribute or a font declaration.
 *
 * Pure Node test: no DOM, no network, no fixtures written anywhere.
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../api/index.js';
import { LOAD_ERROR, SAVE_ERROR, errorMessageFrom } from './taskState.js';

/** `sk-` followed by a long token — the shape the deterministic secret scanner flags. */
const SECRET_LIKE = /sk-[A-Za-z0-9_-]{8,}/;

/** Markup / styling this lane must never emit, because it renders nothing at all. */
const MARKUP_LIKE = /<[a-z]|class=|font-size|font-family/i;

/** Every string this lane can put on screen, through the one error line. */
const surfaced: readonly string[] = [
  LOAD_ERROR,
  SAVE_ERROR,
  errorMessageFrom(new ApiError('Could not save your tasks.'), SAVE_ERROR),
  errorMessageFrom(new ApiError('   '), SAVE_ERROR),
  errorMessageFrom(new Error('socket hang up'), LOAD_ERROR),
  errorMessageFrom(null, LOAD_ERROR),
  errorMessageFrom('raw string', LOAD_ERROR),
];

describe('hook lane render surface', () => {
  it('surfaces only non-empty, trimmed sentences', () => {
    for (const message of surfaced) {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toBe(message.trim());
    }
  });

  it('never surfaces a token shaped like an API key', () => {
    for (const message of surfaced) {
      expect(SECRET_LIKE.test(message)).toBe(false);
    }
  });

  it('never surfaces markup, class names or font declarations', () => {
    for (const message of surfaced) {
      expect(MARKUP_LIKE.test(message)).toBe(false);
    }
  });
});

describe('errorMessageFrom', () => {
  it('prefers the ApiError message the API client already mapped to copy', () => {
    expect(errorMessageFrom(new ApiError('Could not save your tasks.'), SAVE_ERROR)).toBe(
      'Could not save your tasks.',
    );
  });

  it('falls back to the shared copy for a blank ApiError message', () => {
    expect(errorMessageFrom(new ApiError('   '), SAVE_ERROR)).toBe(SAVE_ERROR);
  });

  it('never leaks a raw runtime failure to the screen', () => {
    expect(errorMessageFrom(new Error('socket hang up'), LOAD_ERROR)).toBe(LOAD_ERROR);
    expect(errorMessageFrom(undefined, LOAD_ERROR)).toBe(LOAD_ERROR);
    expect(errorMessageFrom({ message: 'internal detail' }, LOAD_ERROR)).toBe(LOAD_ERROR);
  });
});
