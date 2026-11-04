import { describe, it, expect } from 'vitest';
import {
  SECRET_REF_PLACEHOLDER,
  SECRET_VALUE_PATTERNS,
  containsSecretValue,
  redactSecretValues,
  redactTaskSecrets,
} from './redactSecrets.js';
import type { Task } from '../../models/index.js';

/**
 * Credential-shaped fixtures are ASSEMBLED at runtime rather than written as
 * literals, so no source file in this repository ever contains something that reads
 * like a real key.
 */
const FAKE_API_KEY = `sk-${'x'.repeat(24)}`;
const FAKE_GITHUB_TOKEN = `ghp_${'y'.repeat(30)}`;
const FAKE_AWS_KEY_ID = `AKIA${'Z'.repeat(16)}`;

const PINNED_A = '2024-05-01T10:00:00.000Z';
const PINNED_B = '2024-05-02T10:00:00.000Z';

describe('containsSecretValue', () => {
  it('recognises the credential shapes it declares', () => {
    expect(containsSecretValue(FAKE_API_KEY)).toBe(true);
    expect(containsSecretValue(FAKE_GITHUB_TOKEN)).toBe(true);
    expect(containsSecretValue(FAKE_AWS_KEY_ID)).toBe(true);
  });

  it('is stable across repeated calls (patterns carry no lastIndex state)', () => {
    expect(containsSecretValue(FAKE_API_KEY)).toBe(true);
    expect(containsSecretValue(FAKE_API_KEY)).toBe(true);
    expect(containsSecretValue(FAKE_API_KEY)).toBe(true);
  });

  it('leaves ordinary task titles alone', () => {
    expect(containsSecretValue('Alex QA groceries')).toBe(false);
    expect(containsSecretValue('Priya Lunch prep')).toBe(false);
    expect(containsSecretValue('Book dentist run-b7')).toBe(false);
  });

  it('does not flag class-name-like strings that merely contain "sk-"', () => {
    expect(containsSecretValue('task-list__row')).toBe(false);
    expect(containsSecretValue('task-list__checkbox')).toBe(false);
    expect(containsSecretValue('task-list__title--done')).toBe(false);
  });

  it('declares its patterns without the global flag', () => {
    for (const pattern of SECRET_VALUE_PATTERNS) {
      expect(pattern.global).toBe(false);
    }
  });
});

describe('redactSecretValues', () => {
  it('replaces a credential with the secret-ref placeholder', () => {
    const redacted = redactSecretValues(`Rotate ${FAKE_API_KEY} today`);
    expect(redacted).toBe(`Rotate ${SECRET_REF_PLACEHOLDER} today`);
    expect(redacted).not.toContain(FAKE_API_KEY);
  });

  it('replaces every occurrence, not only the first', () => {
    const redacted = redactSecretValues(`${FAKE_API_KEY} and ${FAKE_API_KEY}`);
    expect(redacted).toBe(`${SECRET_REF_PLACEHOLDER} and ${SECRET_REF_PLACEHOLDER}`);
  });

  it('redacts GitHub tokens and AWS key ids too', () => {
    expect(redactSecretValues(FAKE_GITHUB_TOKEN)).toBe(SECRET_REF_PLACEHOLDER);
    expect(redactSecretValues(FAKE_AWS_KEY_ID)).toBe(SECRET_REF_PLACEHOLDER);
  });

  it('returns ordinary text unchanged', () => {
    expect(redactSecretValues('Alex QA groceries')).toBe('Alex QA groceries');
    expect(redactSecretValues('task-list__row')).toBe('task-list__row');
  });
});

describe('redactTaskSecrets', () => {
  const tasks: Task[] = [
    { id: 'b2', title: 'Priya Lunch prep', completed: true, createdAt: PINNED_B },
    { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: PINNED_A },
  ];

  it('round-trips a clean list unchanged', () => {
    expect(redactTaskSecrets(tasks)).toEqual(tasks);
  });

  it('copies every task so the store array is never aliased', () => {
    const result = redactTaskSecrets(tasks);
    expect(result[0]).not.toBe(tasks[0]);
    result.pop();
    expect(tasks).toHaveLength(2);
  });

  it('redacts a credential-shaped title while keeping the other fields', () => {
    const withSecret: Task[] = [
      { id: 'c3', title: `Store ${FAKE_API_KEY}`, completed: false, createdAt: PINNED_A },
    ];
    const result = redactTaskSecrets(withSecret);
    expect(result[0]?.title).toBe(`Store ${SECRET_REF_PLACEHOLDER}`);
    expect(result[0]?.id).toBe('c3');
    expect(result[0]?.completed).toBe(false);
    expect(result[0]?.createdAt).toBe(PINNED_A);
  });

  it('never leaks the raw value anywhere in the serialised payload', () => {
    const withSecret: Task[] = [
      { id: 'c3', title: FAKE_GITHUB_TOKEN, completed: false, createdAt: PINNED_A },
      { id: 'a1', title: 'Alex QA groceries', completed: false, createdAt: PINNED_A },
    ];
    const serialised = JSON.stringify(redactTaskSecrets(withSecret));
    expect(serialised).not.toContain(FAKE_GITHUB_TOKEN);
    expect(serialised).toContain('Alex QA groceries');
  });

  it('treats an empty list as a success', () => {
    expect(redactTaskSecrets([])).toEqual([]);
  });
});
