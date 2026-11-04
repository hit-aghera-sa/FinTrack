import { describe, expect, it } from 'vitest';
import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_RULE_MESSAGE,
  normaliseFullName,
  validateFullName,
} from './validation.js';

describe('normaliseFullName', () => {
  it('trims the ends and collapses the gaps between words', () => {
    expect(normaliseFullName('  Priya   Menon \n')).toBe('Priya Menon');
  });
});

describe('validateFullName', () => {
  it('accepts an ordinary name', () => {
    expect(validateFullName('Alex QA')).toBeNull();
  });

  it('refuses a blank name with the name rule', () => {
    expect(validateFullName('   ')).toBe(FULL_NAME_RULE_MESSAGE);
  });

  it('refuses a single character', () => {
    expect(validateFullName('A')).toBe(FULL_NAME_RULE_MESSAGE);
  });

  it('refuses a name longer than the limit', () => {
    const tooLong = 'Aa'.repeat(FULL_NAME_MAX_LENGTH);
    expect(validateFullName(tooLong)).toBe(FULL_NAME_RULE_MESSAGE);
  });
});
