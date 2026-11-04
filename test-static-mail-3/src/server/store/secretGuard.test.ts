import { describe, it, expect } from 'vitest';
import { COPY } from '../../models/index.js';
import { SECRET_PATTERNS, looksLikeSecret } from './secretGuard.js';
import { parseTask, type ParseTaskOptions } from './taskShape.js';

/** Deterministic id/clock overrides, mirroring how the store injects them. */
function options(): ParseTaskOptions {
  let counter = 0;
  return {
    idFactory: (): string => `id-${(counter += 1)}`,
    now: (): string => '2024-05-01T10:00:00.000Z',
  };
}

describe('SECRET_PATTERNS', () => {
  it('are stateless (no global flag) so repeated tests agree', () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.global).toBe(false);
    }
  });
});

describe('looksLikeSecret', () => {
  it('flags credential-shaped tokens', () => {
    const secrets = [
      'sk-live0123456789abcdef',
      'my key is sk-test0123456789abcdef thanks',
      'api-0123456789abcdef0123',
      'ghp_0123456789abcdef0123',
      'AKIA0123456789ABCDEF',
      'Bearer abcdef0123456789abcd',
      '-----BEGIN RSA PRIVATE KEY-----',
    ];
    for (const secret of secrets) {
      expect(looksLikeSecret(secret)).toBe(true);
    }
  });

  it('leaves ordinary task copy alone', () => {
    const safe = [
      'Alex QA groceries',
      'Priya Lunch prep',
      'Book dentist run-b7',
      'Ask-list review with Alex QA',
      'Rename the task-list styles',
      'task-list__row',
      'x'.repeat(100),
    ];
    for (const title of safe) {
      expect(looksLikeSecret(title)).toBe(false);
    }
  });

  it('treats non-strings and blanks as harmless', () => {
    expect(looksLikeSecret('')).toBe(false);
    expect(looksLikeSecret(null)).toBe(false);
    expect(looksLikeSecret(undefined)).toBe(false);
    expect(looksLikeSecret(42)).toBe(false);
    expect(looksLikeSecret({ title: 'sk-live0123456789abcdef' })).toBe(false);
  });
});

describe('parseTask secret guard', () => {
  it('rejects a credential-shaped title', () => {
    const result = parseTask({ title: 'sk-live0123456789abcdef' }, options());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('bad_request');
      expect(result.message).toBe(COPY.errors.unexpected);
    }
  });

  it('rejects a credential-shaped id', () => {
    const result = parseTask(
      { id: 'ghp_0123456789abcdef0123', title: 'Alex QA groceries' },
      options(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('bad_request');
    }
  });

  it('still accepts an ordinary entry unchanged', () => {
    const result = parseTask({ id: 'a1', title: 'Alex QA run-b7' }, options());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('a1');
      expect(result.value.title).toBe('Alex QA run-b7');
    }
  });
});
