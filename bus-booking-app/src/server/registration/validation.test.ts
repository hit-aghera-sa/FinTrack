import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../messages/index.js';
import { SECURITY_QUESTIONS } from '../../models/accounts/index.js';
import {
  FULL_NAME_MESSAGE,
  MOBILE_MESSAGE,
  PASSWORD_REQUIRED_MESSAGE,
  resolveSecurityQuestionId,
  SECURITY_ANSWER_MESSAGE,
  SECURITY_QUESTION_MESSAGE,
  validateSignup,
} from './validation.js';

/** Stands in for the auth lane's password rule, so this spec never loads bcrypt. */
const WEAK_PASSWORD_MESSAGE = 'Password must be at least 8 characters and include a letter and a digit.';

function passwordRule(password: string): string | null {
  const longEnough = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return longEnough && hasLetter && hasDigit ? null : WEAK_PASSWORD_MESSAGE;
}

const anythingGoes = (): string | null => null;

const QUESTION_ID = SECURITY_QUESTIONS[0].id;

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Aarti Deshmukh',
    mobile: '9812345670',
    password: 'Travel123',
    confirmPassword: 'Travel123',
    securityQuestionId: QUESTION_ID,
    securityAnswer: 'Meera',
    ...overrides,
  };
}

describe('validateSignup', () => {
  it('accepts a complete form and trims the name, number and answer', () => {
    const result = validateSignup(
      body({ fullName: '  Aarti Deshmukh  ', mobile: ' 9812345670 ', securityAnswer: '  Meera  ' }),
      passwordRule,
    );
    if (!result.ok) throw new Error(`expected success, got: ${result.message}`);
    expect(result.value.fullName).toBe('Aarti Deshmukh');
    expect(result.value.mobile).toBe('9812345670');
    expect(result.value.securityAnswer).toBe('Meera');
    expect(result.value.password).toBe('Travel123');
    expect(result.value.securityQuestionId).toBe(QUESTION_ID);
  });

  it('refuses a full name shorter than 2 characters', () => {
    const result = validateSignup(body({ fullName: 'A' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('fullName');
    expect(result.message).toBe(FULL_NAME_MESSAGE);
  });

  it('refuses a full name longer than 60 characters', () => {
    const result = validateSignup(body({ fullName: 'A'.repeat(61) }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('fullName');
    expect(result.message).toBe(FULL_NAME_MESSAGE);
  });

  it('accepts a full name of exactly 60 characters', () => {
    const result = validateSignup(body({ fullName: 'A'.repeat(60) }), passwordRule);
    expect(result.ok).toBe(true);
  });

  it('refuses a missing full name', () => {
    const result = validateSignup(body({ fullName: undefined }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('fullName');
  });

  it('refuses a body that is not an object at all', () => {
    const result = validateSignup('not a form', passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('fullName');
    expect(result.message).toBe(FULL_NAME_MESSAGE);
  });

  it('refuses a mobile number that does not start with 6, 7, 8 or 9', () => {
    const result = validateSignup(body({ mobile: '5812345670' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('mobile');
    expect(result.message).toBe(MOBILE_MESSAGE);
  });

  it('refuses a mobile number that is not exactly 10 digits', () => {
    for (const mobile of ['98123456', '98123456701']) {
      const result = validateSignup(body({ mobile }), passwordRule);
      if (result.ok) throw new Error(`expected a refusal for ${mobile}`);
      expect(result.message).toBe(MOBILE_MESSAGE);
    }
  });

  it('refuses a mobile number containing anything but digits', () => {
    const result = validateSignup(body({ mobile: '98a2345670' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('mobile');
  });

  it('accepts each of the allowed leading digits', () => {
    for (const lead of ['6', '7', '8', '9']) {
      const result = validateSignup(body({ mobile: `${lead}812345670` }), passwordRule);
      expect(result.ok).toBe(true);
    }
  });

  it("passes the password through the auth lane's rule and reports its sentence", () => {
    const result = validateSignup(body({ password: 'short1', confirmPassword: 'short1' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('password');
    expect(result.message).toBe(WEAK_PASSWORD_MESSAGE);
  });

  it('refuses an empty password even when the rule itself is silent', () => {
    const result = validateSignup(body({ password: '', confirmPassword: '' }), anythingGoes);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('password');
    expect(result.message).toBe(PASSWORD_REQUIRED_MESSAGE);
  });

  it('refuses a confirm password that differs', () => {
    const result = validateSignup(body({ confirmPassword: 'Travel124' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('confirmPassword');
    expect(result.message).toBe(MESSAGES.passwordMismatch);
    expect(result.message).toBe('Passwords do not match.');
  });

  it('refuses a security question outside the fixed list', () => {
    const result = validateSignup(body({ securityQuestionId: 'FAVOURITE-COLOUR' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('securityQuestionId');
    expect(result.message).toBe(SECURITY_QUESTION_MESSAGE);
  });

  it('refuses a missing security question', () => {
    const result = validateSignup(body({ securityQuestionId: undefined }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('securityQuestionId');
  });

  it('refuses a security answer shorter than 2 or longer than 50 characters', () => {
    for (const securityAnswer of ['A', 'x'.repeat(51)]) {
      const result = validateSignup(body({ securityAnswer }), passwordRule);
      if (result.ok) throw new Error('expected a refusal');
      expect(result.field).toBe('securityAnswer');
      expect(result.message).toBe(SECURITY_ANSWER_MESSAGE);
    }
  });

  it('refuses an answer that is only whitespace', () => {
    const result = validateSignup(body({ securityAnswer: '    ' }), passwordRule);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('securityAnswer');
  });

  it('reports the first offending field, in form order', () => {
    const result = validateSignup(
      body({ fullName: 'A', mobile: '12345', securityAnswer: 'A' }),
      passwordRule,
    );
    if (result.ok) throw new Error('expected a refusal');
    expect(result.field).toBe('fullName');
  });
});

describe('resolveSecurityQuestionId', () => {
  it('resolves every question in the fixed list', () => {
    for (const question of SECURITY_QUESTIONS) {
      expect(resolveSecurityQuestionId(question.id)).toBe(question.id);
    }
  });

  it('returns null for anything else', () => {
    expect(resolveSecurityQuestionId('something-else')).toBeNull();
    expect(resolveSecurityQuestionId('')).toBeNull();
  });
});
