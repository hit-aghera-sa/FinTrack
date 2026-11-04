import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  hashSecurityAnswer,
  normaliseSecurityAnswer,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_MESSAGE,
  validatePassword,
  verifyPassword,
  verifySecurityAnswer,
} from './passwords.js';

describe('the password rule', () => {
  it('accepts a password of at least eight characters with a letter and a digit', () => {
    expect(validatePassword('Travel@123')).toBeNull();
    expect(validatePassword('abcdefg1')).toBeNull();
    expect(validatePassword('1abcdefg')).toBeNull();
  });

  it('refuses a password shorter than the minimum', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(validatePassword('abc1234')).toBe(PASSWORD_RULE_MESSAGE);
    expect(validatePassword('')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('refuses a password with no digit', () => {
    expect(validatePassword('onlyletters')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('refuses a password with no letter', () => {
    expect(validatePassword('12345678')).toBe(PASSWORD_RULE_MESSAGE);
    expect(validatePassword('1234567!')).toBe(PASSWORD_RULE_MESSAGE);
  });

  it('states the rule in one sentence', () => {
    expect(PASSWORD_RULE_MESSAGE).toBe(
      'Password must be at least 8 characters and include a letter and a digit.',
    );
  });
});

describe('password hashing', () => {
  it('stores nothing reversible and verifies the original password', async () => {
    const hash = await hashPassword('Travel@123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.includes('Travel@123')).toBe(false);
    expect(await verifyPassword('Travel@123', hash)).toBe(true);
  });

  it('refuses a wrong password', async () => {
    const hash = await hashPassword('Travel@123');
    expect(await verifyPassword('travel@123', hash)).toBe(false);
    expect(await verifyPassword('Travel@1234', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash, so two accounts with the same password look different', async () => {
    const first = await hashPassword('Travel@123');
    const second = await hashPassword('Travel@123');
    expect(first).not.toBe(second);
    expect(await verifyPassword('Travel@123', second)).toBe(true);
  });

  it('verifies nothing against an unusable stored value', async () => {
    expect(await verifyPassword('Travel@123', '')).toBe(false);
    expect(await verifyPassword('Travel@123', 'plaintext')).toBe(false);
    expect(await verifyPassword('Travel@123', 'scrypt$zz$zz')).toBe(false);
  });
});

describe('security answers', () => {
  it('normalises case and surrounding or repeated whitespace', () => {
    expect(normaliseSecurityAnswer('  Meera ')).toBe('meera');
    expect(normaliseSecurityAnswer('St   Xavier High')).toBe('st xavier high');
  });

  it('verifies an answer whatever case it is typed in', async () => {
    const hash = await hashSecurityAnswer('Meera');
    expect(await verifySecurityAnswer('meera', hash)).toBe(true);
    expect(await verifySecurityAnswer('  MEERA  ', hash)).toBe(true);
  });

  it('refuses a different answer', async () => {
    const hash = await hashSecurityAnswer('Meera');
    expect(await verifySecurityAnswer('Seema', hash)).toBe(false);
    expect(await verifySecurityAnswer('', hash)).toBe(false);
  });
});
